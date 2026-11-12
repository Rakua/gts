//#region import/export
export {
    JsonDirOptions, FileParser, jsonDir,
    JsonDirData, JsonDirFormat,
    JsonDirError, JsonDirParsingError, JsonDirDuplicateKeyError, JsonDirMixedKeyTypesError
}

import { existsSync, promises } from 'node:fs'
import * as path from 'node:path'
import { spawnSync } from 'node:child_process'
import { errorToString } from './misc.js'
//#endregion

//#region types
type JsonDirOptions = {
    formatDir?: string | null //null => no format supplied
    checkDir?: string | null //null => do not check (compiled format files are not written and executed)
    formatName?: string //default is "format" (.ts extension is added)

    excludeFile?: (filepath: string) => boolean
    customParsers?: FileParser[]

    arrayTokenFile?: string
    arrayKeyDataProperty?: string
    arrayKeyRawDataProperty?: string
}

type JsonDirContext = {
    dataDir: string
    formatDir: string | null
    checkDir: string | null
    formatName: string

    excludeFile: (filepath: string) => boolean
    parsers: FileParser[]

    arrayTokenFile: string
    arrayKeyDataProperty: string
    arrayKeyRawDataProperty: string
}

type JsonDirRv = JsonDirRvDataOnly | JsonDirRvDataAndFormatOnly | JsonDirChecked
type JsonDirRvDataOnly = {
    type: "Data"
    data: JsonDirData
}
type JsonDirRvDataAndFormatOnly = Omit<JsonDirRvDataOnly, "type"> & {
    type: "DataAndFormat"
    format: JsonDirFormat
    compiled: CompiledFormatFile[]
}
type JsonDirChecked = Omit<JsonDirRvDataAndFormatOnly, "type"> & {
    type: "Checked"
    valid: boolean,
    tscReturnCode: number | null
}

type FormatContext = {
    arrayTokenFile: string,
    arrayKeyDataProperty: string,
    arrayKeyRawDataProperty: string,
    formatName: string
}

type FileParser = {
    ext: string
    parser: (contents: string) => any
}

type JsonDirData = RecursiveRecord<any> | RecursiveRecord<any>[]
type JsonDirFormat = RecursiveRecord<FileContents>
type CompiledFormatFile = { file: FilePath, contents: FileContents }

type RecursiveRecord<T> = { [index: string]: T | RecursiveRecord<T> }
type FileContents = string
type FilePath = string
//#endregion

//#region constants
const defaults = {
    arrayTokenFile: "array.token",
    arrayKeyDataProperty: "$ARRAY_KEY",
    arrayKeyRawDataProperty: "$ARRAY_KEY_RAW",
    formatDir: "format",
    formatName: "format", //format filename for whole directory (without .ts ext)
    checkDir: "check"
}

const tsExt = ".ts"
//#endregion

async function jsonDir(dataDir: string, options?: JsonDirOptions): Promise<JsonDirRv> {
    options ??= {}
    const parsers = defaultParsers().concat(options.customParsers ?? [])
    const formatDir = options.formatDir !== undefined ? options.formatDir
        : (existsSync(defaults.formatDir) ? defaults.formatDir : null)

    const context: JsonDirContext = {
        dataDir: dataDir,
        formatDir: formatDir,
        checkDir: options.checkDir === undefined ? defaults.checkDir : options.checkDir,
        parsers: parsers,
        arrayTokenFile: options.arrayTokenFile ?? defaults.arrayTokenFile,
        arrayKeyDataProperty: options.arrayKeyDataProperty ?? defaults.arrayKeyDataProperty,
        arrayKeyRawDataProperty: options.arrayKeyDataProperty ?? defaults.arrayKeyRawDataProperty,
        formatName: options.formatName ?? defaults.formatName,
        excludeFile: options.excludeFile ?? ((_filepath: string) => false)
    }

    const data = await loadData(dataDir, context)
    if (formatDir == null) return { type: "Data", data: data }

    const format = await loadFormat(formatDir, context.formatName)
    const compiled = formatCompile(data, format, context)
    if (context.checkDir === null) return { type: "DataAndFormat", data, format, compiled }

    await formatWrite(context.checkDir, compiled)
    const res = formatExecute(context.checkDir, compiled)
    return {
        type: "Checked",
        data: data,
        format: format,
        compiled: compiled,
        valid: res === 0,
        tscReturnCode: res
    }
}

