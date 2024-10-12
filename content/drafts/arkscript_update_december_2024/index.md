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

// TODO: update ref to article drafts -> posts
Introducing this IR didn't change anything, as it is 96% based on the instruction set. The small difference is that we have to handle jumps differently, since we want to be able to merge instructions, jump offsets might change. If you're interested about this, go read [Implementing an IR for ArkScript]({{< ref "/drafts/implementing_an_intermediate_representation.md" >}}).

## More optimizations!

- todo
- todo

/* todo: benchmarks */

```
                          |           | 0-684ea758   | 4-ad889963          | 5-ee9ff764
--------------------------+-----------+--------------+---------------------+---------------------
 quicksort                | real_time | 0.152787ms   | -0.011 (-7.4961%)   | -0.002 (-1.5518%)
                          | cpu_time  | 0.152334ms   | -0.011 (-7.4757%)   | -0.002 (-1.3825%)
 ackermann/iterations:50  | real_time | 81.2917ms    | -14.163 (-17.4218%) | -21.385 (-26.3065%)
                          | cpu_time  | 80.9612ms    | -14.116 (-17.4358%) | -21.132 (-26.1011%)
 fibonacci/iterations:100 | real_time | 7.51618ms    | -1.483 (-19.7270%)  | -1.244 (-16.5506%)
                          | cpu_time  | 7.4984ms     | -1.484 (-19.7880%)  | -1.233 (-16.4476%)
 man_or_boy               | real_time | 0.015211ms   | -0.000 (-1.4010%)   | 0.000 (0.8264%)
                          | cpu_time  | 0.0151691ms  | -0.000 (-1.7134%)   | 0.000 (1.0277%)
```

IR go brrrrrrrr

## Coverage report

todo

