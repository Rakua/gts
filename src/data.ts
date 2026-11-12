export {
    CliArgumentsTmpl, FileMap,
    TemplateData,
    Token, Tag, SingleTag, ComplexTag,
    ParseTree, ParseTreeNode, ParseTreeNodeLiteral, ParseTreeNodeSingleTag, ParseTreeNodeComplexTag,
    ParseTreeIfData, ParseTreeIfDataComparison, ParseTreeIfDataElseBranch, ParseTreeIfDataIfBranch as ParseTreeIfDataNonElseBranch,
    DataPath, VtplPath,
    TagName, Flag, ComparisonOperator,
    tagGroups, defaults,
    newParseTreeNodeLiteral, newParseTreeNodeSingleTag, toTagName, toComparisonOperator,
    //dataPathToCode
}

/* Types */

type CliArgumentsTmpl = {
    dir: string,
    exts: string[],
    out: string,
    tagStart: string,
    tagEnd: string,
    flags: string
}

type FileMap = { [index: string]: string }
type TemplateData = {
    templates: ParseTree[],
    tmplNames: string[],
    tagStartDelimiter: string,
    tagEndDelimiter: string,
    compileDate: string,
    exts: { ext: string }[],
    showDate: boolean,
    debugMode: boolean
}

type Token = string | Tag
type Tag = {
    name: TagName
    args: string[]
    position: number
    afterTagPosition: number
    contents: string //as it occurs in source; without tag delimiters
}
type SingleTag = TagName.Val | TagName.Raw | TagName.Json | TagName.Tpl | TagName.Vtpl | TagName.Trim | TagName.Tsd | TagName.Ted
type ComplexTag = TagName.If | TagName.Loop | TagName.Comment | TagName.Cd | TagName.Vcd


type ParseTree = {
    tmplName: string,
    position: number
    children: ParseTreeNode[]
    ifInfo?: ParseTreeIfData
}
type ParseTreeNode = ParseTreeNodeLiteral | ParseTreeNodeSingleTag | ParseTreeNodeComplexTag
type ParseTreeNodeLiteral = {
    type: "string"
    contents: string
}
type ParseTreeNodeSingleTag = {
    type: SingleTag
    tag: Tag
    path?: DataPath //used for tags that have key argument
    vtplPath?: (string | DataPath)[]
}
type ParseTreeNodeComplexTag = {
    type: ComplexTag
    path?: DataPath //undefined for if b/c keys are associated with each child in children via ParseTreeIfData
    tags: Tag[]
    children: ParseTree[]
}

type ParseTreeIfData = ParseTreeIfDataIfBranch | ParseTreeIfDataElseBranch
type ParseTreeIfDataIfBranch = {
    type: TagName.If,
    path: DataPath //path of key in corresponding if/elseif tag; undefined => else branch
    comparison: null | ParseTreeIfDataComparison,
    tagPosition: number
    /*
      comparison == null means 'check whether key is defined'; additionally, 
      don't use guarded access since property referenced by key may be undefined
    */
}
type ParseTreeIfDataElseBranch = { type: TagName.Else }
type ParseTreeIfDataComparison = { operator: ComparisonOperator, literal: string }

type DataPath = (string | number | null)[]
type VtplPath = (string | DataPath)[]

/* Enums */

enum TagName {
    Val = "val",
    Raw = "raw",
    Json = "json",
    Tpl = "tpl",
    Vtpl = "vtpl",

    Trim = "trim",
    Tsd = "tsd", //tag start delimiter
    Ted = "ted", //tag end delimiter

    If = "if",
    ElseIf = "elseif",
    Else = "else",
    EndIf = "/if",

    Loop = "loop",
    Sep = "sep",
    Empty = "empty",
    EndLoop = "/loop",

    Cd = "cd",
    EndCd = "/cd",
    Vcd = "vcd",
    EndVcd = "/vcd",

    Comment = "/*",
    EndComment = "*/"
}
enum Flag {
    Verbatim = "!VERBATIM"
}
enum ComparisonOperator {
    Equality = "==",
    StrictEquality = "===",
    Inequality = "!=",
    StrictInequality = "!==",
    LessThan = "<",
    LessOrEquals = "<=",
    GreaterThan = ">",
    GreaterOrEquals = ">="
}


/* Constants */

const tagGroups = {
    singleTags: [TagName.Val, TagName.Raw, TagName.Json, TagName.Tpl, TagName.Vtpl, TagName.Trim, TagName.Tsd, TagName.Ted],
    openingTags: [TagName.If, TagName.Loop, TagName.Cd, TagName.Comment],
    midTags: [TagName.ElseIf, TagName.Else, TagName.Sep, TagName.Empty],
    closingTags: [TagName.EndIf, TagName.EndLoop, TagName.EndCd, TagName.EndVcd, TagName.EndComment],
    singleTagsWithKey: [TagName.Val, TagName.Raw, TagName.Json],
    arglessTags: [TagName.Comment, TagName.EndComment, TagName.Else, TagName.EndIf, TagName.Sep, TagName.Empty, TagName.EndCd, TagName.EndVcd, TagName.EndLoop, TagName.Trim, TagName.Tsd, TagName.Ted],
    singleArgTags: [TagName.Val, TagName.Raw, TagName.Json, TagName.Tpl]
}

const defaults = {
    tagStart: "«",
    tagEnd: "»",
    pathSeparator: "/"
}


/* Helper functions */

function newParseTreeNodeLiteral(contents: string): ParseTreeNodeLiteral {
    return {
        type: "string",
        contents: contents
    }
}

function newParseTreeNodeSingleTag(tag: Tag, path?: DataPath): ParseTreeNodeSingleTag {
    if (!tagGroups.singleTags.includes(tag.name))
        throw new TypeError("tag must be single tag, got " + tag.name)

    return {
        type: tag.name as SingleTag,
        tag: tag,
        path: path,
    }
}

function toTagName(str: string) {
    return strToEnum(str, Object.values(TagName))
}

function toComparisonOperator(str: string) {
    return strToEnum(str, Object.values(ComparisonOperator))
}

function strToEnum<T>(str: string, tValues: T[]): T | null {
    return (tValues as string[]).includes(str) ? str as T : null
}