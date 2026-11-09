export { shortHelp, longHelp }

function shortHelp(version: string): string {
  return helpCmd.replace(versionPlaceholder,version) + "\n" + helpMore
}

function longHelp(version: string): string {
  return helpCmd.replace(versionPlaceholder,version) + "\n" + helpTags + "\n" + helpDir
}

const versionPlaceholder = "$VERSION"

const helpMore = `Type "gts help" for more help.\n`

const helpCmd = `Guillemets Template System $VERSION
gts $TMPLDIR [exts=$EXTS] [out=$OUT] [flags=$F] [tagStart=$TS] [tagEnd=$TE]
  $TMPLDIR = directory with templates (scanned recursively)
  $EXTS    = template file extensions separated by ',' (default is "html,css")
  $OUT     = output js-file computing the templates (default is "$TMPLDIR/../tmpl.js")
  $F       = subset of "0bdptv" (see below for meaning) (default is "", i.e. no flag)
  $TS      = start delimiter of template tag (default is "«")
  $TE      = end delimiter of template tag (default is "»")

Flags
  0        use translate0 for bootstrapping
  b        drop file extension from template names
  d        enable debug mode in output file
  p        output parse trees to "$OUT.td.json"
  t        include compile date in output file
  v        verbose mode (gts shows parsed arguments)
`

const helpTags = `Template tags
  «val $KEY»        inserts value referenced by $KEY (HTML is escaped)
  «raw $KEY»        same as above but without escaping
  «json $KEY»       applies JSON.stringify before inserting the value  
  «tpl $TMPLNAME»   inserts template $TMPLNAME
  «vtpl $KEY»       inserts variable template referenced by $KEY
  «tsd»             inserts tag start delimiter
  «ted»             inserts tag end delimiter

  «if $KEY» $X «else» $Y «/if»
                    inserts $X if value referenced by $KEY in tmplData is
                    neither undefined nor false, else $Y. The else part is
                    optional.

  «if $KEY == $VAL» $X «/if»
                    inserts $X if value referenced by $KEY equals $VAL.
                    '==' can be replaced by any JS comparison operator.
                    $VAL must be a valid JS literal (string, number, etc.)

  «if $COND1» $X «elseif $COND2» $Y «/if»
                    $COND1 and $COND2 can be keys or a comparison as above.
                    Multiple elseif branches are possible. Can be combined
                    with else as well.

  «loop $KEY» $X «sep» $Y «empty» $Z «/loop»
                    for each value in the array referenced by $KEY $X is
                    inserted and the current path in tmplData is changed to
                    the current element in the array. Between each pair of $X
                    $Y is inserted (separator). If the array is empty, then
                    $Z is inserted. «sep» and «empty» are optional.

  «cd $KEY» $X «/cd»
                    changes current path in tmplData to $KEY within $X

  «/*» $X «*/»      comment: $X is not inserted in the output file

  «trim»            removes last line in previous token if it is a string
                    literal and its last line is empty. Also removes first
                    line in next token if it is a string literal and its
                    first line is empty. Only useful if whitespace in output
                    is important.

Key syntax
  abc               tmplData["abc"]
  abc/def           tmplData["abc"]["def"]  ("/" is the path separator)
  a/2               tmplData["a"][2] (non-negative integers = array access)
  -2/abc            goes up 2 levels in the current path before accessing "abc"
  -0/abc            goes up to the root before accessing "abc"
`

const helpDir = `To use a directory named "help" as template directory use "gts ./help"`