+++
title = 'ArkScript - December 2024 update'
date = 2024-12-24T09:15:00+02:00
tags = []
categories = ['arkscript']
image = ''
+++

Hello there!

/* todo: X, Y, Z, N */
In the last 90 days, X files were modified, totaling Y insertions and Z deletions, in N commits. The primary goal was integrating an intermediate representation!

## Compiler ire...?

The compiler didn't get angry, but now outputs instructions in a new intermediate representation (IR), that is then compiled to bytecode for the virtual machine!

Why the extra step, you might ask? I wanted to be able to add *super instructions*, which relies on merging some instructions together to do more in a single instruction. Introducing an IR that is easy to handle seems like a good fit for this task. We could have a `LOAD_CONST_STORE` instruction, to avoid pushing to the stack and then popping, and much more small improvements like this.

Introducing this IR didn't change anything, as it is 96% based on the instruction set. The small difference is that we have to handle jumps differently, since we want to be able to merge instructions, jump offsets might change. If you're interested about this, go read [Implementing an IR for ArkScript]({{< ref "/posts/implementing_an_intermediate_representation.md" >}}).

## More optimizations!

- computed gotos
- super instructions + IR optimizer

/* todo: benchmarks */

baseline - computed gotos - super instructions

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

## Coverage report

todo

