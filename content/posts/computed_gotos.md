+++
title = 'Implementing computed gotos in C++'
date = 2024-09-24T15:45:00+02:00
tags = ['cplusplus', 'arkscript']
categories = ['pldev', 'arkscript']
+++

A common idiom in virtual machines or state machines is to read data from a list, execute some code depending on the value we read, advance in the list, rinse and repeat. That could be written as:

```cpp
std::vector<uint8_t> bytecode = readBytecode();
std::size_t pos = 0;
while (pos < bytecode.size())
{
    uint8_t inst = bytecode[pos];
    pos++;

    switch (inst)
    {
        case DO_THIS:
            // ...
            break;
        case DO_THAT:
            // ...
            break;
        // ...
    }
}
```

While this works, there are other ways that do the same thing but are also better in term of performances. This current approach isn't very branch-predictor friendly because we read data from a vector, select code to execute, break, and repeat. The branch-predictor can not learn what common instructions follow each other.

## Definition

A way to solve that is to use *computed gotos*. We read an instruction, load the next and jump to its code. No more instruction selection, a single stream of *code to run* -> *jump* -> *repeat*, which pleases the branch predictor. It can now learn what instruction Y often follows another instruction X and preload code (even though it can still fail, which degrades performances).

## Modifying our code for compute gotos

We'll use the code shown previously as a basis

### Using gotos

```cpp
std::vector<uint8_t> bytecode = readBytecode();
std::size_t pos = 0;
uint8_t inst = bytecode[pos];
{
    dispatch_op:
    switch (inst)
    {
        case DO_THIS:
            // ...
            inst = bytecode[pos];
            pos++;
            goto dispatch_op;
        case DO_THAT:
            // ...
            inst = bytecode[pos];
            pos++;
            goto dispatch_op;
        // ...
    }
}
```

Here we replaced our `while` loop with a `switch`, a label and a `goto`, nearly achieving the same thing as before. *Nearly* because we are now loading the next instruction before our `goto`, and we don't have any `if (pos < bytecode.size())` anymore.

> [!NOTE]
> While we could add an `if (end of bytecode)` condition before our goto, an easier solution would be to add a special `STOP_INTERPRETER` instruction, implemented like this:
> ```
> case STOP_INTERPRETER:
>     break;  // or another goto label_end;
>             // with label_end after the switch
> ```

This code isn't any faster or slower than the previous implementation, it is just another way (though not a recommended one due to the presence of `goto`s) to write a loop, but that will help us for the next transformations.

### Making our code slightly better with macros

Now, we have to add instruction fetching into every case. We could make this easier using macros:

```cpp
#define FETCH_INSTRUCTION()    \
    do {                       \
        inst = bytecode[pos];  \
        pos++;                 \
    } while (false)
#define DISPATCH_GOTO() goto dispatch_op
#define DISPATCH()        \
    FETCH_INSTRUCTION();  \
    DISPATCH_GOTO()

std::vector<uint8_t> bytecode = readBytecode();
std::size_t pos = 0;
uint8_t inst = bytecode[pos];
{
    dispatch_op:
    switch (inst)
    {
        case DO_THIS:
            // ...
            DISPATCH();
        case DO_THAT:
            // ...
            DISPATCH();
        case STOP_INTERPRETER:
            goto label_end;
        // ...
    }
    label_end:
    // we can't have a label at the end of a block in C++98-20,
    // this only works in C++23 and onward
    do {} while (false);
}
```

### Computed gotos

With a gcc extension, we can take the address of a label, and store it in an array. Using this, we can `goto array[index];` and jump at a given label. What if we put one label per instruction now?

```cpp
#define FETCH_INSTRUCTION()    \
    do {                       \
        inst = bytecode[pos];  \
        pos++;                 \
    } while (false)

#define DISPATCH_GOTO() goto opcodes[inst]
#define TARGET(op) TARGET_##op

#define DISPATCH()        \
    FETCH_INSTRUCTION();  \
    DISPATCH_GOTO()

std::vector<uint8_t> bytecode = readBytecode();
std::size_t pos = 0;
uint8_t inst = bytecode[pos];
{
    const std::array opcodes = {
        &&TARGET_DO_THIS,
        &&TARGET_DO_THAT,
        &&TARGET_STOP_INTERPRETER
    };

    {
        TARGET(DO_THIS)
        {
            // ...
            DISPATCH();
        }
        TARGET(DO_THAT)
        {
            // ...
            DISPATCH();
        }
        TARGET(STOP_INTERPRETER)
        {
            goto label_end;
        }
        // ...
    }
    label_end:
    do {} while (false);
}
```

### Everything together

With some conditions and more macros, we could have a dual implementation, generating a `switch` or a computed gotos table:

```cpp
#define FETCH_INSTRUCTION()    \
    do {                       \
        inst = bytecode[pos];  \
        pos++;                 \
    } while (false)

#if USE_COMPUTED_GOTO
#  define DISPATCH_GOTO() goto opcodes[inst]
#  define TARGET(op) TARGET_##op
#else
#  define DISPATCH_GOTO() goto dispatch_op
#  define TARGET(op) case op:
#end

#define DISPATCH()        \
    FETCH_INSTRUCTION();  \
    DISPATCH_GOTO()

std::vector<uint8_t> bytecode = readBytecode();
std::size_t pos = 0;
uint8_t inst = bytecode[pos];
{
#if !USE_COMPUTED_GOTO
    dispatch_op:
    switch (inst)
#else
    const std::array opcodes = {
        &&TARGET_DO_THIS,
        &&TARGET_DO_THAT,
        &&TARGET_STOP_INTERPRETER
    };
#end
    {
        TARGET(DO_THIS)
        {
            // ...
            DISPATCH();
        }
        TARGET(DO_THAT)
        {
            // ...
            DISPATCH();
        }
        TARGET(STOP_INTERPRETER)
        {
            goto label_end;
        }
        // ...
    }
    label_end:
    do {} while (false);
}
```

## Results

I've implemented this in [ArkScript](https://arkscript-lang.dev), a small scripting language I've been working on for a few years now, and this has yielded about a 10% performance improvement:

Machine (M1 MBP):
- Run on (8 X 24 MHz CPU s)
- CPU Caches:
  - L1 Data 64 KiB
  - L1 Instruction 128 KiB
  - L2 Unified 4096 KiB (x8)

Before:
```
Load Average: 3.62, 2.42, 2.46
---------------------------------------------------------------------------
Benchmark                                 Time             CPU   Iterations
---------------------------------------------------------------------------
quicksort                             0.223 ms        0.222 ms         3125
ackermann/iterations:50                97.0 ms         96.9 ms           50
fibonacci/iterations:100               9.23 ms         9.22 ms          100
```

After:
```
Load Average: 2.87, 2.73, 3.07
---------------------------------------------------------------------------
Benchmark                                 Time             CPU   Iterations
---------------------------------------------------------------------------
quicksort                             0.218 ms        0.218 ms         3231
ackermann/iterations:50                88.9 ms         88.9 ms           50
fibonacci/iterations:100               8.58 ms         8.57 ms          100
```

## Sources

- [The Design & Implementation of the CPython Virtual Machine](https://blog.codingconfessions.com/p/cpython-vm-internals)

