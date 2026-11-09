«loop multipleLines/lines»
«cd -2»«tpl indent»«/cd»«tpl line»«tpl newline»«/*»cd -2 goes up two levels (array index & lines)«*/»
«empty»
«cd -0/multipleLines»«tpl indent»«/cd»//nothing to see here«tpl newline»«/*»-0 points to root level in tmplData«*/»
«/loop»