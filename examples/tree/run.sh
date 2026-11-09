#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd -- "$SCRIPT_DIR"

mkdir -p output

echo "Compiling templates"
echo ">gts tmpl"
if ! gts tmpl; then
    echo "Compiling failed"
    exit 1
fi
node run.js