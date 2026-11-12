export { compile }

import * as d from './data.js'
import * as e from './errors.js'
import { applyIf, cut, escapeRegExp, offsetPosition, redText } from './misc.js'


function compile(tmplFiles: d.FileMap, tagStart?: string, tagEnd?: string): d.ParseTree[] {
    if (tagStart == undefined) tagStart = d.defaults.tagStart
    if (tagEnd == undefined) tagEnd = d.defaults.tagEnd
    const pathSeparator = d.defaults.pathSeparator

    e.setTagDelimiters(tagStart, tagEnd)
    const templates: d.ParseTree[] = []

    const errs = []
    for (const tmplName in tmplFiles) {
        try {
            templates.push(toParseTree(tmplName, tmplFiles[tmplName], tagStart, tagEnd, pathSeparator))
        } catch (err) {
            if (err instanceof Error) {
                const err0 = err as any
                let pos: null | number = null
                if (err0.pos !== undefined) {
                    pos = err0.pos
                } else if (err0.tag !== undefined) {
                    pos = err0.tag.position
                }

                if (pos != null) {
                    const lc = offsetPosition(tmplFiles[tmplName], pos)
                    const err1 = new Error(`Failed to parse template ${redText(tmplName, "stderr")} (line ${lc.line}, column: ${lc.column}): ${err.message}`, { cause: err })
                    errs.push(err1)
                } else {
                    const err1 = new Error(`Failed to parse template ${tmplName}: ${err.message}`, { cause: err })
                    errs.push(err1)
                }
            }
        }
    }
    if (errs.length > 0) {
        if (errs.length == 1) {
            throw errs[0]
        } else {
            throw new Error("Multiple parsing errors found:\n" + (errs.map(x => x.message).join("\n")), { cause: errs })
        }
    }
    calledTemplatesExist(templates)

    const outlinedTemplates = templates.map(outline).reduce((x, y) => x.concat(y))
    return outlinedTemplates
}

//outline first child parse tree of each loop, cd and vcd as if they were separate templates
function outline(pt: d.ParseTree): d.ParseTree[] {
    const tmplName = pt.tmplName
    const res = [pt]

    const extractTrees = function (ptn: d.ParseTreeNode) {
        if (ptn.type == d.TagName.Loop) {
            res.push(ptn.children[0])
            //recurse on sep branch
            ptn.children.slice(1).map(c => c.children.map(extractTrees))
        }
        if (ptn.type == d.TagName.Cd || ptn.type == d.TagName.Vcd) {
            res.push(ptn.children[0])
        }
        if (ptn.type == d.TagName.If) {
            ptn.children.map(c => c.children.map(extractTrees))
        }
        //ignore single tags
        return ptn
    }

    let i = 0
    while (true) {
        res[i].children.map(extractTrees)
        i++
        if (i >= res.length) break //no new elements added to res        
    }

    return res
}

function calledTemplatesExist(templates: d.ParseTree[]) {
    const tmplNames = templates.map(t => t.tmplName)
    const check = function (t: d.ParseTree) {
        for (const ptn of t.children) {
            if (ptn.type == d.TagName.Tpl) {
                const name = ptn.tag.args[0]
                if (!tmplNames.includes(name)) {
                    throw new e.TplDoesNotExistError(ptn.tag, t.tmplName)
                }
            } else if (d.tagGroups.openingTags.includes(ptn.type as d.TagName)) {
                const ptn1 = ptn as d.ParseTreeNodeComplexTag
                ptn1.children.map(check)
            }
        }
    }

    for (const template of templates) {
        check(template)
    }
}

function toParseTree(tmplName: string, contents: string, tagStart: string, tagEnd: string, pathSeparator: string): d.ParseTree {
    syntaxCheck(contents, tagStart, tagEnd)
    const tokens = tokenize(contents, tagStart, tagEnd)
    const pt = parse(tmplName, tokens, pathSeparator)
    return augment(pt, pathSeparator)
}

