+++
title = 'ArkScript - December 2024 update'
date = 2024-12-15T17:29:00+02:00
tags = []
categories = ['arkscript']
image = ''
+++

Hello there!

In the last 90ish days, there were 841 files changed, 9323 insertions, and 5070 deletions, in 106 commits. The primary goal was integrating an intermediate representation, but then... I got side tracked.

## Compiler ire...?

The compiler didn't get angry, but now outputs instructions in a new **intermediate representation** (IR), that is then compiled to bytecode for the virtual machine!

Why the extra step, you might ask? I wanted to be able to add *super instructions*, which relies on merging some instructions together to do more in a single instruction. Introducing an IR that is easy to handle seems like a good fit for this task. We could have a `LOAD_CONST_STORE` instruction, to avoid pushing to the stack and then popping, and much more small improvements like this.

Introducing this IR didn't change anything, as it is 96% based on the instruction set. The small difference is how we have to handle jumps: since we want to be able to merge instructions, jump offsets might change. If you're interested about this, go read [Implementing an IR for ArkScript]({{< ref "/posts/implementing_an_intermediate_representation.md" >}}). The compiler now outputs IR entities, that the IR compiler compiles to bytecode.

This IR looks like this when dumped (useful for analysis, better than comparing byte codes):

```
page_0
	LOAD_CONST_STORE 0, 0
	LOAD_CONST_STORE 1, 1
	CREATE_SCOPE 0
.L0:
	LOAD_SYMBOL 1
	LOAD_CONST 2
	LT 0
	GOTO_IF_FALSE L1
	INCREMENT 1, 1
	STORE 0
	LOAD_SYMBOL 0
	CALL_BUILTIN 9, 1
	POP 0
	SET_VAL_FROM 0, 1
	GOTO L0
.L1:
	POP_SCOPE 0
	LOAD_SYMBOL 0
	CALL_BUILTIN 9, 1
	HALT 0
```

## More optimizations!

One optimization I wanted to work on, as said earlier, was to implement *super instructions*, basically merge two or more instructions together. As of today, those are:

- load multiple values at once on the stack
- load a value and store it in a variable
- copy a variable into another
- increment / decrement a variable by `n`
- store the tail / head of a list in a variable
- load a builtin `i` and call it with `n` arguments already on the stack

I also finished implementing [computed gotos]({{< ref "/posts/computed_gotos.md" >}}), which yielded a 10-15% overall performance improvement! For those unaware, *computed gotos* is like a while-switch, reading instructions one after the other, running it, and looping back up, but better for your CPU as it pleases way more the branch predictor. Thus, code is faster as the branch has an easier time learning jumps between instructions.

In this benchmarks report, we compare with: a baseline, then computed gotos, then super instructions + computed gotos (`{benchmark_id}-{commit_id}`):

```
                          |           | 5-57d0e0cd   | 6-c7f632ff          | 7-28999c0f
--------------------------+-----------+--------------+---------------------+---------------------
 quicksort                | real_time | 0.190424ms   | -0.022 (-11.3935%)  | -0.036 (-18.6841%)
                          | cpu_time  | 0.179065ms   | -0.011 (-5.8917%)   | -0.024 (-13.6537%)
 ackermann/iterations:50  | real_time | 78.6985ms    | -10.388 (-13.2004%) | -17.667 (-22.4485%)
                          | cpu_time  | 78.5711ms    | -10.337 (-13.1561%) | -17.596 (-22.3949%)
 fibonacci/iterations:100 | real_time | 7.43315ms    | -0.807 (-10.8582%)  | -0.967 (-13.0118%)
                          | cpu_time  | 7.42263ms    | -0.804 (-10.8377%)  | -0.965 (-13.0013%)
 man_or_boy               | real_time | 0.016108ms   | 0.001 (5.3210%)     | -0.000 (-2.7713%)
                          | cpu_time  | 0.0160867ms  | -0.000 (-0.3972%)   | -0.000 (-2.7551%)
```

Overall a pretty decent set of performance improvements! For now, I'll stop working on such huge refactors and optimizations, and focus on new builtins, enhancing the standard library, the documentation, the tests coverage...

## Coverage report

Which makes a nice segway for this section! I've worked on new functionalities, more optimizations, but that didn't stop me from adding five new test suites and about 90 more tests!

![./unittests](/tests_reports.png)

The new test suites:

