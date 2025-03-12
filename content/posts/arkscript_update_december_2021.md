+++
title = 'ArkScript - December 2021 update'
date = 2021-12-11T16:52:45+02:00
tags = ['arkscript']
categories = ['arkscript']
+++

Hello, it's been a long time since I posted here, I've neglected communication too much to concentrate on code and school work.

## Progress

Since the last post, the project has undergone a lot of refactoring:

- 210 files modified,
- 11,273 lines added,
- 8,065 lines deleted (not enough for my taste).

Broadly speaking, the project has been reworked to make it easier to integrate into other projects, and also to consider publishing it on the Arch Linux repositories. We've added numerous tests, both in the language and in C++, to ensure that the language and its integration into C++ projects continue to function smoothly (a C interface is planned).

I must also say that the macro processor has been working since I announced its existence. A lot of bugs were found, but a new developer has joined us and helped us to resolve them, by improving the structure of the macro processor.

Another news is the integration of functions that work explicitly by reference: `append!`, `concat!` and `pop!` (and their equivalents without `!`). These functions are used to work on lists, which are otherwise copied as many times as necessary when using the safe (without `!`) versions, which all return a new list created from their arguments. Unsafe functions (in the sense of “breaking the immutability of the language”) take as arguments references to mutable objects (so `(append! [1 2] 3)` is invalid), modify their argument (the first one, the others can be (non)mutable copies/references) *in place* and always return `nil`.

Finally, we took the plunge and defined a clang-format to have a uniquely formatted code, easily readable by the whole team (which varies between 4 and 6 people who are there permanently). The CI has been revised and now allows us to generate binaries for Windows, Linux and MacOS, with an InnoSetup script now created for Windows versions.

Our documentation generator, [ArkDoc](https://github.com/ArkScript-lang/ArkDoc), has been completely reworked in Python and now allows us to output in several formats (HTML, Markdown (still in progress, but in itself it's not too complicated, if I ever get around to it)): [https://arkscript-lang.dev/std/](https://arkscript-lang.dev/std/) (which *theoretically* redirects to the latest version of the documentation).

## What's planned for the future

- a refactor of the virtual machine, to enable simpler addition of parallelism
- elimination of a side-effect of a stack VM: trashing: `(while true 1)` will push the value 1 on the stack infinitely, and this can be prevented by modifying our compiler, but it's not trivial
- improve our REPL (more controls, direct access to documentation)
- improved type errors to help the user
- rewrite the manager package, which has never been tested or used despite being considered “finished”.

---

We've still got a lot of work to do, but we're getting close to something that could be considered “finished” (more in the sense of “complete, working well” than “finished” though).