function augment(parseTree: d.ParseTree, pathSeparator: string, ifInfo?: d.ParseTreeIfData): d.ParseTree {
    const hasFlag = (tag: d.Tag, flag: d.Flag) => tag.args.slice(1).includes(flag)
    const removeFlags = (args: string[]): string[] =>
        args.filter(arg => !(Object.values(d.Flag) as string[]).includes(arg))


    const trimEndLit = function (ptn: d.ParseTreeNode) {
        if (ptn.type == "string") {
            const lines = ptn.contents.split("\n")
            if (lines[lines.length - 1].trim() == "") lines.pop()
            ptn.contents = lines.join("\n")
        }
    }
    const trimStartLit = function (ptn: d.ParseTreeNode) {
        if (ptn.type == "string") {
            const lines = ptn.contents.split("\n")
            if (lines[0].trim() == "") lines.shift()
            ptn.contents = lines.join("\n")
        }
    }

    //removes first and last line in parseTree if they contain only whitespace
    //don't trim if parseTree is only a singe string node without line breaks
    const trimParseTree = function (parseTree: d.ParseTree): d.ParseTree {
        if (parseTree.children.length == 0 ||
            (parseTree.children.length == 1 && parseTree.children[0].type == "string"
                && !parseTree.children[0].contents.includes("\n"))) {
            return parseTree
        }

        const firstChild = parseTree.children[0]
        const lastChild = parseTree.children[parseTree.children.length - 1]

        trimStartLit(firstChild)
        trimEndLit(lastChild)

        return parseTree
    }

    //tag = if/elseif/else
    const parseTreeIfData = function (tag: d.Tag): d.ParseTreeIfData {
        const computeComparison = function (tag: d.Tag): null | d.ParseTreeIfDataComparison {
            //remove flags if if-tag        
            const args = applyIf(tag.name == d.TagName.If, removeFlags, tag.args)
            if (args.length == 2 || args.length > 3) throw new e.WrongArgCountIfError(tag)
            if (args.length == 1) return null //no comparison (only key given as argument)

            const cop = d.toComparisonOperator(args[1])
            if (cop == null) throw new e.IllegalComparisonOperatorError(tag, args[1])
            return { operator: cop, literal: parseArgLiteral(args[2], tag, false) }
        }

        if (tag.name == d.TagName.Else) {
            return { type: d.TagName.Else }
        } else {
            //tag.Name = if or elseif
            return {
                type: d.TagName.If,
                path: keyToDataPath(tag.args[0], pathSeparator),
                comparison: tag.args.length == 1 ? null : computeComparison(tag),
                tagPosition: tag.position
            }
        }
    }

    const process = function (ptn: d.ParseTreeNode): d.ParseTreeNode {
        const emptyPt = (ifInfo?: d.ParseTreeIfData) => ({
            position: -1,
            children: [d.newParseTreeNodeLiteral("")],
            ifInfo: ifInfo
        } as d.ParseTree)
        const emptyTag = (tagName: d.TagName) => ({
            name: tagName,
            args: [],
            position: -1,
            afterTagPosition: -1,
            contents: ""
        } as d.Tag)

        //do not modify nodes that do not contain child ParseTrees
        if (ptn.type == "string" || d.tagGroups.singleTags.includes(ptn.type))
            return ptn

        ptn = ptn as d.ParseTreeNodeComplexTag

        //trim complex tags unless verbatim flag is contained in opening tag
        const shouldTrim = !hasFlag(ptn.tags[0], d.Flag.Verbatim)
        ptn.children = ptn.children
            .map(pt => applyIf(shouldTrim, trimParseTree, pt))

        //ensure that every ParseTree contains at least one ParseTreeNode
        for (const c of ptn.children) {
            if (c.children.length == 0) c.children.push(d.newParseTreeNodeLiteral(""))
        }

        //recursively augment and add ifInfo for if tag
        if (ptn.type == d.TagName.If) {
            for (let i = 0; i < ptn.children.length; i++) {
                const tag = ptn.tags[i]
                const isFinal = i == ptn.children.length - 1
                const ifInfo = parseTreeIfData(tag)
                ptn.children[i] = augment(ptn.children[i], pathSeparator, ifInfo)
            }
            //ensure that if contains else part
            const last = ptn.children.length - 1
            if (ptn.tags[last].name != d.TagName.Else) {
                const endIf = ptn.tags.pop()
                ptn.tags.push(emptyTag(d.TagName.Else), endIf!)
                ptn.children.push(emptyPt({ type: d.TagName.Else }))
            }
        } else {
            ptn.children = ptn.children.map(pt => augment(pt, pathSeparator, undefined))
        }

        //ensure that loop contains sep and empty part
        if (ptn.type == d.TagName.Loop) {
            const name1 = ptn.tags[1].name
            if (ptn.children.length == 3) {
                //already contains sep and empty, nothing to do
            } else if (ptn.children.length == 1) {
                //add sep and empty
                const endLoop = ptn.tags.pop()!
                ptn.tags.push(emptyTag(d.TagName.Sep), emptyTag(d.TagName.Empty), endLoop)
                ptn.children.push(emptyPt())
                ptn.children.push(emptyPt())
            } else if (name1 == d.TagName.Sep) {
                //add empty tag
                ptn.tags.splice(2, 0, emptyTag(d.TagName.Empty))
                ptn.children.push(emptyPt())
            } else if (name1 == d.TagName.Empty) {
                //add sep tag
                ptn.tags.splice(1, 0, emptyTag(d.TagName.Sep))
                ptn.children.splice(1, 0, emptyPt())
            } else {
                throw new Error("this should not have happened; code expected previous branch to be true")
            }
        }

        return ptn
    }

    const trimSiblings = function (pt: d.ParseTree): d.ParseTree {
        for (let i = 0; i < pt.children.length; i++) {
            const curChild = pt.children[i]
            const prevChild: (d.ParseTreeNode | undefined) = pt.children[i - 1]
            const nextChild: (d.ParseTreeNode | undefined) = pt.children[i + 1]
            if (curChild.type == d.TagName.Trim) {
                if (prevChild) trimEndLit(prevChild)
                if (nextChild) trimStartLit(nextChild)
            }

            if (curChild.type == d.TagName.If || curChild.type == d.TagName.Loop || curChild.type == d.TagName.Comment) {
                curChild.children = curChild.children.map(trimSiblings)
            }
        }
        return pt
    }

    parseTree.children = parseTree.children.map(process)
    parseTree = trimSiblings(parseTree)
    parseTree.ifInfo = ifInfo
    return parseTree
}

