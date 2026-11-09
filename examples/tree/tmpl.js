export { tmpl, TmplDataError, TmplDataNotAnArrayError, TmplNotFoundError }


const tsd = "«"
const ted = "»"

function tmpl(tmplName, tmplData, preferred) {
    tmplData["$preferred"] = preferred
    return tmpl0(tmplName + "/0", tmplData, preferred, [])
}

function tmpl0(tmplNameWithPos, tmplData, preferred, curPath) {
    const tmplNames = ["a.html","b.html","index.html","tree.html","tree.html"]
    const exts = ["html","css"]

    const tmplName = tmplNameWithPos.slice(0, tmplNameWithPos.lastIndexOf("/"))
    const tmplPos = tmplNameWithPos.slice(tmplNameWithPos.lastIndexOf("/"))
    const ext = '.' + exts.find(x => tmplName.endsWith(x))
    const base = tmplName.slice(0, -1 * ext.length)
    const prefName = exts.length == 1 ? tmplName + "." + preferred : base + "." + preferred + ext
    const selName = tmplNames.includes(prefName) ? prefName : tmplName
    tmplNameWithPos = selName + tmplPos

    const defaultVal = (x, defVal) => x.length == 0 ? [defVal] : x
    const defaultCmp = x => x !== undefined && x !== false
    const transformVal = function (keyPath, pos, f) {
        let d = data(keyPath, pos)
        if (typeof d == "function") {
            const p = data(keyPath[keyPath.length - 2],pos)
            d = keyPath.length > 1 && isClassObject(p) ? d.bind(p)() : d()
        }
        return f(d)
    }
    const vtpl = function (keyPath, pos) {
        const tn = data(keyPath, pos)
        if (!tmplNames.includes(tn)) throw new TmplNotFoundError(tn, tmplName, pos)
        return tn + "/0"
    }
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
                if (shouldBeArray && !Array.isArray(d)) throw new TmplDataNotAnArrayError(path, selName, pos)
                if (d === undefined) {
                    if (unsafe) return undefined
                    throw new TmplDataError(path, path, selName, pos)
                }
            } else {
                if (typeof d != "object" || d === null) {
                    if (unsafe) return undefined
                    throw new TmplDataError(path.slice(0, i + 1), path, selName, pos)
                }
            }
        }
        return d
    }

    switch (tmplNameWithPos) {
        case "a.html"+"/"+0: return "A template"
        case "b.html"+"/"+0: return "B template"
        case "index.html"+"/"+0: return "<!DOCTYPE html>\n<html>\n<head>\n    <title>Tree</title>\n</head>\n\n<body>\n<h1>"+tmpl0(vtpl(["varTmpl"],74), tmplData, preferred, curPath)+"</h1>\n"+tmpl0("tree.html"+"/0", tmplData, preferred, curPath)+"\n</body>\n\n</html>"
        case "tree.html"+"/"+0: return "<ul>\n    <li>\n        "+transformVal(["label"],22,x=>escapeHtml(''+x))+defaultVal(data(["children"],33,1).map((x_,i) => tmpl0("tree.html"+"/"+48,tmplData,preferred,curPath.concat(["children"],i))),"").join("")+"\n    </li>\n</ul>"
        case "tree.html"+"/"+48: return "        "+tmpl0("tree.html"+"/0", tmplData, preferred, curPath)
        default: throw new TmplNotFoundError(tmplName)
}
}

function isClassObject(obj) {
    return typeof obj === 'object' && obj !== null && Object.getPrototypeOf(obj) !== Object.prototype
}

function escapeHtml(str) {
    const escape = {
        '&': "&amp;",
        '"': "&quot;",
        '\'': "&apos;",
        '<': "&lt;",
        '>': "&gt;"
    }
    if (typeof str != "string") str = JSON.stringify(str)
    return str.replace(/[&"'<>]/g, c => escape[c])
}

function pathToArrayCode(path) {
    return path.map(x => `[${JSON.stringify(x)}]`).join("")
}

class TmplDataError extends Error {
    constructor(pathToProblem, path, tmplName, pos) {
        if (JSON.stringify(pathToProblem) == JSON.stringify(path)) {
            super(`tmplData${pathToArrayCode(path)} is undefined in template ${JSON.stringify(tmplName)} at position ${pos}`)
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
        super(`tmplData${pathToArrayCode(path)} is not an array in template ${JSON.stringify(tmplName)} at position ${pos}`)
        this.name = "TmplDataNotAnArrayError"
        this.path = path
        this.tmplName = tmplName
        this.pos = pos
    }
}

class TmplNotFoundError extends Error {
    constructor(tmplName, refTmplName, pos) {
        if (refTmplName == undefined) {
            super(`template ${JSON.stringify(tmplName)} not found`)
        } else {
            super(`template ${JSON.stringify(tmplName)} referenced in template ${JSON.stringify(refTmplName)} at position ${pos} not found`)
        }

        this.name = "TmplNotFoundError"
        this.tmplName = tmplName
        this.refTmplName = refTmplName
        this.pos = pos
    }
}