- **Optimizer** tests the AST optimizer, and dead code elimination
- **Utf8** tests the utf8 library (decoding / encoding utf8 codepoints)
- **Tools** tests the C++ helpers (eg our implementation of Leveinshtein distance)
- **Compiler** tests the IR optimizer by dumping IR and checking that super instrucitons have been used
- **NameResolution** tests the namespaces resolution, hidding variable, prefixing them...

The biggest test suite to have been upgrade is the **Diagnostics** one, with more 70 new tests, testing even more error messages to ensure we still detect them in the future. I also finally fixed the line reporter of the parser, and tokens are *finally* underlined correctly:

```
# before
At a @ 2:9
    1 | (let a [])
    2 | (pop! a 1)
      |         ^
    3 |
        MutabilityError: Can not modify the constant list `a' using `pop!'


# after
At a @ 2:7
    1 | (let a [])
    2 | (pop! a 1)
      |       ^
    3 |
        MutabilityError: Can not modify the constant list `a' using `pop!'
```

Thanks to this, the [coverage](https://coveralls.io/builds/71349925) jumped from 73% to 79%!

## Finally done with imports!

This section was a bit spoiled earlier when I mentioned *name resolution*... It's about the new import system! Yes, the one I started working at the end of 2022!

We can finally import symbols from files (also called "packages" now), import files with prefix, or just import a few names from a file:

```
# import all, with a prefix
(import std.List)
(list:map [1 2 3] print)

# import only a few symbols
(import std.Math :even)
(print (even 5)) # false

# import all symbols without a prefix
(import std.String:*)
(print (reverse "hello")) # olleh
```

For now, files are imported "à la Python", you specify a package that's resolved from your current directory. Eg, `(import foo.bar.egg)` would search for `$CWD/foo/bar/egg.ark`, with `$CWD` being the current working directory of the script. The standard library gets a special treatment, you can write `std.List`, `std.Math`... from anywhere and import anything from the standard library.

All the work was done in the name resolution pass, that's now done right after processing macros, so that all names are computed (some variable names can be created by macros). If you want to learn more about the inner workings of this monstruosity, [I wrote an article about it!]({{< ref "/posts/designing_a_better_import.md" >}})

**TL;DR**: Once files are parsed, and the **Import Solver** has had a go at resolving `imports` and merging them, we are left with a single big AST, with `Namespace` nodes (multiple imports of a single file are merged together). Then, a new compiler pass, the **Name Resolution**, can register all symbols along with their prefix (if in a namespace), and replace them in another AST visit with their fully qualified name (this way, we avoid name conflicts).

> [!NOTE]
> Package prefixes are computed from the package string tail in lowercase ; eg for `(import std.List)`, the prefix will be `list:`.

## The AST optimization is back

The AST optimizer was disabled before (or during, I can't recall at this point) the compiler rewrite done in September~ 2024, because I needed a rewrite, and was sometimes working, sometime not, for unknown reasons (the algorithm that marked and removed unused code was just bad.

It's now counting all symbols uses, so that when we visit the top declarations (as well as any namespace nodes, resulting in the inclusion of a file), we can delete them if we know they are mentionned only once (only the declaration uses the symbol).

I've also added basic dead code elimination, so that we can:

- delete `(if false then)`
- replace `(if true then [else])` by `then`
- replace `(if false then else)`  by `else`
- delete `(while false body)`

It's just a base for now, in the future I would like to be able to reduce expressions so that we can remove more dead code at compile time, eg `(if (= 0 1) then)` can't be eliminated by the **Optimizer** yet.

## Advent of code!

This year, I've taken up the challenge of completing the [Advent of Code](https://adventofcode.com/2024/) in ArkScript itself (you can see my solutions [on GitHub](https://github.com/SuperFola/advent_of_code_2024))!

![My contribution to this year's Advent of Code ; looks like a cute camel? Or maybe a snake](/advent_of_code.png)

I've stopped quite early (day 9 as of writing), but that was quite insightful, as I found many things to improve. Amazingly, my solutions run quite fast too, I've only had to resort to Python when I didn't know how to solve a challenge and did the lazy thing of looking it online, running the script, checking the answer, and then seeing how I would translate it to ArkScript.

Things improved:

- `string:find`
- `string:setAt`
- `@=` and `@@=`
- dedicated scope around loops
- `@@`

## Tasks done

![Tasks tracker](/tasks.png)

135 -> 159 total

