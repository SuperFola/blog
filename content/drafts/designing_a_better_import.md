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

### ArkScript compiler in 2022

The compiler toolchain used to look like this:

```goat
.-------.      .--------.     .-----------------.     .-----------.     .----------.
| Lexer | ---> | Parser | --> | Macro Processor | --> | Optimizer | --> | Compiler |
.-------.      .--------.     .-----------------.     .-----------.     .----------.
```

The compiler was doing a lot of work, transforming an AST into bytecode, checking for the presence of undefined symbols, suggesting alternative names… It was too big to be manageable, so it had to be split. The parser was also in charge of resolving imports, by recursively calling itself when it found an import node, leading to a code that was hard to read, navigate and update.

### ArkScript compiler as of now

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
- The macro processor handles macros before name resolution happens, because it can craft identifiers! This is a complex piece of code that will have its own article as well.
- Then a new compiler pass appeared, and it is the one we will talk about the most: the **name resolution pass**, in charge of detecting unbound symbols and resolving namespaces.
- The optimizer is a simple mark and sweep algorithm, to remove dead code in the AST.
- The compiler now does the bare minimum and outputs IR entities, that are then grouped (by 2, 3 or even 4) by the IROptimizer, which tries to combine them together in a single more specialized instruction. The resulting IR entities are then compiled to bytecode for the VM.

## Name resolution

I wanted to keep the code as simple as possible, so as to avoid having to rewrite the compiler from scratch « just » to add better imports, all of this because I didn’t think about imports when I started ArkScript (after all, it was just a toy project in the early days).

There were multiple solutions:
- Parse the entry file, then get a list of its imports and parse them too, recursively, until we parsed all files that will be imported
	- Compile them separately, with informations about the namespaces to help linking
	- Add a linker stage
	- Somewhat don’t break the other passes like the macro processor, AST optimizer…
- Parse the entry file, get a list of all the imports, rename the symbols when they are used
	- But we have to be careful with global imports that can cause name conflicts!
	- Maybe we should create hidden namespaces and add aliases to be able to import only a few symbols, but how should that work if we import `foo`, that calls `bar` from the same module, while only `foo` is imported?
- Parse the entry file, get a list of all the imports
	- Have imports be replaced by a new node: `Namespace(is_glob: bool, with_prefix: bool, prefix: str, symbols: vec[str], ast: Node)`
	- Track all scopes (entering a function creates a scope, entering a namespace creates a named scope)
	- Fully qualify every name in the AST when we find a symbol, by using the stack of scopes & named scopes

I went for the third solution, which had the benefit of being able to track unbound variables too. If we encountered a new name, we could look it up recursively in our scopes, and if it didn’t find anything, then the variable is unbound! Otherwise we can update its name by asking the scope it’s in how to name it (scopes return the name as is, while named scopes return the name prefixed by the namespace).

Also, this solution wasn’t breaking anything more than:
- macro processing, as we now needed to traverse `Namespace` nodes (which is an easy fix),
- the compiler (which also has to know how to compile a `Namespace`: compile its inner AST without asking questions),
- name resolution (which now needed to track named scopes and rename symbols)

A module has a prefix (can be empty) and a list of symbols to export (if empty export everything)