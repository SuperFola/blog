+++
title = 'ArkScript - July 2020 update'
date = 2020-07-11T12:23:45+02:00
tags = []
categories = ['arkscript']
+++

Hi there!

So we've got a new interpreter (REPL) that has persistence between each line typed (previously each piece of executed code was forgotten as soon as new code was typed), coloring and auto-completion, all using the replxx lib (in C).

Then, I've recently added dead code elimination (to the global scope only) during compilation, a home-made lexer with no regex and much faster (and which finally handles escape sequences, although I'll have to find a way to make the \u \U and \x sequences work), better plugin loading (dynamic and not static now, so you can do conditional import depending on the OS, for example).

Also, in terms of memory usage, plugins adding objects to ArkScript (eg. an SFML window) can now have these objects properly destroyed when the scope in which the object is located is destroyed.

Internally, the new string has a template formatting function, so `str:format` has also been impacted. Eg: `(str:format “test % something %% %% 0x%x the end %% ok” 256 “hello” -12345 3735928559)` will ouput `test something hello -12345 0xdeadbeef the end %% ok`. If you give too many arguments and not enough `%%` sequences, they won't be used; if you give too few, the `%%` will remain as they are, allowing you to format in several stages.

In terms of std lib, we've moved it to a new repository so that we can update it without touching the main repository, and we're in the process of doing a big documentation and renaming pass to clarify a lot of things, with variable names of the `namespace:function` type, eg: `list:reverse`. As long as we don't have a macro, the namespace will be mandatory and non-modifiable, as it's 100% part of the variable/constant name.

In terms of errors, we have better error messages to indicate where we went wrong (in lexing and parsing, compilation and VM too).

In lexing/parsing, you'll get something like:

```lisp
main:007> (if)
class Ark::ParseError: ParseError: no more token to consume
On line 1:59, got TokenType::Grouping
    1 | (if)
      |    ^
    2 | no more token to consume
Ark::State::doString failed
```

In the VM, we get better messages when a variable is unknown / unusable or when we have import problems:

```lisp
main:001> (print a)
unbound variable: a
At IP: 2, PP: 0

main:001> (let a 12) (print (a))
Can't call 'a': it isn't a Function but a Number
At IP: 11, PP: 0

main:012> (import "blabla")
could not load plugin: blabla
At IP: 44, PP: 0

main:013> (import "blabla.ark")
class std::runtime_error: While processing file FILE, couldn't import blabla.ark: file not found
Ark::State::doString failed
```

