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

## Coverage report

todo

