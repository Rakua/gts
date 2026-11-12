import { promises, readdirSync } from 'fs'
import { tmpl } from './tmpl.js'

run()

async function run() {    
    const files = getDataFiles()

    for (const file of files) {
        const inFile = `data/${file}.json`
        const outFile = `output/${file}.md`

        console.log(`Evaluating tmpl for tmplData ${inFile} and writing it to ${outFile}`)
        const tmplData = JSON.parse(await promises.readFile(`data/${file}.json`, "utf8"))
        const resD = tmpl("vcd.md", tmplData)
        promises.writeFile(outFile, resD)
    }
}

function getDataFiles() {
    const dataExt = ".json"
    const files = readdirSync('./data')
        .filter(fn => fn.endsWith(dataExt))
        .map(fn => fn.slice(0, -1 * dataExt.length))
    return files
}