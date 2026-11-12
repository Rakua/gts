import { promises } from 'node:fs'
import * as path from 'node:path'
import { exit } from 'node:process'

import { CliArgumentsTmpl, FileMap, TemplateData, defaults } from './data.js'
import { compile } from './compile.js'
import { translate } from './translate0.js'
import { tmpl } from './tmpl.js'
import { genDataHelp, longHelp, shortHelp } from './help.js'
import { errorToString, offsetPosition, parseCliArguments, redText, removeTrailingSlash } from './misc.js'
import { tmpl0Str } from './tmpl0mod.js'
import { jsonDir, JsonDirOptions } from './jsondir.js'
import { TplDoesNotExistError } from './errors.js'

const version = "1.1.0"

await main()

async function main() {
    const args = process.argv.slice(2)
    const rargs = args.slice(1) //args for gen-data and offset

    try {

        switch (args[0]) {
            case "gen-data": { }
                if (rargs.length == 0) throw new Error("gen-data requires at least one argument (data directory)")
                if (rargs[0] == "help") {
                    console.log(genDataHelp(version))
                    return
                }

                await mainGenData(rargs)
                break
            case "offset":
                const file = rargs[0]
                const pos = parseInt(rargs[1], 10)
                if (Number.isNaN(pos)) throw new Error("second argument is not a number")
                await mainOffset(file, pos)
                break
            default:
                await mainTmpl(args)
        }
    } catch (e) {
        const errPrefx = redText("[gts:err]", "stderr")
        console.error(errPrefx, errorToString(e))
        process.exitCode = 1
        exit(1)
    }
}

async function mainOffset(file: string, pos: number) {
    const op = offsetPosition(await promises.readFile(file, { encoding: "utf-8" }), pos)
    console.log(`Line ${op.line}, column ${op.column}`)
}

async function mainGenData(args: string[]) {
    try {
        const parsedArgs = parseArgumentsGenData(args)

        const flagV = parsedArgs.flags.includes("v") //verbose
        const verboseLog = (...args: any[]) => { if(flagV) console.log(...args) }
        verboseLog("Args: %O", parsedArgs)

        const res = await jsonDir(parsedArgs.dataDir, parsedArgs.options)
        if (res.type == "Checked") {
            if(!res.valid) {
                throw new Error(`format check failed (tsc return code ${res.tscReturnCode})`, )
            }
        }

        //write compiled JSON to file
        await promises.writeFile(parsedArgs.out, JSON.stringify(res.data, null, parsedArgs.indent))
    } catch (e) {
        const errPrefx = redText("[gts:err]", "stderr")
        console.error(errPrefx, errorToString(e))
        process.exitCode = 1
        exit(1)
    }
}

async function mainTmpl(args: string[]) {
    if (args.length == 0) {
        console.log(shortHelp(version))
        return
    } else if (args[0] == "help") {
        console.log(longHelp(version))
        return
    }

    const cliArgs = parseArgumentsTmpl(args)
    const flag0 = cliArgs.flags.includes("0") //use translate0
    const flagB = cliArgs.flags.includes("b") //drop file extension in template names
    const flagD = cliArgs.flags.includes("d") //debug (console.log in tmpl0)
    const flagP = cliArgs.flags.includes("p") //write tmplData to file
    const flagT = cliArgs.flags.includes("t") //include time
    const flagV = cliArgs.flags.includes("v") //verbose

    if (flagV) console.log("Args: %O", cliArgs)

    if (cliArgs.tagStart == cliArgs.tagEnd)
        throw new Error(`tagStart and tagEnd are identical (${cliArgs.tagStart})`)
    if (flagB && cliArgs.exts.length > 1)
        throw new Error(`Can't drop extension for multiple extensions`)

    const tmplFiles = await getTmplFiles(cliArgs.dir, cliArgs.exts, flagB)
    if (Object.getOwnPropertyNames(tmplFiles).length == 0)
        throw new Error(`No files found in directory ${cliArgs.dir} with extension(s) ${cliArgs.exts.join(", ")}`)

    try {
        const parseTrees = compile(tmplFiles, cliArgs.tagStart, cliArgs.tagEnd)

        const tmplData: TemplateData = {
            templates: parseTrees,
            tmplNames: Object.keys(tmplFiles),
            tagStartDelimiter: cliArgs.tagStart,
            tagEndDelimiter: cliArgs.tagEnd,
            compileDate: (new Date()).toISOString(),
            exts: cliArgs.exts.map(x => ({ ext: x })),
            showDate: flagT,
            debugMode: flagD,
        }

        const output = flag0 ? translate(tmpl0Str, tmplData) : tmpl("tmpl", tmplData)

        promises.writeFile(cliArgs.out, output)

        if (flagP) {
            promises.writeFile(cliArgs.out + ".td.json", JSON.stringify(tmplData, null, 2))
        }
    } catch (err) {
        if (!(err instanceof TplDoesNotExistError)) throw err
        const pos = offsetPosition(tmplFiles[err.tmplName], err.tag.position)
        throw new Error(`Template ${JSON.stringify(err.tag.args[0])} included in template ${redText(err.tmplName)} (line ${pos.line}, column ${pos.column}) does not exist`)
    }
}

