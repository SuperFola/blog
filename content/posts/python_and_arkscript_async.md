+++
title = "Comparing Python and ArkScript asynchronous models"
date = 2024-09-01T16:54:00+02:00
tags = ['python', 'arkscript']
categories = ['pldev']
+++

Python has received a lot of attention lately. The 3.13 release, planned for October this year, will begin the huge work of [removing the GIL](https://peps.python.org/pep-0703/). A [prerelease](https://www.python.org/downloads/release/python-3130rc1/) is already out for curious users who want to try a (nearly) GIL-less Python.

All this hype made me dig in my own language, [ArkScript](https://arkscript-lang.dev), as I had a Global VM Lock, too, in the past (added in version 3.0.12, in 2020, removed in 3.1.3 in 2022), to compare things and force me to dig deeper into the how and why of the Python GIL.

## Definitions

1. To get started, let's define what a GIL (*Global interpreter lock*) is:

> A global interpreter lock (GIL) is a mechanism used in computer-language interpreters to synchronize the execution of threads so that only one native thread (per process) can execute basic operations (such as memory allocation and reference counting) at a time.
{cite="https://en.m.wikipedia.org/wiki/Global_interpreter_lock" caption="Wikipedia — Global interpreter lock"}

2. **Concurrency** is when two or more tasks can start, run and complete in overlapping time periods, but that doesn't mean they will both be running simultaneously.

3. **Parallelism** is when tasks literally run at the same time, eg on a multicore processor.

For an in-depth explanation, check [this Stack Overflow answer](https://stackoverflow.com/a/24684037).

## Python's GIL

The GIL can *increase the speed of single-threaded programs* because you don't have to acquire and release locks on all data structures: the entire interpreter is locked so you are safe by default.

However, since there is one GIL per interpreter, that limits parallelism: you need to spawn a whole new interpreter in a separate process (using the `multiprocessing` module instead of `threading`) to use more than one core! This has a greater cost than just spawning a new thread because you now have to worry about inter-process communication, which adds a non-negligible overhead (see [GeekPython — GIL Become Optional in Python 3.13](https://geekpython.in/gil-become-optional-in-python) for benchmarks).

### How does it affect Python's async?

In the case of Python, it lies down to the main implementation, CPython, not having thread-safe memory management. Without the GIL, the following scenario would generate a race condition:

1. create a shared variable `count = 5`
2. thread 1: `count *= 2`
3. thread 2: `count += 1`

If **thread 1** runs first, `count` will be 11 (`count * 2` = 10, then `count + 1` = 11).  
If **thread 2** runs first, `count` will be 12 (`count + 1` = 6, then `count * 2` = 12).  
The order of execution matters, but even worse can happen: if both threads read `count` at the same time, one will erase the result of the other, and `count` will be either 10 or 6!

Overall, having a GIL makes the (CPython) implementation easier and faster in general cases:

- faster in the single-threaded case (no need to acquire/release a lock for every operation)
- faster in the multi-threaded case for IO-bound programs (because those happen outside the GIL)
- faster in the multi-threaded case for CPU-bound programs that do their compute-intensive work in C (because the GIL is released before calling the C code)

It also makes wrapping C libraries easier, because you're guaranteed thread-safety thanks to the GIL.

The downside is that your code is **asynchronous** as in **concurrent**, but **not parallel**.

> [!NOTE]
> **Python 3.13 is removing the GIL!**
> 
> The [PEP 703](https://peps.python.org/pep-0703/) added a building configuration `--disable-gil` so that upon installing Python 3.13+, you can benefit from performance improvements in multithreaded programs.

### Python async/await model

In Python, functions have to [take a color](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/): they are either "normal" or "async". What does this mean in practice?

```python
>>> def foo(call_me):
...     print(call_me())
... 
>>> async def a_bar():
...     return 5
... 
>>> def bar():
...     return 6
... 
>>> foo(a_bar)
<coroutine object a_bar at 0x10491f480>
<stdin>:2: RuntimeWarning: coroutine 'a_bar' was never awaited
RuntimeWarning: Enable tracemalloc to get the object allocation traceback
>>> foo(bar)
6
```

Because an asynchronous function does not return a value immediately, but rather invokes a coroutine, we can't use them everywhere as callbacks, unless the function we are calling is designed to take `async` callbacks.

We get a hierarchy of functions, because "normal" functions need to be made `async` to use the `await` keyword, needed to call asynchronous functions:

```goat
         can call
normal -----------> normal

         can call
async -+-----------> normal
       |
       .-----------> async                    

```

Apart from trusting the caller, there is no way to know if a callback is async or not (unless you try to call it first inside a `try`/`except` block to check for an exception, but that's ugly).

## ArkScript parallelism

In the beginning, ArkScript was using a Global VM Lock (akin to Python's GIL), because the `http.arkm` module (used to create HTTP servers) was multithreaded and it caused problems with ArkScript's VM by altering its state through modifying variables and calling functions on multiple threads.

Then in 2021, I started working on a new model to handle the VM state so that we could parallelize it easily, and wrote [an article about it]({{< ref "/posts/parallelizing_a_bytecode_interpreter/index.md" >}}). It was later [implemented](https://github.com/ArkScript-lang/Ark/commit/743c2c94de0bcd8299cbcf41b4a57d825e742745) by the end of 2021, and the Global VM Lock was removed.

### ArkScript async/await

ArkScript does not assign a color to `async` functions, because they do not exist in the language: you either have a function or a closure, and both can call each other without any additional syntax (a closure is [a poor man object](https://wiki.c2.com/?ClosuresAndObjectsAreEquivalent=), in this language: a function holding a mutable state).

Any function can be made `async` at the *call site* (instead of declaration):

```lisp
(let foo (fun (a b c)
    (+ a b c)))

(print (foo 1 2 3))  # 6

(let future (async foo 1 2 3))
(print future)          # UserType<0, 0x0x7f0e84d85dd0>
(print (await future))  # 6
(print (await future))  # nil
```

Using the `async` builtin, we are spawning a `std::future` under the hood (leveraging [std::async](https://en.cppreference.com/w/cpp/thread/async) and threads) to run our function given a set of arguments. Then we can call `await` (another builtin) and get a result whenever we want, which will block the current VM thread until the function returns.  
Thus, it is possible to `await` from any function, and from any thread.

### The specificities

All of this is possible because we have a single VM that operates on a state contained inside an `Ark::internal::ExecutionContext`, which is tied to a single thread. The VM is shared between the threads, not the contexts!

```goat
        .---> thread 0, context 0
        |            ^
VM <----+       can't interact
        |            v
        .---> thread 1, context 1              

```

When creating a *future* by using `async`, we are:

1. copying all the arguments to the new context,
2. creating a brand new stack and scopes,
3. finally create a separate thread.

This forbids any sort of synchronization between threads since ArkScript does not expose references or any kind of lock that could be shared (this was done for simplicity reasons, as the language aims to be somewhat minimalist but still usable).

However this approach isn't better (nor worse) than Python's, as we create a new thread per call, and the number of threads per CPU is limited, which is a bit costly. Luckily I don't see that as problem to tackle, as one should never create hundreds or thousands of threads simultaneously nor call hundreds or thousands of async Python functions simultaneously: both would result in a huge slow down of your program.  
In the first case, this would slowdown your process (even computer) as the OS is juggling to give time to every thread ; in the second case it is Python's scheduler that would have to juggle between all of your coroutines.

> [!NOTE]
> Out of the box, ArkScript does not provide mechanisms for thread synchronization, but even if we pass a `UserType` (which is a wrapper on top of *type-erased* C++ objects) to a function, the underlying object isn't copied.  
> With some careful coding, one could create a lock using the `UserType` construct, that would allow synchronization between threads.
> ```lisp
> (let lock (module:createLock))
> (let foo (fun (lock i) {
>   (lock true)
>   (print (str:format "hello {}" i))
>   (lock false) }))
> (async foo lock 1)
> (async foo lock 2)
> ```

## Conclusion

ArkScript and Python use two very different kinds of `async` / `await`: the first one requires the use of `async` at the call site and spawns a new thread with its own context, while the latter requires the programmer to mark functions as `async` to be able to use `await`, and those `async` functions are coroutines, running in the same thread as the interpreter.

## Sources

1. [Stack Exchange — Why was Python written with the GIL?](https://softwareengineering.stackexchange.com/questions/186889/why-was-python-written-with-the-gil)
2. [Python Wiki — GlobalInterpreterLock](https://wiki.python.org/moin/GlobalInterpreterLock)
3. [stuffwithstuff - What color is your function?](https://journal.stuffwithstuff.com/2015/02/01/what-color-is-your-function/)

