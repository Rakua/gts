export {}
export {}

type Format = {
    "data.json": any
    "news.html": string
    "title.html"?: string
    "$ARRAY_KEY": string
}



const isArray : boolean = true
const x : Record<string, Format> = {}
x["arr/2026-04"] = {
    "data.json": {
        "title": "news 1",
        "date": [
            2026,
            4,
            1
        ]
    },
    "news.html": "news article 001",
    "title.html": "<h1>Title with pic <img src=\"#\"></h1>",
    "$ARRAY_KEY": "2026-04"
}
x["arr/2026-05"] = {
    "data.json": {
        "title": "news 2",
        "date": [
            2026,
            5,
            13
        ]
    },
    "news.html": "news article 002",
    "$ARRAY_KEY": "2026-05"
}
