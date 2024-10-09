+++
title = 'Implementing an Intermediate Representation for ArkScript'
date = 2024-10-01T17:45:45+02:00
tags = ['arkscript']
categories = ['pldev']
+++

ArkScript is a scripting language, running on a VM. To accomplish this, we had (as of September 2024) a compiler generating bytecode for the virtual machine, receiving an AST from the parser (and a few other passes like name resolution, macro evaluation, name and scope resolution...).

## Exploring new optimizations

The only thing we could optimize was the virtual machine and the memory layout of our values, and some very little things directly in the compiler, like [tail call optimization]({{< ref "/posts/understanding_tail_call_optimization.md" >}}). Having implemented [computed gotos]({{< ref "/posts/computed_gotos.md" >}}) a few weeks ago, I think I've hit the limit in term of feasible optimization for this VM.

For a while, a friend tried to push me toward making an *intermediate representation* for ArkScript. I shrugged it off, saying it was too much work, not really knowing what I would get into and having bigger fish to fry.

### Biting the bullet

At the end of September, I stumbled upon [a post by Eniko on Mastodon](https://peoplemaking.games/@eniko/113211730549249447) (if you don't follow her already, what are you waiting for?), and the idea of making an IR came back into my mind... and I just started thinking about, but seriously this time.

What were my goals?

1. Optimizing the bytecode produced by the compiler, so that we could remove useless or redundant instructions ;
2. Replacing a serie of instructions by a single one, more specific, that could do multiple things at once.

**Problem**: operating directly on bytecode is hard: we either need
- to replace instructions with `NOP` (that would still be decoded and run by the VM, even to do virtually nothing)
- to recompute every single jump address after merging or removing instructions (this problem appears with both relative and absolute jumps)

## Designing the IR

The IR would have to solve this problem, otherwise it would be useless for its single job: helping in producing better bytecode. Let's see what we can work with:

The *compiler* job is to flatten the AST (*Abstract Syntax Tree*, our parsed code represented as a tree that we visit recursively) into a list of instructions. To simplify the calling convention, each function is compiled in a dedicated region that I call a **page**. Inside a **page**, each jump is relative to the first instruction, and the bytecode is essentially a `uint8_t[][]`, that we can access using a `page pointer` and an `instruction pointer`.

### First draft

My first idea was to output a tree of IR instructions instead of a list of instructions. That would still be flatter than the AST, and on paper it would solve the jump problem as we have jumps only for loops and conditions.

If we use a Lisp-like (ArkScript-like?) syntax, it could look like this

```
(store a 0)   # a = 0
(setval a 5)  # a = 5
(load_symbol a)
(load_const 0)
(gt)          # (< a 0)
(if
    then...
    else...)
```

However I didn't really like this idea, it felt like reinventing the wheel, another tree, as we have a non-flat structure to handle a sequence of conditions `(if cond (if cond2 ...))`.

### Second try: getting rid of jumps altogether

This time, we will use a structure very similar if not identical to the bytecode, and get rid of all the `JUMP` instructions. Taking inspiration from assembly, they will get replaced by **labels** and **gotos** in our IR! This way we can add and remove as many instructions as we want, as long as we don't update a **label** we can still compute its address later and compile our **gotos** to absolute jumps without any issues.


1. Go through the IR inst look for Load store, load load, store store...
2. Do not work on load label store as that would break the label/goto (investigation needed here)
3. Go through all the code to remove NOP
4. Go through the code to find the labels and their address, to compute the final bytecode
