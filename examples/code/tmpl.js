export { tmpl, TmplDataError, TmplDataNotAnArrayError, TmplNotFoundError }


const tsd = "«"
const ted = "»"

function tmpl(tmplName, tmplData, preferred) {
    tmplData["$TMPL_NAME"] = tmplName
    tmplData["$PREFERRED"] = preferred
    return tmpl0(tmplName + "/0", tmplData, preferred, [])
}

function tmpl0(tmplNameWithPos, tmplData, preferred, curPath) {
    const tmplNames = ["fx","indent","line","newline","while_line"]
    const exts = ["js"]

    const tmplName = tmplNameWithPos.slice(0, tmplNameWithPos.lastIndexOf("/"))
    const tmplPos = tmplNameWithPos.slice(tmplNameWithPos.lastIndexOf("/"))
    const ext = '.' + exts.find(x => tmplName.endsWith(x))
    const base = tmplName.slice(0, -1 * ext.length)
    const prefName = exts.length == 1 ? tmplName + "." + preferred : base + "." + preferred + ext
    const selName = preferred && tmplNames.includes(prefName) ? prefName : tmplName
    tmplNameWithPos = selName + tmplPos

    const defaultVal = (x, defVal) => x.length == 0 ? [defVal] : x
    const defaultCmp = x => x !== undefined && x !== false
    const transformVal = function (keyPath, pos, f) {
        let d = data(keyPath, pos)
        if (typeof d == "function") {
            const p = data(keyPath[keyPath.length - 2], pos)
            d = keyPath.length > 1 && isClassObject(p) ? d.bind(p)() : d()
        }
        return f(d)
    }
    const vtpl = function (vtplPath, pos) {
        const tn = vtplPath.map(x => typeof x == "string" ? x : data(x, pos)).join("")
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
        case "fx"+"/"+0: return (defaultCmp(data(["fxDescription"],0,0)) ? "//"+transformVal(["fxDescription"],20,x=>x)+tmpl0("newline"+"/0", tmplData, preferred, curPath) : "" )+''+"function f(x) {\n    if(x == 1) return null"+''+tmpl0("newline"+"/0", tmplData, preferred, curPath)+tmpl0("fx" + "/" + 143, tmplData, preferred, curPath.concat(["initLine"]))+"\n    while(true) {"+''+tmpl0("newline"+"/0", tmplData, preferred, curPath)+tmpl0("while_line"+"/0", tmplData, preferred, curPath)+''+"    }\n}"
        case "fx"+"/"+143: return tmpl0("line"+"/0", tmplData, preferred, curPath)
        case "indent"+"/"+0: return ''+''+""+defaultVal(data(["indentLevel"],112,1).map((x_,i) => tmpl0("indent"+"/"+140,tmplData,preferred,curPath.concat(["indentLevel"],i))),"").join("")
        case "indent"+"/"+140: return "    "
        case "line"+"/"+0: return tmpl0("indent"+"/0", tmplData, preferred, curPath)+transformVal(["content"],12,x=>x)+" //indentLevel = "+transformVal(["indentLevel"],42,x=>JSON.stringify(x))
        case "newline"+"/"+0: return "\n"
        case "while_line"+"/"+0: return defaultVal(data(["multipleLines","lines"],0,1).map((x_,i) => tmpl0("while_line"+"/"+26,tmplData,preferred,curPath.concat(["multipleLines","lines"],i))),""+tmpl0("while_line" + "/" + 158, tmplData, preferred, curPath.concat([null,"multipleLines"]))+"//nothing to see here"+tmpl0("newline"+"/0", tmplData, preferred, curPath)+''+"").join("")
        case "while_line"+"/"+26: return ""+tmpl0("while_line" + "/" + 34, tmplData, preferred, curPath.concat([-2]))+tmpl0("line"+"/0", tmplData, preferred, curPath)+tmpl0("newline"+"/0", tmplData, preferred, curPath)+''+""
        case "while_line"+"/"+158: return tmpl0("indent"+"/0", tmplData, preferred, curPath)
        case "while_line"+"/"+34: return tmpl0("indent"+"/0", tmplData, preferred, curPath)
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

function posCmd(tmplName, pos) {
    return `gts offset tmpl/${tmplName} ${pos}`
}

class TmplDataError extends Error {
    constructor(pathToProblem, path, tmplName, pos) {
        if (JSON.stringify(pathToProblem) == JSON.stringify(path)) {
            super(`tmplData${pathToArrayCode(path)} is undefined in template ${JSON.stringify(tmplName)} at offset ${pos}`)
        } else {
            super(`tmplData${pathToArrayCode(path)} missing in template ${JSON.stringify(tmplName)} at offset ${pos} (tmplData${pathToArrayCode(pathToProblem)} is undefined, not an object or null)`)
        }

        this.name = "TmplDataError"
        this.pathToUndefined = pathToProblem
        this.path = path
        this.tmplName = tmplName
        this.pos = pos
        this.posCmd = posCmd(this.tmplName, this.pos)
    }
}

class TmplDataNotAnArrayError extends Error {
    constructor(path, tmplName, pos) {
        super(`tmplData${pathToArrayCode(path)} is not an array in template ${JSON.stringify(tmplName)} at offset ${pos}`)
        this.name = "TmplDataNotAnArrayError"
        this.path = path
        this.tmplName = tmplName
        this.pos = pos
        this.posCmd = posCmd(this.tmplName, this.pos)
    }
}

class TmplNotFoundError extends Error {
    constructor(tmplName, refTmplName, pos) {
        if (refTmplName == undefined) {
            super(`template ${JSON.stringify(tmplName)} not found`)
        } else {
            super(`template ${JSON.stringify(tmplName)} referenced in template ${JSON.stringify(refTmplName)} at offset ${pos} not found`)
        }

        this.name = "TmplNotFoundError"
        this.tmplName = tmplName
        this.refTmplName = refTmplName
        this.pos = pos
        this.posCmd = posCmd(this.refTmplName, this.pos)
    }
}