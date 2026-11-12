import * as d from './data.js'

let tagStart = d.defaults.tagStart
let tagEnd = d.defaults.tagEnd

export class TplDoesNotExistError extends Error {
    tmplName: string
    tag: d.Tag

    constructor(tag: d.Tag, tmplName: string) {
        const tplName = tag.args[0]
        super(`Template ${JSON.stringify(tplName)} included in template ${JSON.stringify(tmplName)} in ${tagToString(tag)} does not exist`)
        this.name = "TplDoesNotExistError"
        this.tmplName = tmplName
        this.tag = tag
    }
}

export class IllegalLiteralError extends Error {
    tag: d.Tag
    literal: string
    err: Error

    constructor(tag: d.Tag, literal: string, err: Error) {
        super(`Illegal literal value ${JSON.stringify(literal)} in ${tagToString(tag)}:\n${err.message})`)
        this.name = "IllegalLiteralError"
        this.tag = tag
        this.literal = literal
        this.err = err
    }
}

export class IllegalComparisonOperatorError extends Error {
    tag: d.Tag
    op: string

    constructor(tag: d.Tag, op: string) {
        super(`Illegal comparison operator '${op}' in ${tagToString(tag)} (expected one of the following: ${Object.values(d.ComparisonOperator).join(" ")})`)
        this.name = "IllegalComparisonOperatorError"
        this.tag = tag
        this.op = op
    }
}

export class WrongArgCountIfError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag) {
        super(`Wrong argument count in ${tagToString(tag)} (expected either 1 argument (key) or 3 arguments (key, $ComparisonOperator, $LiteralValue)`)
        this.name = "WrongArgCountIfError"
        this.tag = tag
    }
}

export class TooManyArgsError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag, expected: number) {
        super(`Too many arguments in ${tagToString(tag)} (expected ${expected}, got ${tag.args.length})`)
        this.name = "TooManyArgsError"
        this.tag = tag
    }

}

export class MissingClosingTagError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag) {
        super(`Missing closing tag for ${tagToString(tag)}`)
        this.name = "MissingClosingTagError"
        this.tag = tag
    }
}

export class UnexpectedTagError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag) {
        super(`Unexpected tag ${tagToString(tag)}`)
        this.name = "UnexpectedTagError"
        this.tag = tag
    }
}

export class SyntaxTagMissingArgsError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag) {
        super(`Tag ${tagToString(tag)} should have at least one argument`)
        this.name = "SyntaxTagMissingArgsError"
        this.tag = tag
    }
}

export class SyntaxArglessTagWithArgsError extends Error {
    tag: d.Tag

    constructor(tag: d.Tag) {
        super(`Tag ${tagToString(tag)} should have no arguments`)
        this.name = "SyntaxArglessTagWithArgsError"
        this.tag = tag
    }
}

export class SyntaxIllegalTagNameError extends Error {
    tagName: string
    pos: number

    constructor(tagName: string, pos: number) {
        super(`Illegal tag name '${tagName}' at offset ${pos}`)
        this.name = "SyntaxIllegalTagNameError"
        this.tagName = tagName
        this.pos = pos
    }
}

export class SyntaxEmptyTagError extends Error {
    pos: number

    constructor(pos: number) {
        super(`Empty tag at offset ${pos}`)
        this.name = "SyntaxEmptyTagError"
        this.pos = pos
    }
}

export class SyntaxUnexpectedTagEndError extends Error {
    pos: number

    constructor(pos: number) {
        super(`Unexpected tag end delimiter '${tagEnd}' at offset ${pos}`)
        this.name = "SyntaxUnexpectedTagEndError"
        this.pos = pos
    }
}

export class SyntaxUnexpectedTagStartError extends Error {
    pos: number

    constructor(pos: number) {
        super(`Unexpected tag start delimiter '${tagStart}' at offset ${pos}`)
        this.name = "SyntaxUnexpectedTagStartError"
        this.pos = pos
    }
}

export class SyntaxUnclosedTagError extends Error {
    pos: number

    constructor(pos: number) {
        super(`Tag starting at offset ${pos} lacks closing delimiter '${tagEnd}'`)
        this.name = "SyntaxUnclosedTagError"
        this.pos = pos
    }
}

export function setTagDelimiters(tagStart_: string, tagEnd_: string) {
    tagStart = tagStart_
    tagEnd = tagEnd_
}

function tagToString(tag: d.Tag) {
    return tagStart + tag.contents + tagEnd + " at offset " + tag.position
}