function parseArgumentsTmpl(args: string[]): CliArgumentsTmpl {
    const argumentKeys = ["exts", "out", "flags", "tagStart", "tagEnd"]
    const cliArgs = parseCliArguments(args, argumentKeys)
    //convert null values back to empty strings
    for (const key in cliArgs.argument) {
        cliArgs.argument[key] = cliArgs.argument[key] ?? ""
    }
    const cliArguments = cliArgs.argument as Record<string, string>

    const tmplDir = cliArgs.input
    const flags = cliArguments["flags"] === undefined ? "" : cliArguments["flags"]
    const exts = cliArguments["exts"] === undefined ? ["html", "css"] : (cliArguments["exts"] ?? "").split(",")
    const outFile = cliArguments["out"] === undefined ? path.join(tmplDir, "../tmpl.js") : cliArguments["out"]

    const cliArgsTmpl: CliArgumentsTmpl = {
        dir: cliArgs.input,
        exts: exts,
        out: outFile!,
        tagStart: cliArguments["tagStart"] ?? defaults.tagStart,
        tagEnd: cliArguments["tagEnd"] ?? defaults.tagEnd,
        flags: flags!
    }

    return cliArgsTmpl
}

type CliArgsGenData = { dataDir: string, out: string, indent: number, options: JsonDirOptions, flags: string }
function parseArgumentsGenData(args: string[]): CliArgsGenData {
    const argumentKeys = ["out", "indent", "formatDir", "checkDir", "formatName", "arrayTokenFile", "arrayKeyDataProperty", "arrayKeyRawDataProperty", "flags"]
    const cliArgs = parseCliArguments(args, argumentKeys)
    const dataDir = cliArgs.input
    const outFile = cliArgs.argument["out"] ?? removeTrailingSlash(dataDir) + ".json"
    const flags = cliArgs.argument["flags"]?? ""

    const defaultIndent = 4

    const cliArgsGenData: CliArgsGenData = {
        dataDir: dataDir,
        out: outFile,
        indent: cliArgs.argument["indent"] === undefined
            ? defaultIndent : parseInt(cliArgs.argument["indent"] ?? "", 10) || 0,
        flags: flags,
        options: {
            formatDir: cliArgs.argument["formatDir"] ?? undefined,
            checkDir: cliArgs.argument["checkDir"] ?? undefined,
            formatName: cliArgs.argument["formatName"] ?? undefined,
            arrayTokenFile: cliArgs.argument["arrayTokenFile"] ?? undefined,
            arrayKeyDataProperty: cliArgs.argument["arrayKeyDataProperty"] ?? undefined,
            arrayKeyRawDataProperty: cliArgs.argument["arrayKeyRawDataProperty"] ?? undefined
        }
    }

    return cliArgsGenData
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

    /**
     * Name of a template as called in tmpl() function
     */
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
                const err0 = err as Error
                const errMsg = "Error reading file " + redText(file.name, "stderr") + ":" + err0.message
                throw new Error(errMsg)
            }
        }
    }

    return res
}