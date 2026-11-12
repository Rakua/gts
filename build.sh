#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
BIN_CMD="#!/bin/bash\nnode $SCRIPT_DIR/dist/main.js \"\$@\"\n"

cd -- "$SCRIPT_DIR"

echo "Install npm packages"
cd src
npm install
cd ..

echo "Generate tmpl0mod: node tmpl0-gen.js"
node tmpl0-gen.js

echo "Compile TypeScript"
rm -rf dist
mkdir dist
cd src

if ! tsc ; then
    echo "TypeSript compiler 'tsc' not found"
    exit 1
fi
cd ..

echo "Build tmpl0.js using translate0"
if ! node dist/main.js src/tmpl out=dist/tmpl0.js exts=js.tpl flags=0bp ; then
    echo "Building tmpl0.js failed"
    exit 1
fi
cp dist/tmpl0.js dist/tmpl.js

echo "Build tmpl1.js with tmpl0.js"
if ! node dist/main.js src/tmpl out=dist/tmpl1.js exts=js.tpl flags=b ; then
    echo "Building tmpl1.js failed"
    exit 1
fi
cp dist/tmpl1.js dist/tmpl.js

echo "Build tmpl2.js with tmpl1.js"
if ! node dist/main.js src/tmpl out=dist/tmpl2.js exts=js.tpl flags=b ; then
    echo "Building tmpl2.js failed"
    exit 1
fi

if cmp --silent -- "dist/tmpl1.js" "dist/tmpl2.js"; then
    echo "tmpl1.js and tmpl2.js are identical, good!"
    echo "Removing tmpl0.js, tmpl1.js and tmpl2.js from dist"
    rm dist/tmpl0.js
    rm dist/tmpl1.js
    rm dist/tmpl2.js
    rm dist/tmpl0.js.td.json
else 
    echo "Error: tmpl1.js does not equal tmpl2.js"
    exit 1
fi 

echo "Generating gts bash script and making it executable" 
printf "$BIN_CMD" > ./dist/gts
chmod +x ./dist/gts

echo "Copy the following file to a directory contained in your \$PATH environment variable:"
echo ""
echo "  $SCRIPT_DIR/dist/gts"
echo ""

