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

This is also the easiest solution, as it does not require me to entirely rewrite the compiler: I just have to add a wrapper for the `Instruction`, that gets compiled to bytecode.

## Implementing the IR

The wrapper is small and was easy to implement, needing only an additional `Kind` to differentiate final instructions (`Opcode` and `Opcode2Args`) and entities that require processing to be compiled to final instructions (`Goto`, `GotoIfTrue`, `GotoIfFalse` all require the attached label to be computed first). The `Label` is only there to get an address in the bytecode, and won't produce an instruction.


```cpp
enum class Kind
{
    Label,
    Goto,
    GotoIfTrue,
    GotoIfFalse,
    Opcode,
    Opcode2Args
};

using label_t = std::size_t;

class Entity
{
public:
    explicit Entity(Kind kind);
    explicit Entity(Instruction inst, uint16_t arg = 0);
    Entity(Instruction inst, uint16_t primary_arg, uint16_t secondary_arg);

    // tools to build IR entities easily
    static Entity Label();
    static Entity Goto(const Entity& label);
    static Entity GotoIf(const Entity& label, bool cond);

    [[nodiscard]] Word bytecode() const;
    // getters
    [[nodiscard]] inline label_t label() const { return m_label; }
    [[nodiscard]] inline Kind kind() const { return m_kind; }
    [[nodiscard]] inline Instruction inst() const { return m_inst; }
    [[nodiscard]] inline uint16_t primaryArg() const { return m_primary_arg; }
    [[nodiscard]] inline uint16_t secondaryArg() const { return m_secondary_arg; }

private:
    inline static label_t LabelCounter = 0;

    Kind m_kind;
    label_t m_label { 0 };
    Instruction m_inst { NOP };
    uint16_t m_primary_arg { 0 };
    uint16_t m_secondary_arg { 0 };
};

using Block = std::vector<Entity>;
```

### Instructions in ArkScript

It is also interesting to speak about the instruction representation in ArkScript. An instruction in on four bytes: `iiiiiiii pppppppp aaaaaaaa aaaaaaaa`.

