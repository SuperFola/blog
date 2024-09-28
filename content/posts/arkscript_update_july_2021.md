+++
title = 'ArkScript - March 2021 update'
date = 2021-03-21T23:22:45+02:00
tags = []
categories = ['arkscript']
+++

Hello, it's been a while, and I'm back with some good news!

We're still hard at work on the language, with UTF8 on the agenda (for strings and maybe identifiers), macros with variadic argument management coming soon, various optimizations, and we're in the process of expanding the standard lib and modules.

To test all this, I've created a mini blockchain in the language: [https://github.com/ArkScript-lang/Ark/blob/dev/examples/blockchain.ark](https://github.com/ArkScript-lang/Ark/blob/dev/examples/blockchain.ark).

The project's two-year anniversary is at the end of April, by which time I hope to have finished supporting macros that should be able to do as much or more than the C preprocessor:

```lisp
!{name 12}
!{if (= name 12)
  !{a (...args) (print args)}
  !{a (...args) (print “no”)}}
!{foo (a b c) {(let a 12) (let b 12) (let c 12)}}
```

With the option of calling one macro from another for a little extra spice.

One of the finest optimizations is a switch (internally) to a single linear stack rather than a stack of stacks, which took us from 90ms to 55ms on Ackermann Péter (3, 6), an extremely greedy recursion test. We're still a long way from Python, but the aim isn't to catch up with it or surpass it, simply to be fast enough to be used properly.

The full changelog is [here](https://github.com/ArkScript-lang/Ark/blob/dev/examples/blockchain.ark) for you curious people.