function parse(tmplName: string, tokens: d.Token[], pathSeparator: string): d.ParseTree {
    type ParseRec = { parseTree: d.ParseTree, remainingTokens: d.Token[] }
    type ParseComplexTag = { parseTreeNode: d.ParseTreeNodeComplexTag, remainingTokens: d.Token[] }

    //note: a constant value for emptyParseTree would cause a circular ref in parseTree
    const emptyParseTree = (pos: number) => ({ tmplName: tmplName, position: pos, children: [] } as d.ParseTree)

    //todo: replace parseLoop and parseIf with
    // parseIf = parseGen([[TagName.If,null],[TagName.ElseIf,Star],[TagName.Else,Optional],[TagName.EndIf,null]])
    // parseLoop = parseGen([[TagName.Loop,null],[TagName.Sep,Opt],[TagName.Empty,Optl],[TagName.EndLoop,null]])
    /*type ParseFunc = (tokens: d.Token[]) => ParseComplexTag
    const parseGen = function(grammar: [string,string][]) : ParseFunc {
        return 
    }*/

    // parseIf = If ElseIf* Else? /If
    // parseLoop = Loop Sep? Empty? /Loop
    // parseCd = Cd /Cd    

    const parseIf = function (tokens: d.Token[]): ParseComplexTag {
        const nextToken: () => d.Tag = () => tokens[0] as d.Tag

        const parseTreeNode: d.ParseTreeNodeComplexTag = {
            type: d.TagName.If,
            tags: [],
            children: []
        }

        const ifStartOrElseIf = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.If or d.TagName.ElseIf           
            parseTreeNode.tags.push(nextToken())

            //parse everything after if/elseif until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == d.TagName.ElseIf) return ifStartOrElseIf()
            if (nextToken().name == d.TagName.Else) return ifElse()
            if (nextToken().name == d.TagName.EndIf) return ifEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const ifElse = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.Else
            parseTreeNode.tags.push(nextToken())

            //parse everything after else until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == d.TagName.EndIf) return ifEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const ifEnd = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.EndIf
            parseTreeNode.tags.push(nextToken())
            return { parseTreeNode: parseTreeNode, remainingTokens: tokens.slice(1) }
        }

        return ifStartOrElseIf()
    }

    const parseLoop = function (tokens: d.Token[]): ParseComplexTag {
        const nextToken: () => d.Tag = () => tokens[0] as d.Tag

        const parseTreeNode: d.ParseTreeNodeComplexTag = {
            type: d.TagName.Loop,
            path: keyToDataPath(nextToken().args[0], pathSeparator),
            tags: [],
            children: [],
        }

        const loopStart = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.Loop
            parseTreeNode.tags.push(nextToken())

            //parse everything after loop until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == d.TagName.Sep) return loopSep()
            if (nextToken().name == d.TagName.Empty) return loopEmpty()
            if (nextToken().name == d.TagName.EndLoop) return loopEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const loopSep = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.Sep
            parseTreeNode.tags.push(nextToken())

            //parse everything after sep until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == d.TagName.Empty) return loopEmpty()
            if (nextToken().name == d.TagName.EndLoop) return loopEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const loopEmpty = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.Sep
            parseTreeNode.tags.push(nextToken())

            //parse everything after sep until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == d.TagName.EndLoop) return loopEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const loopEnd = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.EndLoop
            parseTreeNode.tags.push(nextToken())
            return { parseTreeNode: parseTreeNode, remainingTokens: tokens.slice(1) }
        }

        return loopStart()
    }

    const parseCd = function (tokens: d.Token[], type: "cd" | "vcd"): ParseComplexTag {
        const nextToken: () => d.Tag = () => tokens[0] as d.Tag

        const tagStart = type == "cd" ? d.TagName.Cd : d.TagName.Vcd
        const tagEnd = type == "cd" ? d.TagName.EndCd : d.TagName.EndVcd

        const parseTreeNode: d.ParseTreeNodeComplexTag = {
            type: tagStart,
            path: keyToDataPath(nextToken().args[0], pathSeparator),
            tags: [],
            children: [],
        }

        const cdStart = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.Cd
            parseTreeNode.tags.push(nextToken())

            //parse everything after cd until it ends
            const prr = parseRec(emptyParseTree(nextToken().afterTagPosition), tokens.slice(1))
            parseTreeNode.children.push(prr.parseTree)

            if (prr.remainingTokens.length == 0)
                throw new e.MissingClosingTagError(nextToken())

            tokens = prr.remainingTokens
            if (nextToken().name == tagEnd) return cdEnd()

            throw new e.UnexpectedTagError(nextToken())
        }

        const cdEnd = function (): ParseComplexTag {
            //assert: nextToken().name == d.TagName.EndCd
            parseTreeNode.tags.push(nextToken())
            return { parseTreeNode: parseTreeNode, remainingTokens: tokens.slice(1) }
        }

        return cdStart()
    }

    const parseComment = function (tokens: d.Token[]): ParseComplexTag {
        const nextToken: () => d.Tag = () => tokens[0] as d.Tag
        const ptn: d.ParseTreeNodeComplexTag = {
            type: d.TagName.Comment,
            tags: [],
            children: [],
        }

        ptn.tags.push(nextToken()) //assert: nextToken().name == d.TagName.CommentStart
        while (tokens.shift()) {
            if (nextToken().name == d.TagName.EndComment) {
                ptn.tags.push(nextToken())
                return { parseTreeNode: ptn, remainingTokens: tokens.slice(1) }
            }
        }
        throw new e.MissingClosingTagError(ptn.tags[0])
    }

    const parseRec = function (parseTree: d.ParseTree, tokens: d.Token[]): ParseRec {
        //no more tokens? => end of recursion
        if (tokens.length == 0) return { parseTree: parseTree, remainingTokens: [] }

        /* parse next related set of tokens depending on token type */
        const nextToken = tokens[0]

        if (typeof nextToken == "string") {
            parseTree.children.push(d.newParseTreeNodeLiteral(nextToken))
            return parseRec(parseTree, tokens.slice(1))
        }

        if (d.tagGroups.singleTags.includes(nextToken.name)) {
            if (nextToken.name == d.TagName.Vtpl) {
                const vtplPath = nextToken.args.map((arg) => {
                    arg = arg.trim()
                    if (arg.startsWith('"') || arg.startsWith("'")) {
                        return parseArgLiteral(arg, nextToken, true)
                    } else {
                        return keyToDataPath(arg, pathSeparator)
                    }
                })
                parseTree.children.push({
                    type: nextToken.name,
                    tag: nextToken,
                    vtplPath: vtplPath
                })
                return parseRec(parseTree, tokens.slice(1))
            }

            const path = d.tagGroups.singleTagsWithKey.includes(nextToken.name)
                ? keyToDataPath(nextToken.args[0], pathSeparator) : undefined

            parseTree.children.push(d.newParseTreeNodeSingleTag(nextToken, path))
            return parseRec(parseTree, tokens.slice(1))
        }

        if (nextToken.name == d.TagName.If) {
            const res = parseIf(tokens)
            parseTree.children.push(res.parseTreeNode)
            return parseRec(parseTree, res.remainingTokens)
        }

        if (nextToken.name == d.TagName.Loop) {
            const res = parseLoop(tokens)
            parseTree.children.push(res.parseTreeNode)
            return parseRec(parseTree, res.remainingTokens)
        }

        if (nextToken.name == d.TagName.Cd) {
            const res = parseCd(tokens, "cd")
            parseTree.children.push(res.parseTreeNode)
            return parseRec(parseTree, res.remainingTokens)
        }

        if (nextToken.name == d.TagName.Vcd) {
            const res = parseCd(tokens, "vcd")
            parseTree.children.push(res.parseTreeNode)
            return parseRec(parseTree, res.remainingTokens)
        }

        if (nextToken.name == d.TagName.Comment) {
            const res = parseComment(tokens)
            parseTree.children.push(res.parseTreeNode)
            return parseRec(parseTree, res.remainingTokens)
        }

        //unexpected mid or closing tag => sub parseTree ends
        const abortingTagNames = d.tagGroups.midTags.concat(d.tagGroups.closingTags)
        if (abortingTagNames.includes(nextToken.name)) {
            return { parseTree: parseTree, remainingTokens: tokens }
        }

        throw new e.UnexpectedTagError(nextToken)

    }

    const res = parseRec(emptyParseTree(0), tokens)
    if (res.remainingTokens.length > 0)
        throw new e.UnexpectedTagError(res.remainingTokens[0] as d.Tag)

    return res.parseTree
}

