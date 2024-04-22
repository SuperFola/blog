+++
title = 'How I created my own scripting language'
date = 2019-10-08T22:53:29+02:00
draft = false
tags = ['arkscript', 'pldev', 'hacktoberfest']
+++

Two years ago, I wanted to make my own games from A to Z, starting from the library I would use to handle entities, worlds, graphisms... to the tools next to that such as a map editor.

And I had this strange idea: what if I create my own scripting language?

In fact, I was using Lua but a few points here and there didn't suit me well (you have semi-classes with meta tables ; arrays start at 1 ; you need a bunch of ugly hacks for many common things related to OOP, which is really useful (imo) in video games scripting).

TL;DR: this isn't an experiment I would recommend to beginners since it's time eating and you'll lose a lot of hair while developing such a project ; but you'll also learn a lot if you know where you're going.

So I started to develop my own language Kafe, which was meant to run on a virtual machine I would as well create. Ugh, this went bad. I started from the end by creating the virtual machine first (while having already chosen the syntax) ; it was really hard to debug it since I had to write the bytecode by hand for every single test... and I couldn't get myself to work on the compiler afterward.

Fast forward a few months, I started developing a Lisp clone for fun, and I challenged myself to add a compiler after having done the lexer/parser/repl part. Before talking about that, just a few words about what those things are:

* a lexer is a program taking a text in input and returning a list of tokens. A token is atomic, you can't divide it, for example `1.1` is a single token, while `print("hello")` will be separated in multiple tokens, it could be `print`, `(`, `"hello"`, `)`.
* a parser is taking a list of tokens from the lexer in input, and returns an Abstract Syntax Tree (also called AST) made from the tokens:
```
# input program:
a = 1 + 2
print(a + 4)

# possible AST:

                Program
                /      \
               /        \
        Assignment    FunctionCall
        /     \          /        \
 Variable     Value    Function    Arguments
    |           |          |           |
    a       Addition     print      Addition
             /    \                  /    \
             1    2            Variable    4
                                   |
                                   a
```
* a REPL is a read-eval-print-loop, it will read code, send it to the lexer, get the tokens from it, send them to the parserr, retrieve the AST, and read through it to create variables, execute arithmetics operations... and get back to the first step. As you can understand, it's quite slow

So I started to work on a compiler, but before I could start, I needed to know how I would create the binary file, which operations will I need, which format should I use. A good start was my experiment with Kafe, whose bytecode was inspired from Python's. The idea was to have a binary file presented like this:

```
magic constant, to make sure we're running a binary file created by the compiler, and not trying to run a powerpoint

version of the compiler used to create the file

timestamp of when the file was compiled

symbols table
- number of symbols
- symbols represented as null terminated strings

values or constants table
- number of values
    - type of value to know what we are reading
    - value encoded following it's type

code pages
- number of pages
    - number of opcode on the page
    - opcodes
```

We should reference variables/functions with integers only, to avoid having to read a lot of bytes each time we need to use a variable/function, thus we need a symbol table. The values/constants table has the same role, but for constants, to avoid repeting them all over the bytecode. Finally, an opcode is something as in assembly: `save 1` (save value from the top of the stack into a variable named following by the symbol n°1), `load_const 2; load_const 4; add` (load constants 2 and 4 from the constants table on the stack, add them and push the result on the stack).

The hardest part wasn't conditions (thanks to internal `goto`s) or scoping (automatically handled by the virtual machine) but the functions. That's why I introduced multiple code pages, one per function, the n°0 being for the global scope. A function should receive arguments from the stack, have it's own stack to avoid messing up the stack of the previous function call, and must be able to return a value from its stack to its parent's stack!

The idea here was to push argument on the current stack, then use `CALL code_page_number number_of_arguments` which would take `number_of_arguments` from the stack, jump to the code page of the function, push the arguments in the right order, and continue running. The function should have instructions like `store_from_stack symbol_id` at the beginning, to store the arguments in variables referenced by symbols in its scope. Again, the code generation should know in which order the `store_from stack symbol_id` should be generated, otherwise you could end up with something like this:
```
def foo(a0, a1):
    print(a0, a1)

foo(1, 2)

=====>

global_scope:
  load_const 0  # 1
  load_const 1  # 2
  # here, the stack is: [2, 1]
  call 0 2      # symbol 0: foo, 2 arguments

foo:
  # the stack is still [2, 1]

  store_from_stack 1  # symbol 1: a0
  # we stored 2 in a0

  store_from_stack 2  # symbol 2: a1
  # we stored 1 in a1
  ...
```

The arguments were received in reverse order! That was one problem with functions, more came when handling scoping in the virtual machine, but luckily I'm just talking about the compiler here. :)

Then the virtual machine will just read through the opcodes, using some `if`s to know what to do, what to take and from where (the symbols table? the values/constants table? the stack?).

------

As you can see, I was (and I still am) a bit crazy, but I learnt a lot from it. I went through two major refactors:
* the first one when I removed entirely the REPL to have only a compiler, because keeping a coherence between both is pretty hard ; I had to rewrite my parser multiple times to handle more edge cases and separate it from the REPL, as well as the lexer
* the second one when I wanted to have a cleaner virtual machine, add a plugin table (to be able to load DLL as plugins and use C/C++ code in the virtual machine), more performances with my closures (another hard time because they are functions, but... not really, since they must save captured variables, thus act as a scope) and function calls in general

The syntax barely changed, and even tried to re-brand Lisp:
```
{
    (let fibo (fun (n)
        (if (< n 2)
            n
            (+ (fibo (- n 1)) (fibo (- n 2))))))

    (print (fibo 28))  # display 317811
}
```
where `{...}` acts as a shorthand for `(begin ...)` and `[...]` for `(list ...)`.

The goals of this project were to be able to create my own scripting language for my projects, thus it needed to be fast, but also expressive to improve productivity, and finally small to be able to embed it everywhere without having to include 10 GB of garbage (V8, I'm looking at you right now).

Well, I must say I'm quite proud of what I did with ArkScript!

[ArkScript](https://github.com/ArkScript-lang/Ark)

I'm of course still working on it, expanding what it can do by adding plugins and files to its standard library, and improving its stability and speed, and I would be more than happy to answer your questions about it, or help you getting started with it!

Happy hacktoberfest everyone!

