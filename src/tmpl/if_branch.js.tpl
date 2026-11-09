(«if ifInfo/comparison === null»
defaultCmp(data(«json ifInfo/path»,«raw ifInfo/tagPosition»,0))
«else»
data(«json ifInfo/path»,«raw ifInfo/tagPosition») «raw ifInfo/comparison/operator» «raw ifInfo/comparison/literal»
«/if» ? «tpl expression» : 