//#region load data and format
async function loadFormat(formatDir: string, formatName: string): Promise<JsonDirFormat> {
    const format: JsonDirFormat = {}

    const files = await promises.readdir(formatDir, { withFileTypes: true })
    for (const file of files) {
        const filepath = path.join(formatDir, file.name)

        if (file.isDirectory()) {
            format[file.name] = await loadFormat(filepath, formatName)
        } else {
            // if (file.name == arrayTokenFile) {
            //     format[arrayTokenFile] = ""
            //     continue
            // }
            //ignore all files that don't end with ".ts" (except array token file)
            if (!file.name.endsWith(tsExt)) continue
            const key = file.name == formatName + tsExt
                ? "" //format for whole directory => empty key
                : file.name.slice(0, -1 * tsExt.length) //remove ".ts" extension
            format[key] = await promises.readFile(filepath, { encoding: "utf8" })
        }
    }

    return format
}

async function loadData(curDir: string, context: JsonDirContext): Promise<JsonDirData> {
    const data: JsonDirData = {}

    if (existsSync(path.join(curDir, context.arrayTokenFile))) {
        return await loadDataArray(curDir, context)
    }

    const files = await promises.readdir(curDir, { withFileTypes: true })
    for (const file of files) {
        const filepath = path.join(curDir, file.name)

        if (context.excludeFile(filepath)) continue

        if (file.isDirectory()) {
            data[file.name] = await loadData(filepath, context)
        } else {
            //data file
            const contents = await promises.readFile(filepath, { encoding: "utf8" })
            const parser = selectParser(file.name, context.parsers)
            try {
                data[file.name] = parser(contents)
            } catch (err) {
                throw new JsonDirParsingError(context.dataDir, filepath, err)
            }
        }
    }
    return data
}

async function loadDataArray(curDir: string, context: JsonDirContext): Promise<JsonDirData> {
    const data: JsonDirData = []

    //regular files in array directory will be ignored
    const itemDirs = (await promises.readdir(curDir, { withFileTypes: true }))
        .map(f => ({
            file: f,
            filepath: path.join(curDir, f.name),
            key: toInteger(f.name)
        }))
        //ignore excluded files and regular files
        .filter(f => !(context.excludeFile(f.filepath) || f.file.isFile()))
        .sort((a, b) => a.key < b.key ? -1 : 1)

    //check for mixed key types
    const dirsWithNumberKey = itemDirs.filter(f => typeof f.key == "number")
    const dirsWithStringKey = itemDirs.filter(f => typeof f.key == "string")
    if (dirsWithNumberKey.length > 0 && dirsWithStringKey.length > 0) {
        throw new JsonDirMixedKeyTypesError(context.dataDir, curDir, dirsWithNumberKey.map(x => x.file.name), dirsWithStringKey.map(x => x.file.name))
    }

    //check for duplicate keys (only possible for numeric keys, e.g. dirs "001" and "01")
    if (dirsWithNumberKey.length > 0) {
        const duplicates: string[][] = []

        const dups = Array.from(groupBy(itemDirs, f => f.key))
            .map((x) => ({ key: x[0], files: x[1] }))
        for (const dup of dups) {
            if (dup.files.length == 1) continue
            duplicates.push(dup.files.map(f => f.file.name))
        }

        if (duplicates.length > 0) {
            throw new JsonDirDuplicateKeyError(context.dataDir, curDir, duplicates)
        }
    }

    //load item directories
    for (const dir of itemDirs) {
        const item: any = {
            ...(await loadData(dir.filepath, context)),
            [context.arrayKeyDataProperty]: dir.key,
        }
        if (typeof dir.key == "number") {
            //only add $ARRAY_KEY_RAW if key is numeric
            item[context.arrayKeyRawDataProperty] = dir.file.name
        }

        data.push(item)
    }

    return data
}

function selectParser(filename: string, parsers: FileParser[]) {
    const lcFilename = filename.toLowerCase()
    for (const p of parsers) {
        if (lcFilename.endsWith(p.ext)) return p.parser
    }
    return (contents: string) => contents
}

function defaultParsers(): FileParser[] {
    return [
        { ext: "json", parser: JSON.parse },
        { ext: "jsonl", parser: jsonlParse }
    ]
}
//#endregion

//#region format check related

/**
 * Writes compiled format files to `checkDir`
 */
