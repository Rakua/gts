#!/bin/bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)
cd -- "$SCRIPT_DIR"

echo "Generating JSON file from data directory"
echo ">gts gen-data data formatDir=data.format checkDir=data.check"
if ! gts gen-data data formatDir=data.format checkDir=data.check; then
    echo "Generating data failed"
    exit 1
fi

echo ""
echo "Try removing or changing the type of a value in a JSON file in the data dir."