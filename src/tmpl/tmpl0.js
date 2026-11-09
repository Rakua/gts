//$COMPILE_DATE
export { tmpl, TmplDataError, TmplDataNotAnArrayError }


function tmpl(tmplName, tmplData, preferred) {
    return tmpl0(tmplName + "/0", tmplData, preferred, [])
}

function tmpl0(tmplNameWithPos, tmplData, preferred, curPath) {
    const tmplName = tmplNameWithPos.slice(0, tmplNameWithPos.lastIndexOf("/"))
    const defaultVal = (x,defVal) => x.length==0 ? [defVal] : x
    const transformVal = (keyPath, pos, f) => f(data(keyPath, pos))
    const data = function (keyPath, pos, flag) {
        const unsafe = flag === 0
        const shouldBeArray = flag === 1
        const absPath = curPath.concat(keyPath)
        const cutAt = absPath.lastIndexOf(null)
        const pathWoNull = cutAt == -1 ? absPath : absPath.slice(cutAt + 1)
        const path = pathWoNull.reduce((p, x) =>
            (typeof x == "string" || (typeof x == "number" && x >= 0)) ? p.concat(x) : p.slice(0, x), [])
                
        let d = tmplData
        for (let i = 0; i < path.length; i++) {
            d = d[path[i]]
            if (i == path.length - 1) {
                if (shouldBeArray && !Array.isArray(d)) throw new TmplDataNotAnArrayError(path, tmplName, pos)
                if (d === undefined) {
                    if (unsafe) return undefined
                    throw new TmplDataError(path, path, tmplName, pos)
                }
            } else {
                if (typeof d != "object" || d === null) {
                    if (unsafe) return undefined
                    throw new TmplDataError(path.slice(0, i + 1), path, tmplName, pos)
                }
            }
        }
        return d
    }

    switch (tmplNameWithPos) {        
//$RETURNS
        default: throw new Error("unknown template name " + JSON.stringify(tmplName))
    }
}

function escapeHtml(str) {
    const escape = {
        '&': "&amp;",
        '"': "&quot;",
        '\\\'': "&apos;",
        '<': "&lt;",
        '>': "&gt;"
    }
    if (typeof str != "string") str = JSON.stringify(str)
    return str.replace(/[&"'<>]/g, c => escape[c])
}

class TmplDataError extends Error {
    constructor(pathToProblem, path, tmplName, pos) {
        if (JSON.stringify(pathToProblem) == JSON.stringify(path)) {
            super(`tmplData${pathToArrayCode(path)} is undefined in template ${JSON.stringify(tmplName)} at position ${pos}.`)
        } else {
            super(`tmplData${pathToArrayCode(path)} missing in template ${JSON.stringify(tmplName)} at position ${pos} (tmplData${pathToArrayCode(pathToProblem)} is undefined, not an object or null)`)
        }

        this.name = "TmplDataError"
        this.pathToUndefined = pathToProblem
        this.path = path
        this.tmplName = tmplName
        this.pos = pos
    }
}

class TmplDataNotAnArrayError extends Error {
    constructor(path, tmplName, pos) {
        super(`tmplData${pathToArrayCode(path)} is not an array in template ${JSON.stringify(tmplName)} at position ${pos}.`)
        this.name = "TmplDataNotAnArrayError"
        this.path = path
        this.tmplName = tmplName
        this.pos = pos
    }
}

function pathToArrayCode(path) {
    return path.map(x => `[${JSON.stringify(x)}]`).join("")
}