function keyToDataPath(key: string, pathSeparator: string): d.DataPath {
    return key.split(pathSeparator).map(x =>
        x == "-0" ? null : (Number.isFinite(Number(x)) ? Number(x) : x))
}

function tokenize(contents: string, tagStart: string, tagEnd: string): d.Token[] {
    const tokens: d.Token[] = []
    let pos = 0
    let commentStartTag: d.Tag | null = null // non-null value indicates that tokenizer is in a comment
    const inComment = () => commentStartTag != null
    try {
        while (true) {
            const next = nextTag(contents, tagStart, tagEnd, inComment())
            if (next == null) {
                if (inComment()) throw new e.MissingClosingTagError(commentStartTag!)
                //no tag found => add remaining contents as final token & return
                if (contents != "") tokens.push(contents)
                return tokens
            }

            if (next.beforePart != "") tokens.push(next.beforePart)
            pos += next.beforePart.length
            next.tag.position = pos
            pos += tagStart.length + next.tag.contents.length + tagEnd.length
            next.tag.afterTagPosition = pos

            if (next.tag.name == d.TagName.Comment) commentStartTag = next.tag
            if (next.tag.name == d.TagName.EndComment) commentStartTag = null

            tokens.push(next.tag)
            contents = next.afterPart
        }
    } catch (err) {
        //rethrow with corrected tag position (offset by pos)
        if (err instanceof e.SyntaxIllegalTagNameError) {
            throw new e.SyntaxIllegalTagNameError(err.tagName, err.pos + pos)
        } else if (err instanceof e.SyntaxTagMissingArgsError) {
            err.tag.position += pos
            throw new e.SyntaxTagMissingArgsError(err.tag)
        } else if (err instanceof e.SyntaxArglessTagWithArgsError) {
            err.tag.position += pos
            throw new e.SyntaxArglessTagWithArgsError(err.tag)
        } else {
            throw err
        }
    }
}

