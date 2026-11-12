# v1.1.0
- improved error messages
  - compile-time error messages show line and column number instead of just the offset
  - for runtime errors use `gts offset` to see the line and column number
  - red text to highlight error messages
- added template command `«vcd»` to change the data path with a variable
- extended template command `«vtpl»`
  - it now accepts a variable number of arguments, which may either be string literals or data keys, which are joined to determine the template path
- added command `gts gen-data` to generate a JSON file from a directory
- fixed parsing of comments
  - tags within a comment were previously parsed, which could cause a parsing error
- fixed processing of tag delimiters with multiple characters
  - `compile.ts:syntaxCheck()` only worked for single character delimiters previously
  - `compile.ts:nextTag()` proper substrings of the tag end delimiter may now appear as part of the tag contents
- reserved data variables
  - **BREAKING CHANGE**: `$preferred` is now `$PREFERRED`
  - added reserved variable `$TMPL_NAME` containing the name of the template that `tmpl()` was called with
- variable `tmplNames` in `tmpl0()` in the generated `tmpl.js` does not contain duplicates anymore

# v1.0.0
- initial version