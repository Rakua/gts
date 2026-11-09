import { promises, readdirSync } from 'fs'
import { tmpl } from './tmpl.js'

run()

async function run() {
    //const files = ["website1","website2"]
    const files = getDataFiles()

    for (const file of files) {
        const inFile = `data/${file}.json`
        const outFileD = `output/${file}.html`
        const outFileM = `output/${file}.m.html`

        console.log(`Evaluating tmpl for tmplData ${inFile} and writing it to ${outFileD} and ${outFileM}`)
        const tmplData = JSON.parse(await promises.readFile(`data/${file}.json`, "utf8"))
        const resD = tmpl("index.html", tmplData) //preferred undefined => desktop
        const resM = tmpl("index.html", tmplData, "m") //preferred m => mobile
        promises.writeFile(outFileD, resD)
        promises.writeFile(outFileM, resM)
    }
}

function getDataFiles() {
    const dataExt = ".json"
    const files = readdirSync('./data')
        .filter(fn => fn.endsWith(dataExt))
        .map(fn => fn.slice(0, -1 * dataExt.length))
    return files
}