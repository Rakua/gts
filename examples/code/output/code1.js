//Collatz
function f(x) {
    if(x == 1) return null
    const str = 'this is from code1.json' //indentLevel = [null]
    while(true) {
        if(x % 2 == 0) //indentLevel = []
            return f(x/2) //indentLevel = [null]
        return f(3*x+1) //indentLevel = []
    }
}