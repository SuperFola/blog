+++
title = "Comparing Python's GIL and ArkScript async/await"
date = 2024-08-24T16:52:00+02:00
tags = ['python', 'arkscript']
categories = ['pldev']
+++

Python has seen a lot of attention lately, since the 3.13 release is planned for October this year, and will begin the huge work of [removing the GIL](https://peps.python.org/pep-0703/). A [prerelease](https://www.python.org/downloads/release/python-3130rc1/) is already out for the curious ones who want to try a (nearly) GIL less Python.

All this hype made me dig in my own language, [ArkScript](https://arkscript-lang.dev), as I had a Global VM Lock too in the past (added in version 3.0.12, in 2020, removed in 3.1.3 in 2022), to compare things and force me to dig deeper on the how and why of the Python GIL.

## Definitions

1. To get started, let's define what a GIL (*Global interpreter lock*) is:

> A global interpreter lock (GIL) is a mechanism used in computer-language interpreters to synchronize the execution of threads so that only one native thread (per process) can execute basic operations (such as memory allocation and reference counting) at a time.
{cite="https://en.m.wikipedia.org/wiki/Global_interpreter_lock" caption="Wikipedia — Global interpreter lock"}

2. **Concurrency** is when two or more tasks can start, run and complete in overlapping time periods, but that doesn't mean they will both be running simultaneously.

3. **Parallelism** is when task literraly run at the same time, eg on a multicore processor.

For an in-depth explanation, check [this Stack Overflow answer](https://stackoverflow.com/a/24684037).

## Python's GIL

The GIL can *increase the speed of single threaded programs* because you don't have to acquire and release locks on all data structures: the entire interpreter is locked so you are safe by default.

However since there is one GIL per interpreter, that limits parallelism: you need to spawn a whole new interpreter in a separate process (using the `multiprocessing` module instead of `threading`) to use more than one core! And this has a greater cost than just spawning a new thread, because you now have to worry about inter-process communication, which adds a non-negligible overhead (see [GeekPython — GIL Become Optional in Python 3.13](https://geekpython.in/gil-become-optional-in-python) for benchmarks).

### Why is it needed?

In the case of Python, it lies down to the main implementation, CPython, not having a thread-safe memory management. Without the GIL, the following scenario would generate a race condition:

1. create a shared variable `count = 5`
2. thread 1: `count *= 2`
3. thread 2: `count += 1`

If **thread 1** runs first, then `count` will be 11 (`count * 2` = 10, then `count + 1` = 11).  
If **thread 2** runs first, then `count` will be 12 (`count + 1` = 6, then `count * 2` = 12).  
The order of execution matters, but even worse can happen: if both threads read `count` at the same time, one will erase the result of the other, and `count` will be either 10 or 6!

Overall, having a GIL make the (CPython) implementation easier and faster in general cases:

- faster in the single-threaded case (no need to acquire/release a lock for every operation)
- faster in the multi-threaded case for IO bound programs (because those happen outside the GIL)
- faster in the multi-threaded case for CPU bound programs that do their compute intensive work in C (because the GIL is released before calling the C code)

It also makes wrapping C libraries easier, because you're guaranted thread-safety thanks to the GIL.

> [!NOTE]
> **Python 3.13 is removing the GIL!**
> 
> The [PEP 703](https://peps.python.org/pep-0703/) added a building configuration `--disable-gil` so that upon installing Python 3.13+, you can benefit from performance improvements in multithreaded programs.

### Python async/await model

todo
what color is your function

## ArkScript parallelism

At the beginning, ArkScript was using a Global VM Lock (akin to Python's GIL), because the `http.arkm` used to create HTTP servers was multithreaded and it caused problems with ArkScript's VM by altering its state through modifying variables and calling functions on multiple threads.

Then in 2021, I started working on a new model to handle the VM state so that we could parallelize it easily, and wrote [an article about it]({{< ref "/posts/parallelizing_a_bytecode_interpreter/index.md" >}}). It was later [implemented](https://github.com/ArkScript-lang/Ark/commit/743c2c94de0bcd8299cbcf41b4a57d825e742745) by the end of 2021.

### Async/await

what color is your function

### The specificities

single vm but multiple contexts
same bytecode but different scopes
single process but multiple threads
create a thread with async, given any function and its arguments
-> values are copied when passed to a new thread
await it whenever you want
threads are separated and can't interact nor communicate with one another
-> easier to implement that way
-> create a stack per thread for the vm to use
no lock on IO ressources (console, files, sockets)

no need for a GIL now, but functionnalities a bit diminished compared to Python's

## Sources

1. [Stack Exchange — Why was Python written with the GIL?](https://softwareengineering.stackexchange.com/questions/186889/why-was-python-written-with-the-gil)
2. [Python Wiki — GlobalInterpreterLock](https://wiki.python.org/moin/GlobalInterpreterLock)