type NextTag = { beforePart: string, tag: d.Tag, afterPart: string }
function nextTag(contents: string, tagStart: string, tagEnd: string, inComment: boolean): NextTag | null {
    const ts = escapeRegExp(tagStart)
    const te = escapeRegExp(tagEnd)
    const eoc = escapeRegExp(d.TagName.EndComment)
    const regex = inComment
        ? new RegExp(`(.*?)${ts}(${eoc})${te}(.*)`, "s") //only look for «*/»
        : new RegExp(`(.*?)${ts}((?:(?!${te}).)*)${te}(.*)`, "s")

    const parts = contents.match(regex)

    if (!parts) return null //no tag found

    const tagContents = parts[2]
    const tagParts = cut(tagContents, " ")
    const tagName = d.toTagName(tagParts[0])
    if (tagName == null)
        throw new e.SyntaxIllegalTagNameError(tagParts[0], parts[1].length)

    const tag: d.Tag = {
        name: tagName as d.TagName,
        args: [],
        position: parts[1].length,
        afterTagPosition: parts[1].length + tagStart.length + tagContents.length + tagEnd.length,
        contents: tagContents
    }
    if (d.tagGroups.arglessTags.includes(tagName)) {
        if (tagParts[1] != "") throw new e.SyntaxArglessTagWithArgsError(tag)
    } else {
        if (tagParts[1] == "") throw new e.SyntaxTagMissingArgsError(tag)
        tag.args = tagParts[1].split(" ").filter(x => x != "")
    }

    if (d.tagGroups.singleArgTags.includes(tag.name) && tag.args.length > 1)
        throw new e.TooManyArgsError(tag, 1)

    return {
        beforePart: parts[1],
        tag: tag,
        afterPart: parts[3]
    }

}

