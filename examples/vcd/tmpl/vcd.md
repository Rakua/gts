# Reserved data variables
`«tsd»$TMPL_NAME«ted»` = `«val $TMPL_NAME»`
`«tsd»$PREFFERED«ted»` = «if $PREFERRED»`«val $PREFERRED»`«else»undefined«/if»

# Change data path using literals and variables

## cd example
«cd animal/sparrow»
    Animal: sparrow
    Type: «val type»
    Legs: «val legs»
«/cd»

## vcd example 1
«cd animal»
  «trim»«vcd -1/selectedAnimal»
    Animal: «val -0/selectedAnimal»
    Type: «val type»
    Legs: «val legs»
  «/vcd»
«/cd»

«trim»«/*»
Note: the -1 in `«vcd -1/selectedAnimal»` is used since `«cd animal»` changes
the data path to `animal` and `selectedAnimal` is at the root level.
«*/»«trim»

## vcd example 2
«cd anime/dog»
«vcd -0/dataPath»
«cd -1»
Type: «val type» 
«/cd»
«/vcd»
«/cd»
