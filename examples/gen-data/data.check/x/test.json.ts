export {}
export {}

type Format = {
    x: number
    y?: boolean
}

const isArray : boolean = false
const x : Record<string, Format> = {}
x["x/test.json"] = {
    "x": 23,
    "y": true
}