async function formatWrite(checkDir: string, cff: CompiledFormatFile[]) {
    //overwrite files
    for (const f of cff) {
        const p = path.join(checkDir, f.file)
        await promises.mkdir(path.dirname(p), { recursive: true })
        await promises.writeFile(p, f.contents)
    }
}

/**
 * Calls `tsc` to execute the compiled format files. The compiler
 * is invoked with the list of compiled format files as arguments.
 * 
 * @returns tsc exit return code
 */
function formatExecute(checkDir: string, cff: CompiledFormatFile[]) {
    const files = cff.map(x => x.file)
    const res = spawnSync("tsc", files.concat("--noEmit"), {
        cwd: checkDir,
        stdio: "inherit",
        windowsHide: true
    })
    return res.status
}

function formatCompile(data: JsonDirData, format: JsonDirFormat, context: FormatContext): CompiledFormatFile[] {
    const res: CompiledFormatFile[] = []

    const dataFilePath = (path: FlattenPath) => formatDataFilePath(path, data, context.arrayKeyDataProperty, context.arrayKeyRawDataProperty)

    const f = (format: JsonDirFormat, curPath: string[]): CompiledFormatFile[] => {
        const res: CompiledFormatFile[] = []

        for (const key in format) {
            const formatNode = format[key]
            if (typeof formatNode == "string") {
                const leafPath = key == "" ? structuredClone(curPath) : structuredClone(curPath.concat(key))
                const curData = flatten(data, leafPath)
                const tmplData = curData.map(x => ({ value: x.data, path: dataFilePath(x.path) }))
                const isArray = curData.length == 0 ? true : curData[0].isArray

                let compiledFile0 = leafPath
                if (key == "") compiledFile0.push(context.formatName)
                const compiledFile = compiledFile0.join("/") + tsExt

                res.push({
                    file: compiledFile,
                    contents: formatTmpl(formatNode, tmplData, isArray, arrayTypeSpecified(formatNode), isLaxFormatCheck(formatNode))
                })
            } else {
                res.push(...f(formatNode, curPath.concat(key)))
            }
        }

        return res
    }
    return f(format, [])
}

/**
 * Converts a JsonDirData path back to its file path by replacing 
 * array indices with $ARRAY_KEY or $ARRAY_KEY_RAW
 */
function formatDataFilePath(path: FlattenPath, data: JsonDirData, arrayKeyDataProperty: string, arrayKeyRawDataProperty: string): FlattenPath {
    const res: FlattenPath = []

    let cur = data as any
    for (let i = 0; i < path.length; i++) {
        const key = path[i]
        cur = cur[key]

        if (typeof key == "string") {
            //string key => object property
            res.push(key)
            continue
        } else {
            if (cur[arrayKeyRawDataProperty]) {
                res.push(cur[arrayKeyRawDataProperty])
            } else if (cur[arrayKeyDataProperty]) {
                res.push(cur[arrayKeyDataProperty])
            } else {
                res.push(key)
            }
        }
    }
    return res
}

function formatTmpl(format: string, data: { value: any, path: FlattenPath }[], isArray: boolean, isArrayTypeExists: boolean, lax: boolean) {
    const isArrayType = isArrayTypeExists ? "IsArray" : "boolean"

    let res = "export {}\n"
    res += format + "\n\n"
    res += `const isArray : ${isArrayType} = ${JSON.stringify(isArray)}\n`
    res += "const x : Record<string, Format> = {}\n"
    for (const x of data) {
        if (!lax) {
            res += `x["${x.path.join("/")}"] = ${JSON.stringify(x.value, null, 4)}\n`
        } else {
            res += "{\n"
            res += `const y = ${JSON.stringify(x.value, null, 4)}\n`
            res += `x["${x.path.join("/")}"] = y\n`
            res += "}\n"
        }
    }
    return res
}

function isLaxFormatCheck(contents: string) {
    // use "//!GTS:LAX" at beginning of format file
    //const re = /^\s*\/\/\!GTS:LAX/
    const re = /^\s*\/\/\!GTS:LAX[ \t]*\n/
    return contents.match(re) != null
}

/**
 * Checks if `type IsArray = (true|false)` is defined in the format file
 */
function arrayTypeSpecified(contents: string) {
    const re = /^type[ \t]+IsArray[ \t]*=[ \t]*(true|false)[ \t]*$/m
    return contents.match(re) != null
}
//#endregion

