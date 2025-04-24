+++
title = 'How does quoting works in ArkScript macros?'
date = 2025-04-24T11:48:47+02:00
tags = ['compiler', 'arkscript']
draft = true
categories = ['pldev', 'arkscript']
+++

The other night, I was talking about meta programming to other developers, and at one point someone asked how macros could be used to do meta programming. They were probably thinking about *C type of macros*, which are powerful but are just text processor tools.

> [!Macros]
> They are a tool to manipulate code, with code. It allows one to write generic code and have the compiler do the heavy lifting and monomorphize your code.


> [!NOTE]
> What's **meta programming**?
> 
> [According to Wikipedia](https://en.wikipedia.org/wiki/Metaprogramming), it's a computer programming technique in which computer programs have the ability to treat other programs as their data. It means that a program can be designed to read, generate, analyse, or transform other programs, and even modify itself, while running. In some cases, this allows programmers to minimize the number of lines of code to express a solution, in turn reducing development time.

Then someone asked how we could implement the following code in ArkScript (not working by the way, because Rust macros are hygienic):

```rust
macro_rules! using_a {
    ($e:expr) => {
        {
            let a = 42;
            $e
        }
    }
}

let four = using_a!(a / 10);
```

I quickly threw this together, and sure enough, ArkScript let it pass as its macros aren't hygienic:

```lisp
($ using_a (e) {
  (let a 42)
  e })
(let four {(using_a (/ a 10))})
(print four)  # 4.2
```

## Homoiconicity

It is the ability to manipulate code in the language, using code from the same language. Code is data, and data is code. Lisp is the most common homoiconic language, but we can also cite all its dialects (Clojure, Scheme, Racket...), as well as Rebol, and you guessed it, ArkScript.

Using parentheses to represent S-expressions in Lisp inspired languages helps as you can represent your AST in code, and AST is also data.

## Quoting?

In ArkScript macros, there is no capture of variables, you play directly with the AST:

```lisp
($ foo (val)
  (print (@ val 2)))

(foo (list 1 5)) # -> becomes (print 5)
```

As long as you are inside a macro, the AST node isn't evaluated unless it is involved in an expression that can be evaluated at compile time (eg `(+ 1 arg)`).

Alas it comes at a cost and expressions can be evaluated at compile when you didn't mean to, if the example was passed something like `(+ 1 2)` it would print 2! To prevent this behavior I thought I just needed to have a way to stop macro evaluation and added `$as-is` to paste nodes in the AST as-is, stopping further macro evaluation on them.

This is particularly useful in the testing framework that relies on many macros, we can write:

```lisp
(test:suite name {
  # ...
  (test:expect (some_computation)) })
```

As the `test:xxx` macros use `($as-is arg)` to escape each argument:

```lisp
($ test:expect (_cond ..._desc) {
  (if (!= true ($as-is _cond))
    (testing:_report_error true ($as-is _cond) "true" ($repr _cond) _desc)
    (testing:_report_success)) })
```

TL;DR: I reinvented (a less powerful) quote

