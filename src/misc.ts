export { parseCliArguments, redText, cut, applyIf, removeTrailingSlash, offsetPosition, escapeRegExp, errorToString }

import * as path from 'node:path'

type CliArguments = {
    input: string //first argument
    argument: Record<string, string | null>
}
function parseCliArguments(args: string[], argumentKeys: string[]): CliArguments {
    if (args.length == 0) throw Error("no arguments")

    const res: CliArguments = {
        input: args.shift()!,
        argument: {}
    }

    for (const arg of args) {
        if (!arg.includes("="))
            throw new Error(`Argument ${arg} does not contain '='`)

        const x = arg.split("=")
        if (x.length != 2) throw new Error(`Argument does not contain exactly one '=': ${arg}`)

        const [key, val] = x
        if (!argumentKeys.includes(key))
            throw new Error(`Unknown argument key '${key}' in: ${arg}`)
        if (Object.hasOwn(res.argument, key)) {
            throw new Error(`Argument key '${key}' occurs more than once`)
        }

        res.argument[key] = val == "" ? null : val
    }
    return res
}

function relativePath(file: string, relPath: string) {
    return path.resolve(file).slice(path.resolve(relPath).length + 1)
}

/**
 * If the target output is specified the color code is only used 
 * if the target is a TTY (output to console)
 */
function redText(txt: string, target?: "stderr" | "stdout") {
    if (target && !process[target].isTTY) return txt
    return `\x1b[31m${txt}\x1b[0m`
}

//https://esdiscuss.org/topic/regexp-escape#content-7
function escapeRegExp(str: string) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&")
}

function cut(str: string, separator: string): [string, string] {
    const i = str.indexOf(separator)
    if (i == -1) return [str, ""]
    return [str.slice(0, i), str.slice(i + separator.length)]
}

function applyIf<T>(cond: boolean, f: (a: T) => T, x: T): T {
    return cond ? f(x) : x
}

function removeTrailingSlash(str: string) {
    return str.endsWith('/') ? str.slice(0, -1) : str
}

/**
 * @param offset 0-based offset of character in `str`
 * @returns 1-based line no. and column of `offset` in `str`
 */
function offsetPosition(str: string, offset: number): { line: number, column: number } {
    const prefix = str.slice(0, offset)
    const lines = prefix.split("\n")
    return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
    }
}

function errorToString(e: unknown) {
    return e instanceof Error ? e.message : JSON.stringify(e, null, 2)
}