- `i` represents the instruction bits, 8, giving us 256 different instructions possible
- `p` is for padding, ignored in instructions with a single immediate argument
- `a` represents the bits of the immediate argument, a total of 16 (0 -> 65'535)

Super Instructions can require up to two arguments, which are encoded using the padding: `iiiiiiii ssssssss ssssaaaa aaaaaaaa`.

- we still have our instruction on the same byte,
- `s` represents the bits of the secondary argument, a total of 12 (0 -> 4095)
- `a` represents the bits of the primary argument, a total of 12 (0 -> 4095)

### Compiling an IR entity to bytecode

Since some instructions can take two arguments, the instruction-to-bytecode helper had to be updated. Implementation for reference:

```cpp
struct Word
{
    uint8_t opcode = 0;
    uint8_t byte_1 = 0;
    uint8_t byte_2 = 0;
    uint8_t byte_3 = 0;

    explicit Word(const uint8_t inst, const uint16_t arg = 0) :
        opcode(inst),
        // byte_1 = 0, this is our padding here
        byte_2(static_cast<uint8_t>(arg >> 8)),
        byte_3(static_cast<uint8_t>(arg & 0xff))
    {}

    Word(const uint8_t inst, const uint16_t primary_arg,
         const uint16_t secondary_arg) :
        opcode(inst)
    {
        byte_1 = static_cast<uint8_t>((secondary_arg & 0xff0) >> 4);
        byte_2 = static_cast<uint8_t>(
            (secondary_arg & 0x00f) << 4 | (primary_arg & 0xf00) >> 8
        );
        byte_3 = static_cast<uint8_t>(primary_arg & 0x0ff);
    }
};
```

The rest is pretty straightfoward: instead of having the **Compiler** output bytecode directly, it now outputs IR entities, and a new **IRCompiler** has been introduced. All it has to do is map an IR entity to its instruction, and turn it into a `Word` so that it can be written to disk.

An important step is to compute the labels addresses so that we can generate correct `JUMP`, `POP_JUMP_IF_TRUE` and `POP_JUMP_IF_FALSE` instructions:

```cpp
uint16_t pos = 0;
std::unordered_map<IR::label_t, uint16_t> label_to_position;
for (auto inst : page)
{
    switch (inst.kind())
    {
        case IR::Kind::Label:
            label_to_position[inst.label()] = pos;
            // the label isn't an instruction,
            // do not update `pos` here
            break;

        default:
            ++pos;
    }
}
```

### Detecting sequence of entities that can be combined

This one was way easier than I thought, all we have to do is iterate on the IR blocks given, and match the current entity and the next one with a known pattern. Only thing to be aware of is jumping over the instructions we managed to fuse, so that we do not push left over instructions in our optimized IR.

```cpp
void IROptimizer::process(
    const std::vector<IR::Block>& pages,
    const std::vector<std::string>& symbols,
    const std::vector<ValTableElem>& values)
{
    m_symbols = symbols;
    m_values = values;

    for (const auto& block : pages)
    {
        m_ir.emplace_back();
        IR::Block& current_block = m_ir.back();

        std::size_t i = 0;
        const std::size_t end = block.size();

        while (i < end)
        {
            // alias to ease the writing of the rules below:
            const Instruction first = block[i].inst();
            const uint16_t arg_1 = block[i].primaryArg();

            // if we have at least two instructions left,
            // we can try to match for super instructions patterns
            if (i + 1 < end)
            {
                const Instruction second = block[i + 1].inst();
                // only the `primaryArg` is needed as we will check
                // for normal instructions below, which have
                // a single argument
                const uint16_t arg_2 = block[i + 1].primaryArg();

                // LOAD_CONST x
                // LOAD_CONST y
                // ---> LOAD_CONST_LOAD_CONST x y
                if (first == LOAD_CONST && second == LOAD_CONST)
                {
                    current_block.emplace_back(
                        LOAD_CONST_LOAD_CONST, arg_1, arg_2);
                    i += 2;
                }
                // ...
                else
                {
                    // otherwise we should not forget to add the
                    // other instructions to the output IR, we don't
                    // want just the optimzed IR!
                    current_block.emplace_back(block[i]);
                    ++i;
                }
            }
            else
            {
                current_block.emplace_back(block[i]);
                ++i;
            }
        }
    }
}
```

## Performance gain!

Who would have thought that avoiding a serie of `LOAD_CONST`, `STORE` and using a single `LOAD_CONST_STORE` instruction would be so beneficial? We are avoiding a push -> pop and immediately putting a value from our constants table inside a variable.

Applying this pattern to increment (`LOAD_SYMBOL a`, `LOAD_CONST 1`, `ADD` becomes `INCREMENT a`), decrement, and store the head or tail of a list in a variable helps, tremendously according to the benchmarks:

```
                          |           | 0-684ea758   | 5-ee9ff764
--------------------------+-----------+--------------+---------------------
 quicksort                | real_time | 0.152787ms   | -0.002 (-1.5518%)
                          | cpu_time  | 0.152334ms   | -0.002 (-1.3825%)
 ackermann/iterations:50  | real_time | 81.2917ms    | -21.385 (-26.3065%)
                          | cpu_time  | 80.9612ms    | -21.132 (-26.1011%)
 fibonacci/iterations:100 | real_time | 7.51618ms    | -1.244 (-16.5506%)
                          | cpu_time  | 7.4984ms     | -1.233 (-16.4476%)
```

The first column, `0-684ea758` is our reference benchmark (based on ArkScript commit `684ea758`), and the second one, `5-ee9ff764`, is the result of implementing our IR and IR optimizer. Quite the improvement!

// todo add intermediate benchmark with computed goto and no IR