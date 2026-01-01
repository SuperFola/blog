+++
title = 'Using ArkScript for the Advent of Code 2025'
date = 2026-01-01T00:34:00+02:00
tags = []
categories = ['arkscript']
+++

Last month I got to use [ArkScript](https://arkscript-lang.dev), a language I've been developing for nearly 7 years, for the Advent of Code. And this time, I got to the end, using only my language (and a few hints from [programming.dev](https://programming.dev))!

## Adding attributes to functions' arguments

Advent of code challenges are often heavy on lists, with inputs sometimes being thousands of lines long. After benchmarking some of my solutions, I noticed passing big lists to helper functions (eg a `(get grid x y)` that would check for width and height) was slower than doing the check in place and duplicating code. This is due to ArkScript "no hidden behaviour" rule: arguments are always passed by value, and no hidden references are used.

This was a now a problem, and after years of refusing to alter the function declaration syntax, I cave and added *function arguments' attributes*: we now could declare an argument as *mutable* (all arguments are immutable by default inside a function body) or as a *read-only reference*, on a per argument basis:

```lisp
(let foo (fun (a (mut b) (ref c)) {
  # ...
  a }))
```

## Better UX with type errors

ArkScript being a dynamic language, type checking is done at runtime. And I hit a few too many unhelpful type errors during the challenge, so I rewrote the error generator to be clearer:

**Before**

```
Function list:reverse expected 1 argument but got 3
  -> list (List) was of type Number
```

Hard to know what were the arguments, where we messed up.

**After**

```
Function list:reverse expected 1 argument
Call
  ↳ (list:reverse "hello")
Signature
  ↳ (list:reverse list)
Arguments
  → `list' (expected List), got "hello" (String)

In file tests/unittests/resources/DiagnosticsSuite/typeChecking/listreverse_str.ark:1
    1 | (builtin__list:reverse "hello")
      | ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    2 |
```

We now show the how the function was called, the signature, and details about each argument, with source code location!

## Fixing the testing library

Running advent of code solutions often takes time, and even more when you add tests to ensure your solver is correct for edge cases. That's when I noticed some code was being run twice when a test case failed.

Test cases are declared using the `test:eq`, `test:neq` and `test:expect` macros. Since they are macros, they blindly paste their arguments inside a `(if (= expected value) (report_success) (report_error expected value))`, and now we have our solver running twice when there is an error, because we passed a function call to `test:eq`:

```lisp
(test:suite day4 {
  (test:case "part 1" {
    (test:eq (solve sample false) 13)
    (test:eq (solve data false) 1495) })

  (test:case "part 2" {
    (test:eq (solve_until_0 sample) 43)
    (test:eq (solve_until_0 data) 8768) })})
```

Fixing this bug required evaluating expressions once with some trickery:

```lisp
(macro test:eq (_expr _expected ..._desc) {
  {
    # save the expected and expr, and use the variables later on!
    (set testing:_expected_res ($as-is _expected))
    (set testing:_expr_res ($as-is _expr))
    (if (= testing:_expected_res testing:_expr_res)
      (testing:_report_success)
      (testing:_report_error testing:_expected_res testing:_expr_res ($repr _expected) ($repr _expr) _desc)) } })
```

## Calls to print... sometimes fail?

ArkScript has an optimization for builtins, so that we can create proxies in the standard library `.ark` source files (which are scoped properly):

```lisp
(let reverse (fun (_L) (builtin__list:reverse _L)))
```

Would be optimized to:

```
page_1
	CALL_BUILTIN_WITHOUT_RETURN_ADDRESS builtin-id, arguments-count
.L0:
	RET
	HALT
```

Instead of:

```
page_1
	STORE 1
	PUSH_RETURN_ADDRESS L0
	LOAD_SYMBOL_BY_INDEX 0
	BUILTIN builtin-id
	CALL 1
.L0:
	RET
	HALT
```

`CALL_BUILTIN_WITHOUT_RETURN_ADDRESS` is a call instruction that doesn't push/pop arguments to/from the stack, avoiding a costly context switching. However, the optimizer tried to apply the optimization nearly everywhere, instead of just at the beginning of a bytecode page (which maps to a function). The following code would be optimized, and the `RET` instruction not being present would break everything:

```lisp
# some code...

(let a 5)
(print a)

# more code, that wouldn't be executed
```

## Better standard library

Doing the challenge this year was way easier than last year thanks to the state of the standard library, however there still was room for improvement:
- `list:forEach`, `list:window` and `list:enumerate` can take functors returning `list:stopIteration` to abort iteration early
- `list:sortByKey`
- `list:transpose` to transpose a list of lists or list of strings
- `list:contains?` to check if a list has a given element
- `list:permutations`, `list:permutationsWithReplacements` to generate permutations sequences
- `list:select` to select elements from a list by a list of indexes
- `io:readLinesFile`
- `unpackPair` macro to unpack a list of two elements into variables

## What's next?

I'd like to enhance the small framework I made for solving Advent of code challenges in ArkScript, and perhaps use it to complete the previous years challenges too! This is a fun way of playing with algorithms, and it helps find areas where the language could be improved.

