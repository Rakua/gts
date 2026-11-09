import { promises } from 'fs'
import * as path from 'path'

import { CliArguments, FileMap, TemplateData, defaults } from './data'
import { compile } from './compile'
import { translate } from './translate0'
import { tmpl } from './tmpl'
import { longHelp, shortHelp } from './help'
import { tmpl0Str } from './tmpl0mod'

const version = "1.0.0"

main()

async function main() {
    const args = process.argv.slice(2)
    if (args.length == 0) {
        console.log(shortHelp(version))
        return
    } else if (args[0] == "help") {
        console.log(longHelp(version))
        return
    }

    const cliArgs = parseArguments(args)
    const flag0 = cliArgs.flags.includes("0") //use translate0
    const flagB = cliArgs.flags.includes("b") //drop file extension in template names
    const flagD = cliArgs.flags.includes("d") //debug (console.log in tmpl0)
    const flagP = cliArgs.flags.includes("p") //write tmplData to file
    const flagT = cliArgs.flags.includes("t") //include time
    const flagV = cliArgs.flags.includes("v") //verbose

    if (flagV) console.log("Args:", JSON.stringify(cliArgs))

    if (cliArgs.tagStart == cliArgs.tagEnd)
        throw new Error(`tagStart and tagEnd are identical (${cliArgs.tagStart})`)
    if (flagB && cliArgs.exts.length > 1)
        throw new Error(`Can't drop extension for multiple extensions`)

    const tmplFiles = await getTmplFiles(cliArgs.dir, cliArgs.exts, flagB)
    if (Object.getOwnPropertyNames(tmplFiles).length == 0)
        throw new Error(`No files found in directory ${cliArgs.dir} with extension(s) ${cliArgs.exts.join(", ")}`)

    const parseTrees = compile(tmplFiles, cliArgs.tagStart, cliArgs.tagEnd)
    const tmplData: TemplateData = {
        templates: parseTrees,
        tagStartDelimiter: cliArgs.tagStart,
        tagEndDelimiter: cliArgs.tagEnd,
        compileDate: (new Date()).toISOString(),
        exts: cliArgs.exts.map(x => ({ ext: x })),
        showDate: flagT,
        debugMode: flagD,
    }

    const output = flag0 ? translate(tmpl0Str, tmplData) : tmpl("tmpl", tmplData)

    promises.writeFile(cliArgs.out, output)

    if (flagP)
        promises.writeFile(cliArgs.out + ".td.json", JSON.stringify(tmplData, null, 2))
}

function parseArguments(args: string[]): CliArguments {
    if (args.length == 0) throw Error("no arguments")

    const parseList = (val: string) => val.includes(",") ? val.split(",") : [val]
    const tmplDir0 = args.shift()
    const tmplDir = tmplDir0!.endsWith("/") ? tmplDir0!.slice(0, -1) : tmplDir0!
    const outFile = tmplDir + "/../tmpl.js"

    const cliArgs: CliArguments = {
        dir: tmplDir!,
        exts: ["html", "css"],
        out: outFile,
        tagStart: defaults.tagStart,
        tagEnd: defaults.tagEnd,
        flags: ""
    }
    const exists: any = {}

    for (const arg of args) {
        if (!arg.includes("="))
            throw new Error(`Argument ${arg} does not contain '='`)
        const [key, val] = arg.split("=")
        if ((cliArgs as any)[key] === undefined)
            throw new Error(`Unknown argument key ${key} in ${arg}`)
        if (exists[key]) {
            throw new Error(`Argument key ${key} occurs more than once`)
        }

        (cliArgs as any)[key] = key == "exts" ? parseList(val) : val
        exists[key] = true
    }
    return cliArgs
}

/**
 * Recursively scans {@link tmplDir} for files whose file extension is contained in 
 * {@link exts} and returns them as object. 
 * 
 * @param tmplDir Directory that is scanned recursively
 * @param exts A single extension (`"htm"`) or a list of extensions (`["htm","css"]`)
 * @param curDir Omit this argument (used for recursive calls)
 * @returns Object with files mapped to their contents. The file extension is included in 
 * the property name if {@link exts} contains more than one extension.
 * 
 * Ex. 1: `{"file1": "Contents of file1.htm", "subdir/file2": "...", ...}`
 * 
 * Ex. 2: `{"index.htm": "...", "styles/main.css": "...", ...}`
 */
async function getTmplFiles(tmplDir: string, exts: string | string[], dropExt?: boolean, curDir?: string): Promise<FileMap> {
    if (typeof exts == "string") exts = [exts] //convert single extension to singleton array
    if (curDir === undefined) curDir = tmplDir

    const pathToTmplName = function (file: string, tmplDir: string) {
        let tmplName = path.resolve(file).slice(path.resolve(tmplDir).length + 1)
        if (exts.length == 1 && dropExt) tmplName = tmplName.slice(0, -1 * (exts[0].length + 1))
        return tmplName
    }

    const or = (x: boolean, y: boolean) => x || y
    const res: { [index: string]: any } = {}
    const files = await promises.readdir(curDir, { withFileTypes: true })
    for (const file of files) {
        const filePath = path.join(curDir, file.name)
        if (file.isDirectory()) {
            const nestedFiles = await getTmplFiles(tmplDir, exts, dropExt, filePath)
            Object.assign(res, nestedFiles)
        } else if (exts.map(ext => filePath.endsWith(ext)).reduce(or)) {
            try {
                const tmplName = pathToTmplName(filePath, tmplDir)
                const data = await promises.readFile(filePath, "utf8")
                res[tmplName] = data
            } catch (err) {
                console.error("Error reading file " + file.name + ":", err)
            }
        }
    }

    return res
}