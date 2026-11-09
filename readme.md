# Guillemets Template System
Compiles a set of template files to a js-file with a function `tmpl(tmplName, tmplData, preferred?)` that can be used to call the templates using node.js.

How to install:
1. compile with `build.sh`
2. copy `./gts/dist/gts` to a directory in your `$PATH` variable
3. call `gts` to see if it works

Check out the `examples/` directory to see how template files and template data are structured and combined. The`run.sh` script compiles the templates in `tmpl/` and evaluates them for each json-file in `data/`. The results are written to `output/`.