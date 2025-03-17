+++
title = 'Optimizing scopes data in ArkScript VM'
date = 2025-03-15T12:38:47+02:00
tags = ['arkscript', 'compiler', 'vm']
categories = ['pldev', 'arkscript']
+++

If you don't know me yet, I have been working on [ArkScript](https://arkscript-lang.dev) for nearly 6 years now. ArkScript is a scripting language in modern C++, running on a custom virtual machine (like Python or Lua), with the goal of having a syntax easy to learn and use, a C++ interface to embed it in programs, and decent performances (without trying to be as fast as Lua though, Mike Pall is a genius and did outstanding work on LuaJIT).

## Is my language fast?

*A silly question that you shouldn't care about, unless the perceived slowness of the language is becoming a problem.*

Recently, I added more benchmarks to the language, and I was quite astonished to see that it was *1.5 times slower* that Python on such a simple benchmark:

```lisp
(mut collection [])
(mut i 0)
(while (< i 1000000) {
  (append! collection i)
  (set i (+ i 1)) })

(mut sum 0)
(set i 0)
(while (< i 1000000) {
  (set sum (+ sum (@ collection i)))
  (set i (+ i 1)) })
```

It is also *17 times slower* than Python on the binary tree benchmark. I expected it to be a bit slower, but not by that much! When digging in profiler traces, it appears that we loose about *35% of execution time looking for variables*. This is what inspired me to write this article, how locals are stored in the virtual machine, and what kind of optimizations were applied.

