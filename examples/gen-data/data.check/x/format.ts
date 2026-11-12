export {}
type Format = {
    "test.json": any,
    "test.html": string
}

const isArray : boolean = false
const x : Record<string, Format> = {}
x["x"] = {
    "test.html": "data/x/test.html contents",
    "test.json": {
        "x": 23,
        "y": true
    }
}
