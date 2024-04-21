+++
title = 'Understanding tail call optimization'
date = 2022-02-20T23:02:10+02:00
draft = false
keywords = ['vm', 'bytecode', 'pldev']
+++

Lately, I've been working on optimizations for my language, [ArkScript](https://arkscript-lang.dev), and finally take some time to add tail-call optimization to my compiler.

In this article, I'll explain what is *tail-call optimization*, why it seems easy to implement, and how to do it.

## Definition

Tail-call optimization is a method to optimize some recursive functions so that we don't have to create a bunch of stack frames to execute, and reuse only one. This leads to less memory being used and more performances, as we don't have to create and destroy a bunch of stack frames.

The functions we can optimize with said methods are the tail recursive ones:

```
let factorial = (n, acc) {
    if (n <= 1)
        return acc
    else
        return factorial(n - 1, n * acc)
}

print(factorial(10, 1))
```

This is called a tail recursive function because the last call of the function is a call *to itself*.

Note that our `factorial` function takes an additional parameter, an accumulator, because the following implementation wouldn't be tail recursive:
```
let factorial = (n) {
    if (n <= 1)
        return 1
    else
        return n * factorial(n - 1)
}
```
as the last operation of the function isn't a *call to itself*, but the multiplication between `n` and `factorial(n - 1)`.

## Why can we optimize tail recursive functions?

The last thing these functions are doing is a call to themselves, thus all previous state can be discarded as it's either being passed as arguments to the function, or not being used at all. Thus, we don't have to keep a state somewhere in case the function returns and need something from this state (which **is needed** in the version returning `n * factorial(n - 1)`).

Thus, we can rewrite the tail recursive functions with loops:

```
let factorial = (n, acc) {
    while (true) {
        if (n <= 1)
            return acc

        // we replace the recursive call with this
        acc = n * acc
        n = n - 1
    }
}
```

## How to implement this optimization?

When we look at the above snippet, it seems that replace the last function call of a function by its argument list and the values, and adding a jump to the beginning of the function, is all we need to do. In fact, this is right. The hard part is identifying a tail call.

Given a recursive compiler on an abstract syntax tree, you'll need:
1. to keep track of the name of the current variable being compiled (here we need to know the variable name is `factorial` when we are compiling its body)
2. to know if the current node will be returned or not (if it's the value given to the `return` keyword)

The first part is quite easy, just send another argument to `compile(node)` when compiling a variable definition. The second one is equally easy, add two arguments to your `handleFunctionCall(node)` to tell it the name of the current variable (if any) and if the node is going to be returned or not.

Then the implementation is as simple as this:

```cpp
void Compiler::handleFunctionCall(const Node& node, const std::string& var_name, bool is_returned)
{
    // checking if the function we are calling has the same
    // name as the current function being compiled
    if (node.constList()[0].string() == var_name && is_returned)
    {
        // push the arguments in reverse order
        // because our calling convention is arg0, arg1...
        // but our stack will handle them in a LIFO fashion
        for (std::size_t i = node.constList().size() - 1; i >= n; --i)
            compile(x.constList()[i]);

            // jump to the top of the function
            bytecode.push_back(Instruction::JUMP);
            bytecode.pushNumber(0_u16);
    }
    else
    {
        // normal function call
    }
}
```

The diff between the old bytecode and the new should be as follows:
```diff
POP, STORE in n
POP, STORE in acc
LOAD n
LOAD_CONST 0  # 1
LE
POP_JUMP_IF_TRUE &if
# else:
- LOAD n               # |- computing acc * n
- LOAD acc             # |
- MUL                  # |-------------------
+ LOAD n
+ LOAD_CONST 0  # 1
+ SUB
- LOAD n               #   |- computing n - 1
- LOAD_CONST 0  # 1    #   |
- SUB                  #   |-----------------
+ LOAD n
+ LOAD acc
+ MUL
- LOAD factorial
- CALL 2
+ JUMP 0             # jump to the top of the function
JUMP &end
# if:
LOAD acc
# end:
RET
```

(blocks were named `&block` in the example, but those labels aren't in the final bytecode, it's just to clarify)

If your language doesn't use a `return` keyword, you might run into some trouble (so did I) when trying to identify the returning node of your functions.

What did was the following:
- add a flag to all the `compile_*` methods I have to know if the current node is terminal or not
- the only methods setting this to true is my `compile_function`, in charge of compiling the body of a function
- then I alter this flag based on two things:
    - if we are compiling a block (with multiple subnodes), then all the nodes except the last one are *non* terminal ; for the last one, the flag is passed as is
    - if we are compiling a condition (`if` block), then the flag is passed as is to both branches, `then` and `else`, since both can be terminal depending on the condition

Finally, instead of checking for a `is_returned` I checked for a `is_terminal`. You can find the complete implementation of this implementation [here](https://github.com/ArkScript-lang/Ark/commit/c085dd5609de2fe5db7c6e0c888eb05a9637a0be).

