+++
title = 'ArkScript, a functional scripting language!'
date = 2019-07-25T20:11:45+02:00
tags = ['arkscript']
categories = ['arkscript']
+++

Hi there, fellow reader! Today, I want to talk about a small project I've been working on since April 2019, [ArkScript](https://github.com/ArkScript-lang/Ark).

After the failure of Kafe, I wanted to make another language but this time Lisp inspired and interpreted. Then Ark was born (later renamed ArkScript, see [this reddit post](https://www.reddit.com/r/ProgrammingLanguages/comments/cdv2vw/ark_programming_language_a_lisp_like_scripting/etwoo6p)). Then I tried actually compiling this language, and instead of starting to make the virtual machine before the compiler, I did it properly, and here we are.

ArkScript follows Kafe philosophy of scripting video games, but that's it. Slowly, it evolved into "scripting any C++ project".

## Goals

- immutability by default
- strongly and dynamically typed
- no hidden references like Python and lists
- very few keywords (9)
- closures with explicit capture
- features before performances
- async any function

ArkScript is inspired by Lisp (for ease of parsing, among other things), everything is immutable by default, and everything is passed by value. This represents a cost at runtime, which I'm willing to pay (although all functions working on lists avoid copying as much as possible, without involving hidden references as Python would). The aim of the project is not to outperform well-done C, but to give priority to features (even if I've worked a little on performance so as not to be left behind), so as to be more productive when coding with this language.

I wanted the language to run on a VM, for the performance gain compared to interpreting a tree, and for portability: you compile Ark code once, and it works everywhere as long as the VM is installed.

Parsing is very straightforward, being a lisp like operation, there's not much to do. The most complex part is the compiler/VM pairing, as a lot of things need to be done to provide a high-level language. So we have the elimination of cyclic dependencies in parsing, the reduction of constant expressions by the compiler, as well as the elimination of dead code (in the global scope only) and expression statements (so as not to pollute the VM with unused values). The whole package is sprinkled with a Turing Complete macro processor (recursive, co-recursive macros, etc.).

The language is dynamically and strongly typed, and allows heterogeneous lists. What's more, there are no hidden references that the user can manipulate, which I find very important for preserving this aspect of immutability when declaring a variable with let. Internally, on the VM side, references are used but will never reach the user as is, and will only see their value copied at the desired moment (copy on write).

Finally, ArkScript aims to be concise, offering just 9 keywords: `let`, `mut` and `set` for constants/variables, `begin` for blocks, `if` and `while` for control flow, `del` to clear memory manually (ArkScript also takes advantage of the RRID of the implementation language, C++), `import` to import Ark code and binaries that use a special API (e.g. to load SFML, manipulate the console...), and `fun` to declare a function or closure (with explicit capture).

The language is designed to be small enough to be used in a project without taking up too much space: the virtual machine takes up less than 3,000 lines (including all the files in the `VM/` folders). See [this benchmark from October 2020](https://gitlab.com/nuald-grp/embedded-langs-footprint/-/tree/master), which compares ArkScript 3.0.13 to other languages including ChaiScript, Lua and Python.

## An ecosystem of plugins

The language is intended to be extensible, and to this end it exposes an API for easily creating a C++ plugin, which can be loaded by the virtual machine, for example to :

- make HTTP calls
- play with terminal colors
- parse JSON
- communicate with a SQLite3 database
- [and much more](https://arkscript-lang.dev/impl/usergroup0.html)

## Some examples

A small example that uses closures with explicit capture (via the `&capture` notation), closure field reading (dot notation) to simulate object orientation (with no possibility of modifying the object from the outside, everything is read-only when you're not in the closure):

```lisp
(let create-human (fun (name age weight) {
    # functions can be invoked in the closure scope
    (let set-age (fun (new-age) (set age new-age)))

    # this will be our "constructor"
    (fun (&set-age &name &age &weight) ())}))

(let bob (create-human "Bob" 0 144))
(let john (create-human "John" 12 15))

(print bob.age)
(bob.set-age 10)
(print bob.age)

(print john.age)
```

The Ackermann Péter function, which I use for my benchmarks, is a non-primitive recursive function, so it can't be optimized by a compiler. It's very useful for testing the implementation of a language:

```lisp
(let ackermann (fun (m n) {
    (if (> m 0)
        (if (= 0 n)
            (ackermann (- m 1) 1)
            (ackermann (- m 1) (ackermann m (- n 1))))
        (+ 1 n) )}))

(print (ackermann 3 6))
```

Releases are available [here](https://github.com/ArkScript-lang/Ark/releases/latest) (the standard lib is supplied with each release, as are the .arkm modules).

Here's the GitHub repo for the [https://github.com/ArkScript-lang/Ark](https://github.com/ArkScript-lang/Ark/releases/latest) project. Don't hesitate to take a look at [the project website](https://arkscript-lang.dev/) and [documentation](https://arkscript-lang.dev/documentation.html)!

