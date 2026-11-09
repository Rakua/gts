export { tmpl, TmplDataError, TmplDataNotAnArrayError, TmplNotFoundError }


const tsd = "«"
const ted = "»"

function tmpl(tmplName, tmplData, preferred) {
    tmplData["$preferred"] = preferred
    return tmpl0(tmplName + "/0", tmplData, preferred, [])
}

function tmpl0(tmplNameWithPos, tmplData, preferred, curPath) {
    const tmplNames = ["css/general.css","css/main.css","css/main.m.css","footer.html","index.html","optimized.html","optimized.m.html"]
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
        case "css/general.css"+"/"+0: return "/* styles that apply to both desktop and mobile version */\nh1 {\n    text-align: center;\n}\n"
        case "css/main.css"+"/"+0: return "body {\n    background-color: antiquewhite;\n}\n\nfooter {\n    text-align: center;\n}"
        case "css/main.m.css"+"/"+0: return "body {\n    background-color: aquamarine;\n}\n\nfooter {\n    text-align: right;\n}"
        case "footer.html"+"/"+0: return "<footer>(c) 2024 by somebody "+tsd+tmpl0("optimized.html"+"/0", tmplData, preferred, curPath)+ted+"</footer>"
        case "index.html"+"/"+0: return "<!DOCTYPE html>\n<html>\n\n<head>\n    <title>"+transformVal(["title"],42,x=>escapeHtml(''+x))+"</title>\n    <style>\n        "+tmpl0("css/general.css"+"/0", tmplData, preferred, curPath)+"        \n        "+tmpl0("css/main.css"+"/0", tmplData, preferred, curPath)+"\n    </style>\n</head>\n\n<body>\n    <h1>"+transformVal(["name"],176,x=>escapeHtml(''+x))+"</h1>\n    <div>\n\n    </div>\n    "+tmpl0("footer.html"+"/0", tmplData, preferred, curPath)+"\n</body>\n\n</html>"
        case "optimized.html"+"/"+0: return "optimized for desktop (default device)"
        case "optimized.m.html"+"/"+0: return "optimized for mobile"
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