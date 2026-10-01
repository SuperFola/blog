+++
title = 'Inlining IR for ArkScript'
date = 2026-07-19T12:19:00+02:00
tags = ['arkscript', 'pldev']
+++

{{< highlight_scripts >}}

A while ago, I added an intermediate representation to ArkScript, to be able to compress some sequence of instructions into super instructions, doing multiple things at once. This helped improved the overall language performance, as you can see in [this post]({{< ref "/posts/implementing_an_intermediate_representation.md" >}}). Now that the tooling is in place, we can do more, like inline some bits of IR to remove function calls overhead when possible!

## basic ir inliner

inlining heuristic (check for arg count, they should match!)
copy ir where it was called -> bug with load fast by index, indices get screwed up
okay, then while inlining, deoptimise load fast by index to load fast
not that good, so let's keep load fast by index, but create a scope around inlined code

## perf

is it good perf wise? benchmark to do (should be, because creating a scope doesn't cost much, if anything at all, same for removing a scope)

## another hurdle

it somewhat works? bug with
```text
(let abs (fun (_x) (if (< _x 0) (* -1 _x) _x)))
(let gcd (fun (_a _b) (if (= 0 _b) _a (gcd _b (mod _a _b)))))
(let lcm (fun (_a _b) (* (abs _a) (/ _b (gcd _a _b)))))
```
because `(abs _a)` returns a ref to `_x`, which is overwritten later on by a call to `gcd`, so we get 0

POP_SCOPE inst now has a mode: 0, just destroy ; 1, materialise the top of the stack if it's a reference (`*ts = *ts->reference();`)

## improved inlining heuristic

better inlining is possible: inline builtin proxies too!
why? the ir optimiser does an opti but we could do way better

inline functions that were only declared once, just in case

## perf

{{< highlight_arkscript >}}
(import std.String)
(import std.Benchmark)

(bench {
  (mut i 0)
  (mut acc 0)
  (while (< i (len string:asciiLetters)) {
    (set acc (+ acc (if (string:surrogate? (@ string:asciiLetters i)) 1 0)))
    (set i (+ 1 i)) }) }
  10000)

# with inlining
#  ↪︎ range: [0.0179 - 0.484] ms
#  ↪︎ mean: 0.0215ms
#  ↪︎ median: 0.021ms
# without:
#  ↪︎ range: [0.021 - 31.6] ms
#  ↪︎ mean: 0.038ms
#  ↪︎ median: 0.0241ms
{{< /highlight_arkscript >}}

between 13% and 43% better performance wise

