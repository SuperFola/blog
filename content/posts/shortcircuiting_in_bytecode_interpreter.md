+++
title = 'Adding short-circuiting in a bytecode interpreter'
date = 2024-09-10T15:48:00+02:00
tags = ['bytecode', 'vm']
categories = ['pldev']
+++

[In the previous article]({{< ref "/posts/function_calls_in_bytecode_interpreters" >}} "Function calls in bytecode interpreters"), we saw how to compile functions and handle their scopes. We also saw how to optimize a certain kind of function calls, the tail call ones in [Understanding tail call optimization]({{< ref "/posts/understanding_tail_call_optimization" >}} "Understanding tail call optimization"), now we are going to see yet another optimization, this time on conditions and expression evaluation.

## Basic way to deal with conditionals

Following the previous article(s), we could implement `and` / `or` as follows:

```
# a and b
LOAD a
LOAD b
AND

# foo() and bar()
LOAD foo
CALL 0
LOAD bar
CALL 0
AND
```

As you can see, each argument have to be evaluated before calling the operator, which is not something we might want! In mainstream languages like C, C++, Java, Python... the expression `a and b` would evaluate `b` only if `a` is **true**. If `a` is **false**, no need to evaluate the rest of the expression: it will be **false**. Same thing goes for `or`, if `a` is **true**, no need to evaluate the rest of the expression: it will be **true**.

## Understanding how short-circuiting works

What we want is evaluate arguments one at a time in an expression, and immediately stop if we have a **false** in an `and` expression, or **true** in an `or` expression. In Python you could write it like this:

```python
if a and b:
    print("hello")
# vvv
if a:
    if b:
        print("hello")
# else: ...

# -----------------

if a or b:
    print("hello")
# vvv
if a:
    print("hello")      # <-+--- this is exactly the same code,
else:                   #   |    actually not duplicated once
    if b:               #   |    compiled.
        print("hello")  # <-/
```

1. (and) We check if `a` is **true**, if not do nothing. Otherwise, evaluate `b` and act accordingly.
2. (or) We check if `a` is **true** and execute our code. Otherwise evaluate `b` and if **true** execute our code.

## Implementation in bytecode

Let's see how `and` is implemented in [ArkScript](https://arkscript-lang.dev) (as of 16/09/2024):

```
LOAD_SYMBOL a
DUP
POP_JUMP_IF_FALSE (after)  ---`
POP                           |
LOAD_SYMBOL b                 |
                  <-----------+
```

1. We load our `a` variable as before and duplicate it
2. We duplicate it for later use
3. We pop the duplicate, if it is **false** we jump after the expression, on the next instruction (which could be a store or another compare ; thanks to the duplicate, we still have the **false** value here at the end
4. If it is **true**, we pop the original value, we don't need it anymore and just load `b`. As in `3.` we continue with no special treatment with the next instruction, now having our boolean loaded to compare it, store it...

And that's it, we don't have to have a specific implementation to handle `if a and b` and `val = a and b` separately, as we jump on the next instruction, which might be a `POP_JUMP_IF_FALSE` in the case of a condition (to avoid executing the code of the condition), or a `STORE` in case of a variable assignment.

> [!NOTE]
> Implementing `or` would be practically identical, apart from the `POP_JUMP_IF_FALSE` instruction that would be a `POP_JUMP_IF_TRUE`!

