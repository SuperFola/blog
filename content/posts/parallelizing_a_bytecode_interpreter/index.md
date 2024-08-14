+++
title = 'Parallelizing a bytecode interpreter'
date = 2021-04-14T23:02:10+02:00
draft = false
tags = ['bytecode', 'vm']
categories = ['pldev']
image = '/current_model.png'
+++

*Disclaimer*: this article is intended to be part of a *Request For Comments* [on a language I am working on](https://arkscript-lang.dev).

*Note*: I will be using *bytecode interpreter* and *virtual machine* (sometimes written VM) interchangeably throughout this article.

# Introduction

There are a lot of languages out there, and new ones are born everyday. We can often divide them into 4 categories:
- interpreted from a tree (often the Abstract Syntax Tree itself)
- transpiled to another language (eg Lex is transpiled to C)
- compiled to binary to be executed directly by a CPU
- compiled to a homebrew bytecode to be executed by a virtual machine

The first one will lack performances, the 3rd one will have no problem on that side (given a good Intermediate Representation optimizer), the 2nd one is limited by the performances of the target language, and the 4th one is limited by its virtual machine.

## Why targeting a VM?

It has many advantages, such as:
- compile once (to bytecode), run everywhere (as long as you made your VM available on the targeted platforms)
- a bytecode is linear, thus a lot faster to interpret compared to a tree, as you have only one direction: going forward

To add some personnal bonus points, I am often working with huge codebases in C++, thus a tiny modification often requires to rebuild nearly everything, not great when you want to make small adjustments to your NPCs movements or your animation controller. By embedding a VM to run an homebrew bytecode, I just have to write some bytecode to move my NPCs or play animations, bind the corresponding C++ functions to the VM, and voilà. Now you can modify the bytecode (often stored as a file) and avoid recompiling everything.

# Baseline of a bytecode interpreter

A bytecode interpreter (or virtual machine) can be stack based, register based, or both, each having their own pros and cons. I'm not going to discuss over which one is better, that would take a whole article. 

The main difference is that in a stack based VM, when doing something like `1 + 2`, you push `1` and `2` onto the stack, then pop them and apply `ADD` on them, pushing back the result onto the stack. A register based VM would store `1` in a register `r1`, then `2` in `r2` and run `ADD r1, r2, r3` (result in `r3`).

*Nota bene*: this describes possible implementations, some may work in different ways, but those are the main ideas

### Example of a stack based VM

![Example of a stack based VM](/stack_based_vm.png)
Source: [craftinginterpreters.com](https://craftinginterpreters.com/a-virtual-machine.html)

------

In the rest of this article, we will only be considering stack based bytecode interpreters.
 
# Synchronization problems

A bytecode interpreter is intrinsically sequential, because of its stack:
* first we push values to it
* we pop some (or all) of them
* we do operations on them and push back the result on the stack

We can not parallelize the value pushing / popping, given a single stack, because the order of the values on the stack is pretty important. For example, we wouldn't want to push `3, 5` instead of `5, 3` when applying the `DIV` instruction, because `3 / 5` isn't the same as `5 / 3`.

Also, what if two threads were trying to pop the value on top of the stack, at the same time? Which one gets what? That's a concurrency problem, and to solve it we need to introduce a few *constraints*:
* each thread will have its own stack
* each thread will need to keep track of its own instruction pointer (pointing the current executed instruction in a bytecode)
* each thread will have its own environment (local variables)

Given those constraints, **we can ensure thread safety** (no concurrent access to the same variable), to the cost of being unable to access a top level defined variable. This means that this code won't work:

```
let width = 120;

parallel function foo(a, b, c) {
    // heavy computations using a, b, c
    // ...
    return a + b / width + c % width;
}

foo(12, 13, 14);
```

Given a fourth constraint, we can make it possible:
* reading variables from parent scopes (outside the thread's scope) is allowed, but **the parent thread must be interrupted** to avoid modifications of those variables ; also (re)writing a variable stored in the parent is forbidden

This is quite restrictive, because it means that we will only be able to run other threads by stopping the main thread execution, thus limiting what we can do. Imagine that you have a game, and your rendering process would be in a thread. With this current design, it would be the same as having the game logic and the rendering in the same thread, since running the rendering function(s) in a thread would interrupt the main thread (assuming it's the game logic):

![Execution of the current model](/current_model.png)

# Parallelism, not concurrency

As stated before, concurrency problems can arise from having a single stack and multiple threads. One could say that a solution would be to:
- interrupt a thread,
- save the stack state,
- launch another thread.

After a few instructions executed by the new thread:
- we save the stack state again,
- interrupt the thread,
- restore the old stack
- and resume the old thread execution.

This is what is being done in Python (I am talking about the multithreading side of Python, not the multiprocessing one) and NodeJS (until recent updates at least), giving this type of execution:

![Fake multithreading](/fake_multithreading.png) 

It isn't what we could call "real" parallelism, since it isn't benefiting from the processing power of more than a single core. Notice that I left some space between tasks, because the bytecode interpreter needs time to do its context switching (dumping the stack state and loading another one), which makes the whole code run slower instead of faster, since we now have

```
total_time =
    execution_time(task 0)
  + execution_time(task 1)
  + execution_time(task 2)
  + a * (average(switching_time))
```

`a` being the number of times we need to context-switch.

Our goal being true parallelism and exploitation of more than a single core processing power, we can't use this approach.
 
# Multiple stacks design

The idea is described in "Running Parallel Bytecode Interpreters on Heterogeneous Hardware." (Juan Fumero, Athanasios Stratikopoulos, and Christos Kotselidis. 2020), where they implement a minimal parallel JVM clone, to run with OpenCL. Their project here takes advantage of the parallelism at *compile time* by introducing instructions such as `PARALLEL_GLOAD_INDEXED <idx>` to tell their VM which heap they should write to/read from. This is better than what we described above, because by indicating which heap is accessed, you can more easily get rid of the concurrency problems at compile time (instead of at runtime, while some guards could still be implemented).

This is quite complicated work for a project like [ArkScript](https://github.com/ArkScript-lang/Ark), thus I am going with a simpler approach, without needing to update the compiler, making this a performance enhancement integrable in many other bytecode interpreters.

## Runtime Information structures

We introduce `n + 1` structures for *RunTime Information* in the VM, to keep track of
* the stack
* the instruction pointer (telling the VM which instruction is being executed)
* the page pointer (our bytecode is divided into pages, which are basically collections of instructions related to given functions)
* the stack pointer (to know where is the top of our stack, since it will be a static array of our `Value` type)

We have `n` "RTI structures" for `n` different threads, plus another one for the main thread, which will have a bigger stack than the others, about 8 to 32 times bigger, giving small stacks for the threads to keep them relatively lightweight. Our context switching will only consist of telling the VM which "RTI structure" it should draw information from.  
This will make the VM larger (depending on what value of `n` we choose), thus we have put a limitation on the size of the threads stack.

![Bytecode, RunTimeInformation structure, and stack relationship](/runtime_information.png) 

This implementation doesn't prevent us from calling other functions in threads, as long as the thread's stack has enough space left, because they will be running on their own stack, their own locals, without disturbing the others threads. The only limitation as stated a few paragraphs before, is that the programmer must ensure that they doesn't (try to) modify global scope variables from parallelized code (we will discuss that again later).

We will have to implement parallel builtins, such as `parallel/for <list> <function>`, which would divide the work on the list evenly accross the available cores, given a maximum of `n` cores at the same time since we have a fixed number of "RTI structures", thus a fixed number of stacks to operate on.

### Choosing the right amount of structures (and stacks)

The choice of the value of `n` isn't straightforward and depends on the type of hardware we're aiming for. Since our language is only released on 64bits platforms, which are quite modern, we could chose a value of `n` matching the current market value. The maximum number of cores per CPU has drastically increased for a few decades now:

![Increasing number of cores per CPU](/core_per_cpu.png)
From [Design for Manycore Systems](http://www.drdobbs.com/go-parallel/article/showArticle.jhtml;jsessionid=0CW5VEYAYIUEVQE1GHOSKHWATMY32JVN?articleID=219200099)
 
and it's pretty common to come accross 4-cores or 8-cores CPU, thus it would be enough to have `n=4`, so that we don't waste too much space with unused "RTI structures", and have enough to use more CPU processing power. Some may argue that 64-bits dual cores processor exists and I acknowledge this fact, but with 2 "RTI structures" used out of 4, we won't waste that much space since the stacks of each structure is 8 to 32 times smaller compared to the main stack (about 8192 values in our implementation).  
Of course this discussion on the choice of `n` is important *only if the allocation of the structures is static*, which will most likely be the case in our implementation for performance reasons, but you can still go with a dynamic approach and forget about that.

## Handling variables out of the thread scope

It is still unclear if it is the VM role to tell the user that they can't write to a variable outside a thread scope, or if it's up to the user to guarantee this: it will depend on the type of the language implementing this technique (high or low level) and on the presence (or lack of) synchronization procedures (such as *semaphore* and *mutex*).

However, [ArkScript](https://github.com/ArkScript-lang/Ark) being an high level language, this would most likely be a runtime check (or even better, if possible, a compile time check) to help the user catch such problems. This could result in a single check on the current "RTI structure" when executing the instruction `STORE value symbol`: is it a symbol defined in the current structure or in the main one? If it's the last one, then the thread is trying to write a variable which doesn't belong to it.

# Conclusion

This article was trying to bring details about how parallelism could be introduced to a bytecode interpreter, even though it's not perfect since we need to halt the main thread. However for our project, it doesn't seem like a big deal, since it would still help with speeding up the language processing power on many algorithms, as well as allow us to avoid adding synchronization procedures such as `await`.

*Information*: all the images without `Source: <link>` beneath them were producted by me, you may reuse them without citing me if you want to