> [!NOTE]
> You can see the benchmarks results on this page: [arkscript-lang.dev/benchmarks.html](https://arkscript-lang.dev/benchmarks.html). They are generated from [github.com/ArkScript-lang/benchmarks](https://github.com/ArkScript-lang/benchmarks).

## Some definitions

> \[A **stack based VM**, such as ArkScript\], is a processor in which the primary interaction is moving short-lived temporary values to and from a push down stack.
{cite="https://en.m.wikipedia.org/wiki/Stack_machine" caption="Wikipedia — Stack machine"}

ArkScript does not use any kind of registers, all computations are done using a stack, so `(1 + 2) * 3` is:

```
PUSH 2
PUSH 1
ADD  // pop 1, 2, push (1+2)
PUSH 3
MUL  // pop the addition result, 3, push (3*3)
```

Variables are stored in a **scope**, and a stack of **scopes** defines the environment at one point in the program execution. I call the current **scope** (the last one on the stack of scopes) **locals**: it holds all the variables defined in the current scope.

## Evolution between versions

For the following sections, I inspected the code of each version to see how locals and scopes were handled. Some versions do not change that much and instead have optimizations elsewhere, which I didn't bother checking/measuring since it isn't the main focus of the article.

Benchmarks are run on the Ackermann-Péter function using [google/benchmark](https://github.com/google/benchmark), because it's a recursive function but not a [primitive recursive function](https://en.wikipedia.org/wiki/Primitive_recursive_function), meaning compilers can't easily optimize it. It grows quickly, creates a lot of scopes and destroys them a lot too, which is perfect for our use case.

They are run on a M1 MacBook Pro with 10 cores and 32GB of RAM:
```
Run on (8 X 24 MHz CPU s)
CPU Caches:
  L1 Data 64 KiB
  L1 Instruction 128 KiB
  L2 Unified 4096 KiB (x8)
```

To retrace my steps, I created one git `worktree` per tag on the project (and that's when I saw that the first tag on the project was 3.0.1 instead of 0.0.1):

```shell
$ git worktree list
~/ArkScript/Ark        d1be6b9f [dev]
~/ArkScript/ark-v301   b43738be (detached HEAD)
~/ArkScript/ark-v3010  4d8067ce (detached HEAD)
~/ArkScript/ark-v3011  a0627382 (detached HEAD)
~/ArkScript/ark-v3012  9452ccee (detached HEAD)
~/ArkScript/ark-v3013  6e7c5b7b (detached HEAD)
~/ArkScript/ark-v3014  75ca4090 (detached HEAD)
~/ArkScript/ark-v3015  0744f9a0 (detached HEAD)
~/ArkScript/ark-v302   788e9d5e (detached HEAD)
~/ArkScript/ark-v303   1191515e (detached HEAD)
~/ArkScript/ark-v304   2173b4f5 (detached HEAD)
~/ArkScript/ark-v305   7ae2bf51 (detached HEAD)
~/ArkScript/ark-v306   ce876013 (detached HEAD)
~/ArkScript/ark-v307   386e289e (detached HEAD)
~/ArkScript/ark-v308   4f99008c (detached HEAD)
~/ArkScript/ark-v309   250e27cb (detached HEAD)
~/ArkScript/ark-v310   c2dcd843 (detached HEAD)
~/ArkScript/ark-v311   d301511a (detached HEAD)
~/ArkScript/ark-v312   a9e7ef97 (detached HEAD)
~/ArkScript/ark-v313   bf151b77 (detached HEAD)
~/ArkScript/ark-v320   0f16875d (detached HEAD)
~/ArkScript/ark-v330   c6c59c4c (detached HEAD)
~/ArkScript/ark-v340   425f7baf (detached HEAD)
~/ArkScript/ark-v350   2efb4ed8 (detached HEAD)
~/ArkScript/ark-v4002  f5b247c3 (detached HEAD)
~/ArkScript/ark-v4003  019d36bd (detached HEAD)
~/ArkScript/ark-v4004  07e569b6 (detached HEAD)
~/ArkScript/ark-v4005  6a4c6449 (detached HEAD)
```

### Instanciating a bunch of stacks and big empty vectors

From version [3.0.1](https://github.com/ArkScript-lang/Ark/tree/v3.0.1) to [3.0.12](https://github.com/ArkScript-lang/Ark/tree/v3.0.12).

The very first version of the VM is using a `Frame` object, instanciated for each scope. I think I stole this idea from Java, though my implementation is subpar and I probably didn't understand everything at the time. Each `Frame` instanciated a new stack for itself, implemented as a `std::vector`, which mean that pushing to it would make grow and copy all of its elements, which is highly inefficient.

Locals were stored as a `std::shared_ptr<std::vector<Value>>` (`Scope_t`). You read that right, no id. You accessed a specific variable using `locals[variable_id]`. The shared pointer is there because locals could be added by closures, that have to retain their environment, which can be mutated. The stack of scopes was materialized as `std::vector<Scope_t>`.

```cpp
class Frame
{
public:
  Frame();
  Frame(const Frame&) = default;
  Frame(std::size_t caller_addr, std::size_t caller_page_addr);

  Value&& pop()
  {
    m_i--;
    return std::move(m_stack[m_i]);
  }

  void push(const Value& value)
  {
    m_stack[m_i] = value;
    m_i++;
  }

  std::size_t stackSize() const { return m_i; }
  std::size_t callerAddr() const { return m_addr; }
  std::size_t callerPageAddr() const { return m_page_addr; }

  // related to scope deletion

  void incScopeCountToDelete() { m_scope_to_delete++; }
  void resetScopeCountToDelete() { m_scope_to_delete = 0; }
  uint8_t scopeCountToDelete() const { return m_scope_to_delete; }

private:
  std::size_t m_addr, m_page_addr;
  std::vector<Value> m_stack;
  int8_t m_i;
  uint8_t m_scope_to_delete;
};
```

Results:

```
Benchmark                         Time             CPU   Iterations
ackermann                       197 ms          197 ms            4
```

### Locals as a list of pair of id and value

From version [3.0.13](https://github.com/ArkScript-lang/Ark/tree/v3.0.13) to [3.0.15](https://github.com/ArkScript-lang/Ark/tree/v3.0.15).

The next iteration of locals management introduced the first version of the `Scope`, that we're still using today! They are still instanciated inside shared pointers, but they are way smaller as we do not access a variable through `operator[]`, but iterate through the pairs of `id -> value` instead.

```cpp
class Scope
{
public:
  Scope() noexcept;

  void push_back(uint16_t id, Value&& val) noexcept;
  void push_back(uint16_t id, const Value& val) noexcept;
  bool has(uint16_t id) noexcept;
  Value* operator[](uint16_t id) noexcept;
  uint16_t idFromValue(Value&& val) noexcept;
  const std::size_t size() const noexcept;

  friend class Ark::VM;

private:
  std::vector<std::pair<uint16_t, Value>> m_data;
};
```

This version tried to be smart: upon adding a new value, we sort the elements, so that lookup would be faster. In retrospect (and after having looked at benchmarks), I now know it was a bad idea (which is why I'm not doing this anymore!):

```cpp
#define push_pair(id, val) \
  m_data.emplace_back(std::pair<uint16_t, Value>(id, val))
#define insert_pair(place, id, val) \
  m_data.insert(place, std::pair<uint16_t, Value>(id, val))

void Scope::push_back(uint16_t id, Value&& val) noexcept
{
#ifdef ARK_SCOPE_DICHOTOMY
  switch (m_data.size())
  {
    case 0:
      push_pair(std::move(id), std::move(val));
      break;

    case 1:
      if (m_data[0].first < id)
        push_pair(std::move(id), std::move(val));
      else
        insert_pair(m_data.begin(), std::move(id), std::move(val));
      break;

    default:
      auto lower = std::lower_bound(
        m_data.begin(),
        m_data.end(),
        id,
        [](const auto& lhs, uint16_t id) -> bool {
          return lhs.first < id;
        });
      insert_pair(lower, std::move(id), std::move(val));
      break;
  }
#else
  push_pair(std::move(id), std::move(val));
#endif
}
```

Inserting while trying to keep all elements ordered is slower than simply adding each element to the end of the scope:

Results:
```
Benchmark                         Time             CPU   Iterations
ackermann_dichotomy             294 ms          294 ms            2
ackermann_push_back             192 ms          192 ms            4
```

### Single stack

From version [3.1.0](https://github.com/ArkScript-lang/Ark/tree/v3.1.0) to [4.0.0-10](https://github.com/ArkScript-lang/Ark/tree/v4.0.0-10).

In v3.1.0, the `Scope` removed the sorted insert to push everything at the end of its `std::vector<std::pair<id, Value>>`. Also, the horrendous `std::vector<Frame>` was replaced by a `std::unique_ptr<std::array<Value, 8192>>`, which yielded a much needed performance improvement. Instead of having a separate data structure to save the caller page pointer and instruction pointer, we now push those on the stack too (meaning we have a recursion depth of 4096 for non-primary recursive functions, that can't be optimized to loops).

Results:
```
Benchmark                         Time             CPU   Iterations
ackermann                       146 ms          146 ms            5
```

Then, in v3.1.3 the `ExecutionContext` appeared: it's a struct with everything the VM needs to run code (instruction, page and stack pointer, stack, `std::vector<Scope>` for locals...). This has been added to help with adding parallelism to the language, it did not downgrade performances (nor did it improve them).

In later versions, more AST and new IR optimizations were implemented, which helped divide the run time of our benchmark by ~2.4:

```
Benchmark                         Time             CPU   Iterations
ackermann                      60.4 ms         60.3 ms           50
```

However, we still spend around 35% of our time in `findNearestVariable` (which calls `Scope::operator[]` on line 5):

```cpp
inline Value* VM::findNearestVariable(
  const uint16_t id,
  internal::ExecutionContext& ctx
) noexcept
{
  for (auto it = ctx.locals.rbegin(), it_end = ctx.locals.rend();
       it != it_end; ++it)
  {
    if (const auto val = (*it)[id]; val != nullptr)
      return val;
  }
  return nullptr;
}
```

Even with a basic bloom filter, searching for a value takes a lot of time, plus data locality isn't that good:

```cpp
bool Scope::maybeHas(const uint16_t id) const noexcept
{
  return m_min_id <= id && id <= m_max_id;
}

Value* Scope::operator[](const uint16_t id_to_look_for) noexcept
{
  if (!maybeHas(id_to_look_for))
    return nullptr;

  for (auto& [id, value] : m_data)
  {
    if (id == id_to_look_for)
      return &value;
  }
  return nullptr;
}
```

## How can we do better?

In his book [Crafting Interpreters](https://craftinginterpreters.com/), Robert Nystrom shows that you can use the stack for storing local variables in the [Local Variables](https://craftinginterpreters.com/local-variables.html) chapter. This would mean using a *single contiguous data structure* for all of our needs, which would actually be pretty neat, and most certainly yield impressive performance improvements!

Alas, due to how closures work in ArkScript, this isn't doable. Storing variables on the stack means the compiler has to know where we put each variable, and since no type checking is done at compile time, we can't easily know when we're compiling a closure call!

> [!NOTE]
> Actually, we can infer that from `a.b` or `a.b.c` because the dot notation is reserved for closures and field accessing, but this only covers 90% of use cases, by reading (foo) we don't know if we're calling a C++ function, a user function or a user closure.

But this gave me an idea: what if we could use a single contiguous data structure for our variables? And make small adaptations to handle closure scopes, that need to be kept alive while a closure is being called?

Well, I did that. And it worked.

### Contiguous storage for our locals

Currently, our locals are stored in a `std::vector<std::shared_ptr<std::vector<std::pair<id, value>>>>`, basically a list of pointers to lists of pairs. This can't be good, our piles of `id -> value` are scattered all over RAM! However, what we need for storing locals is:

- a vector or array to store our pairs `id -> value`
- a length, to know how many elements are in our scope
- maybe some min and max id to implement a basic bloom filter

So we could make *views* over a single `std::array<std::pair<id, value>, N>`, that knows where they start, and how many elements they hold.

The `Scope` implementation didn't even have to change that much:

```cpp
ScopeView::ScopeView(
  std::array<pair_t, ScopeStackSize>* storage,
  const std::size_t start
) noexcept :
  m_storage(storage), m_start(start), m_size(0),
  m_min_id(std::numeric_limits<uint16_t>::max()),
  m_max_id(0)
{}

void ScopeView::push_back(uint16_t id, Value&& val) noexcept
{
  if (id < m_min_id)
    m_min_id = id;
  if (id > m_max_id)
    m_max_id = id;

  (*m_storage)[m_start + m_size] = std::make_pair(id, std::move(val));
  ++m_size;
}

bool ScopeView::maybeHas(const uint16_t id) const noexcept
{
  return m_min_id <= id && id <= m_max_id;
}

Value* ScopeView::operator[](const uint16_t id_to_look_for) noexcept
{
  if (!maybeHas(id_to_look_for))
    return nullptr;

  for (std::size_t i = m_start; i < m_start + m_size; ++i)
  {
    auto& [id, value] = (*m_storage)[i];
    if (id == id_to_look_for)
      return &value;
  }
  return nullptr;
}
```

And creating a new scope is still quite easy, we just need to pass a pointer to our array, and the first free position:

```cpp
context.locals.emplace_back(
  // our array<pair<id, value>>
  &context.scopes_storage,
  // the end of the scope (size + start) = first free slot
  context.locals.back().storageEnd()
);
```

As for closures, I had to create a dedicated `ClosureScope`, that was basically the old `Scope`, since the closure needs to have ownership of a scope and now we use views. Merging a `ClosureScope` inside a `Scope` is still doable (so that we can create a scope of references to the closure's fields):

```cpp
void ClosureScope::mergeRefInto(ScopeView& other)
{
  for (auto& [id, value] : m_data)
  {
    if (value.valueType() == ValueType::Reference)
      other.push_back(id, value);
    else
      other.push_back(id, Value(&value));
  }
}
```

All of this is very fancy, and seems to work on paper, right? But some of you may have noticed a flaw in this design: what if we need to add values to a scope that *isn't* the last and active one? It would break! Luckily, this can't happen as only one scope can be active at a time, and variables are **always** added to the current active scope, which is the last one on our pile of scopes.

### Gotta go fast!

By using a contiguous storage, avoiding useless copies of the pairs `id -> value` when the storage vector grew, avoiding reserving and freeing memory every time a function is call / returns, we have achieved a 21% performance improvement on our benchmark (and even up to 76% improvement on the binary tree benchmark!):

Results:

```
Benchmark                         Time             CPU   Iterations
ackermann_begining              197 ms          197 ms            4
ackermann_dichotomy             294 ms          294 ms            2
ackermann_push_back             192 ms          192 ms            4
ackermann_single_stack         60.4 ms         60.3 ms           50
ackermann_contiguous           47.8 ms         47.7 ms           50

binary_trees_single_stack    3965.9 ms      3962.32 ms            1
binary_trees_contiguous         941 ms          939 ms            1
```