function syntaxCheck(contents: string, tagStart: string, tagEnd: string) {
    let tagStartPos: null | number = null
    let tagIsEmpty = false

    let i = 0
    while (i < contents.length) {
        if (tagStartPos != null) {
            if (contents.slice(i).startsWith(tagStart)) {                
                throw new e.SyntaxUnexpectedTagStartError(i)
            } else if (contents.slice(i).startsWith(tagEnd)) {
                if (tagIsEmpty) throw new e.SyntaxEmptyTagError(i)
                tagStartPos = null //tag ended
                i += tagEnd.length
            } else {
                tagIsEmpty = false
                i++
            }
        } else {
            if (contents.slice(i).startsWith(tagStart)) {
                //tag started
                tagStartPos = i
                tagIsEmpty = true
                i += tagStart.length
            } else if (contents.slice(i).startsWith(tagEnd)) {                
                throw new e.SyntaxUnexpectedTagEndError(i)
            } else {
                //just a literal char
                i += 1
            }
        }
    }

    if (tagStartPos != null)
        throw new e.SyntaxUnclosedTagError(tagStartPos)
}

function parseArgLiteral(arg: string, tag: d.Tag, parsed: boolean) {
    try {
        let x = arg.trim()
        if (x[0] == "'" && x[x.length - 1] == "'") {
            //replace single quotes with double quotes
            //note: double quotes must be escaped by user, e.g. `'... \" ...'`
            x = `"${x.slice(1, -1)}"`
        }
        const x2 = JSON.parse(x)  //check if literal is syntactically correct 
        return parsed ? x2 : x
    } catch (err) {
        throw new e.IllegalLiteralError(tag, arg, err as Error)
    }
}
