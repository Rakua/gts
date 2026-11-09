export { translate }

import * as d from './data'


function translate(tplTmplStr: string, tmplData: d.TemplateData): string {
    const returns = tmplData.templates.map(function (t) {
        return tplReturn(t.tmplName, t.position, expression(t, t.tmplName))
    })

    return tplTmpl(tplTmplStr, tmplData.compileDate, returns)
}

function expression(pt: d.ParseTree, tmplName: string) {
    return pt.children.map((t) => term(t, tmplName)).join("+")
}

function term(ptn: d.ParseTreeNode, tmplName: string) {
    switch (ptn.type) {
        case "string":
            return JSON.stringify(ptn.contents)

        case d.TagName.Val:
            return `escapeHtml(''+data(${JSON.stringify(ptn.path)},${ptn.tag.position}))`

        case d.TagName.Raw:
            return `''+data(${JSON.stringify(ptn.path)},${ptn.tag.position})`

        case d.TagName.Json:
            return `JSON.stringify(data(${JSON.stringify(ptn.path)},${ptn.tag.position}))`

        case d.TagName.Tpl:
            return `tmpl0(${JSON.stringify(ptn.tag.args[0] + "/0")}, tmplData, preferred, curPath)`

        case d.TagName.Cd:
            return `tmpl0(${JSON.stringify(ptn.children[0].tmplName + "/" + ptn.children[0].position)}, tmplData, preferred, curPath.concat(${JSON.stringify(ptn.path)}))`

        case d.TagName.If: {
            let res = ""
            for (let i = 0; i < ptn.children.length; i++) {
                const spt = ptn.children[i]
                if (spt.ifInfo!.type === d.TagName.Else) {
                    res += expression(spt, tmplName)
                } else {
                    const kc = JSON.stringify(spt.ifInfo!.path)
                    const cmp = (spt.ifInfo!.comparison === null
                        ? `data(${kc},${spt.ifInfo!.tagPosition},0) !== undefined`
                        : `data(${kc},${spt.ifInfo!.tagPosition}) ${spt.ifInfo!.comparison.operator} ${spt.ifInfo!.comparison.literal}`)
                    res += `(${cmp} ? ${expression(spt, tmplName)} : `
                }
            }
            res += ")".repeat(ptn.children.length - 1) //add closing parentheses; -1 because no ')' needed for else branch
            return res
        }

        case d.TagName.Loop: {
            const kc = JSON.stringify(ptn.path)
            const sep: string = expression(ptn.children[1], tmplName)
            const empty: string = expression(ptn.children[2], tmplName)
            return `defaultVal(data(${kc},${ptn.tags[0].position},1).map((x_,i) => tmpl0(${JSON.stringify(tmplName + "/" + ptn.children[0].position)},tmplData,preferred,curPath.concat(${kc},i))),${empty}).join(${sep})`
        }

        default:
            return "''" //comment and trim
    }
}

function tplReturn(name: string, pos: number, expr: string) {
    return `        case ${JSON.stringify(name + "/" + pos)}: return ${expr}`
}

function tplTmpl(tmpl: string, compileDate: string, returns: string[]) {
    tmpl = tmpl.replace("//$COMPILE_DATE", "// compiled at " + compileDate)
    tmpl = tmpl.replace("//$RETURNS", returns.join("\n"))
    return tmpl
}