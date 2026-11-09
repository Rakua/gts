/*
    Generates ./src/tmpl0mod.js from ./src/tmpl/tmpl0.js
    Used for bootstrapping.
*/

import { promises } from 'fs'

async function main() {
    let tmpl0Str = await promises.readFile("./src/tmpl/tmpl0.js", "utf8")
    const contents = "export const tmpl0Str = " + JSON.stringify(tmpl0Str)
    await promises.writeFile("./src/tmpl0mod.js",contents)
}

await main()