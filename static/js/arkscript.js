Rainbow.extend('arkscript', [
    {
        /* making peace with HTML */
        name: 'entity.function',
        pattern: /&gt;=?|&lt;=?/g
    },
    {
        name: 'comment',
        pattern: /#.*$/gm
    },
    {
        name: 'constant.language',
        pattern: /true|false|nil/g
    },
    {
        name: 'identifier',
        pattern: /[A-Za-z:&;!?@_\-+*\/|=<>%$][A-Za-z0-9:&;!?@_\-+*/|=<>%$]*/g
    },
    {
        name: 'constant.number',
        pattern: /\b\d+(?:\.\d*)?\b/g
    },
    {
        name: 'string',
        pattern: /("[^"\\]*(?:\\.[^"\\]*)*")/g
    },
    {
        name: 'string.regex',
        pattern: /(r"[^"\\]*(?:\\.[^"\\]*)*")/g
    },
    {
        matches: {
            1: 'storage.function',
            2: 'variable'
        },
        pattern: /\(\s*(let|mut|set|ref)\s+\(?([A-Za-z:&;!?@_\-+*\/|=<>%$][A-Za-z0-9:&;!?@_\-+*/|=<>%$]*)/g
    },
    {
        matches: {
            1: 'keyword'
        },
        pattern: /\(\s*(begin|if|\$if|fun|macro|set|while|let|mut|del|import|breakpoint)(?=[\]()\s#])/g
    },
    {
        matches: {
            1: 'entity.function'
        },
        pattern: /\(\s*(=|<=?|>=?|!=|@|@@|@=|@@=|\^|\+|-|\*|\/|tail|head|nil\?|list|len|append|concat|print|puts|format|input|time|empty\?|assert|toNumber|toString|and|or|mod|type|hasField|not|async|await)(?=[\]()\s#])/g
    }
]);

Rainbow.extend('arkscript-bytecode', [
    {
        /* making peace with HTML */
        name: 'plain',
        pattern: /&gt;|&lt;/g
    },
    {
        name: 'constant.symbol',
        pattern: /(Version|Timestamp|SHA256)/g
    },
    {
        name: 'constant.number',
        pattern: /\n\d+/g
    },
    {
        name: 'storage.function',
        pattern: /(Symbols table|Constants table|Instruction locations table|Code segment).+/g
    },
    {
        name: 'entity.function',
        pattern: /[A-Z_]{2,}/g
    }
]);