//#region helpers
type FlattenPath = (string | number)[]
type FlattenItem = { path: FlattenPath, data: any, isArray: boolean }
function flatten(data: JsonDirData, path: string[], curPath?: FlattenPath): FlattenItem[] {
    curPath ??= []

    if (path.length == 0) {
        return Array.isArray(data)
            ? data.map((x, i) => ({ data: x, path: curPath.concat([i]), isArray: true }))
            : [{ data: data, path: curPath, isArray: false }]
        //return [{ data: data, path: curPath }]
    }

    const key = path[0]
    if (Array.isArray(data)) {
        const res: any[] = []

        for (const [index, el] of data.entries()) {
            if (Object.hasOwn(el, key)) {
                const newCurPath = curPath.concat([index, key])
                res.push(...flatten(el[key], path.slice(1), newCurPath))
            }
        }
        return res.flat(1)
    } else {
        return Object.hasOwn(data, key)
            ? [flatten(data[key], path.slice(1), curPath.concat(key))].flat(1)
            : []
    }
}

function jsonlParse(x: string) {
    const lines = x.split("\n")
    const res: any[] = []
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        if (line == "") continue
        try {
            res.push(JSON.parse(line))
        } catch (e) {
            throw new Error("Failed to parse JSON on line " + (i + 1) + ": " + (e as Error).message)
        }

    }
    return res
}

function groupBy<T extends any, S extends string | number>(items: T[], groupKey: (x: T) => S): Map<S, T[]> {
    const res = new Map<S, T[]>()
    for (const x of items) {
        const group = groupKey(x)
        const g = res.get(group)
        if (g == undefined) {
            res.set(group, [x])
        } else {
            g.push(x)
        }
    }
    return res
}

/**
 * If `str` is a non-negative integer then this integer is 
 * returned, otherwise `str` is returned.
 */
function toInteger(str: string) {
    return isNonNegativeInteger(str) ? parseInt(str, 10) : str
}

function isNonNegativeInteger(x: string) {
    const re = /^0*\d+$/
    return x.match(re) !== null
}
//#endregion

//#region error classes
class JsonDirError extends Error {
    readonly dataDir: string

    constructor(dataDir: string, message: string) {
        super(message)
        this.dataDir = dataDir
    }
}

class JsonDirParsingError extends JsonDirError {
    readonly name = "JsonDirParsingError"
    readonly file: string
    readonly parsingError: unknown

    constructor(dataDir: string, file: string, parsingError: unknown) {
        super(dataDir, `Failed to parse file '${file}':\n${errorToString(parsingError)}`)
        this.file = file
        this.parsingError = parsingError

    }
}

class JsonDirMixedKeyTypesError extends JsonDirError {
    readonly name = "JsonDirMixedKeyTypesError"
    readonly dir: string
    readonly filesWithNumberKey: string[]
    readonly filesWithStringKey: string[]

    constructor(dataDir: string, dir: string, filesWithNumberKey: string[], filesWithStringKey: string[]) {
        super(dataDir, `Directory '${dir}' has some files with a numeric key and some with a string key.\nFiles with numeric key:\n${filesWithNumberKey.join("\n")}\n\nFiles with string key:\n${filesWithStringKey.join("\n")}`)
        this.dir = dir
        this.filesWithNumberKey = filesWithNumberKey
        this.filesWithStringKey = filesWithStringKey

    }
}

class JsonDirDuplicateKeyError extends JsonDirError {
    readonly name = "JsonDirDuplicateKeyError"
    readonly dir: string
    readonly duplicates: string[][]

    constructor(dataDir: string, dir: string, duplicates: string[][]) {
        super(dataDir, `Directory '${dir}' has files with identical key and filename pattern:\n${JSON.stringify(duplicates, null, 2)}`)
        this.dir = dir
        this.duplicates = duplicates
    }
}
//#endregion

//#region test & test data
async function test() {
    const options: JsonDirOptions = {
        customParsers: [{
            ext: ".mhtml",
            parser: (x: string) => x.split("\n<!-- NEXT ITEM -->\n")
        }],
        formatDir: "format",
        checkDir: "check2"
    }
    const res = await jsonDir("data", options) as JsonDirChecked

    if (!res.valid) {
        console.log("jsonDir(): invalid")
        return
    }
    console.log("jsonDir():\n%s", JSON.stringify(res.data, null, 4))
}