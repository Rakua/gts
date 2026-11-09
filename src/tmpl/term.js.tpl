«if type == "string"»
«json contents»
«elseif type == "val"»
transformVal(«json path»,«val tag/position»,x=>escapeHtml(''+x))
«elseif type == "raw"»
transformVal(«json path»,«val tag/position»,x=>x)
«elseif type == "json"»
transformVal(«json path»,«val tag/position»,x=>JSON.stringify(x))
«elseif type == "tpl"»
tmpl0(«json tag/args/0»+"/0", tmplData, preferred, curPath)
«elseif type == "vtpl"»
tmpl0(vtpl(«json path»,«val tag/position»), tmplData, preferred, curPath)
«elseif type == "tsd"»
tsd
«elseif type == "ted"»
ted
«elseif type == "if"»
«tpl if»
«elseif type == "loop"»
«tpl loop»
«elseif type == "cd"»
«tpl cd»
«else»
''«/*»applies to comment and trim tags«*/»
«/if»