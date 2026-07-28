+++
title = 'Inlining IR for ArkScript'
date = 2026-07-19T12:19:00+02:00
tags = ['arkscript']
categories = ['pldev']
+++

basic ir inliner
inlining heuristic (check for arg count, they should match!)
copy ir where it was called -> bug with load fast by index, indices get screwed up
okay, then while inlining, deoptimise load fast by index to load fast
not that good, so let's keep load fast by index, but create a scope around inlined code
is it good perf wise? benchmark to do (should be, because creating a scope doesn't cost much, if anything at all, same for removing a scope)

it somewhat works? bug with
```
(let abs (fun (_x) (if (< _x 0) (* -1 _x) _x)))
(let gcd (fun (_a _b) (if (= 0 _b) _a (gcd _b (mod _a _b)))))
(let lcm (fun (_a _b) (* (abs _a) (/ _b (gcd _a _b)))))
```
because `(abs _a)` returns a ref to `_x`, which is overwritten later on by a call to `gcd`, so we get 0

POP_SCOPE inst now has a mode: 0, just destroy ; 1, materialise the top of the stack if it's a reference (`*ts = *ts->reference();`)

better inlining is possible: inline builtin proxies too!
why? the ir optimiser does an opti but we could do way better

inline functions that were only declared once, just in case
