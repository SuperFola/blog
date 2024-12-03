+++
title = 'Designing a better import for ArkScript'
date = 2024-12-02T22:03:00+02:00
tags = ['arkscript']
categories = ['pldev']
+++

In December 2022, a colleague gave me the idea to improve ArkScript import system. All it was doing was using a `(import "folder/file.ark")` syntax, and copy / pasting the content of the file (duplicate imports were removed).

The idea was to be able to do something akin to Scala or Python imports:

1. import a whole file, and have it in a namespace of it own ; eg `(import std.List) (list:map data multiply_by_2)`
2. import only a few symbols from a file ; eg `(import std.List :map :flatten)`
3. import all symbols from a file, unprefixed ; eg `(import std.List:*)`

And it's finally done. About 730 days later. Because I took the wrong path forward, having a big compiler trying to do everything at once!

## Getting started

The compiler toolchain used to look like this:

```goat
.-------.      .--------.     .-----------------.     .-----------.     .----------.
| Lexer | ---> | Parser | --> | Macro Processor | --> | Optimizer | --> | Compiler |
.-------.      .--------.     .-----------------.     .-----------.     .----------.
```

The compiler was doing a lot of work, transforming an AST into bytecode, checking for the presence of undefined symbols, suggesting alternative names… It was too big to be manageable, so it has to be split. The parser was also in charge of resolving imports, by recursively calling itself when it found an import node.

After October 5th refactor, it's more like:

```goat
.--------.     .--------------.     .----------------.
| Parser | --> | ImportSolver | --> | MacroProcessor | --.
.--------.     .--------------.     .----------------.    |
                                                          |
.----------.     .-----------.     .----------------.     |
| Compiler | <-- | Optimizer | <-- | NameResolution | <--'
.----------.     .-----------.     .----------------.
     |
     |     .-------------.     .------------.
      '->  | IROptimizer | --> | IRCompiler |
           .-------------.     .------------.
```

- The Lexer disappeared, as the old parser was also not very manageable, hard to evolve, had a lot of bugs and could create invalid nodes. We’re now using a parser combinators approach, checking syntax more seriously while parsing, ensuring only correct nodes can be created.
- The import solving got put in a separate pass, in charge of finding and replacing import nodes by a `Namespace` node with the different attributes of the import (glob, with prefix, specific symbols to import)
- Then a new compiler pass appeared, and it is the one we will talk about the most: the **name resolution pass**, in charge of detecting unbound symbols and resolving namespaces

Currently ast are merged together, we can’t import with a prefix nor import only a few symbols

Need to treat each file as a module

A module has a prefix (can be empty) and a list of symbols to export (if empty export everything)

We could have x modules with x files but then the name and scope resolution does not work? Do we need linkage to merge values and symbols tables? If we compile module separately we would need that, in a linkage step after compiling, before optimizing the ir. But we lose the ability to trim down the ast by removing unused code

How can we merge modules in a single ast? Modify all the declared and used symbols in a module to prefix it accordingly?
