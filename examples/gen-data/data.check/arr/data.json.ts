export {}
export {}

type Format = {
    title: string,
    date: [Year, Month, Day]
}

type Year = number
type Month = number
type Day = number


const isArray : boolean = false
const x : Record<string, Format> = {}
x["arr/2026-04/data.json"] = {
    "title": "news 1",
    "date": [
        2026,
        4,
        1
    ]
}
x["arr/2026-05/data.json"] = {
    "title": "news 2",
    "date": [
        2026,
        5,
        13
    ]
}
