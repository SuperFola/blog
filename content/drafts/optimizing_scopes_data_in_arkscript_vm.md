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

todo

Using a `Frame` object, instanciated for each scope. Each `Frame` instanciated a new stack for itself, implemented as a `std::vector` (which mean that pushing to it would make grow and copy all of its elements, which is highly inefficient).

Locals were stored as a `std::shared_ptr<std::vector<Value>>`. You read that right, no id. You accessed a specific variable using `locals[variable_id]`.

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
Benchmark                  Time             CPU   Iterations
Ackermann_3_7_ark        197 ms          197 ms            4
```

### Locals as a list of pair of id and value

From version [3.0.13](https://github.com/ArkScript-lang/Ark/tree/v3.0.13) to [3.0.15](https://github.com/ArkScript-lang/Ark/tree/v3.0.15).

todo

This version introduced the first version of the `Scope`, that we're still using today!

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

It's slower, probably due to `Scope`s being used for locals, as well as `Frame`s for the stacks! Separating those two concepts might seem like a good idea architecture wise, but in term of performance we're splitting two important data structures and sprinkling them all over our RAM, thus accessing them is highly inefficient.

Also, upon adding a new value, we were trying to be smart by sorting elements, so that lookup would be faster. In retrospect (and after having looked at benchmarks), I now know it was a bad idea (which is why I'm not doing this anymore!):

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

Results:
```
Benchmark                            Time             CPU   Iterations
Ackermann_3_7_ark_dichotomy        294 ms          294 ms            2
Ackermann_3_7_ark_push_back        192 ms          192 ms            4
```

### Single stack

From version [3.1.0](https://github.com/ArkScript-lang/Ark/tree/v3.1.0) to [4.0.0-10](https://github.com/ArkScript-lang/Ark/tree/v4.0.0-10).

todo

In v3.1.0, the `Scope` removed the sorted insert to push everything at the end of its `std::vector<std::pair<id, Value>>`. Also, the horrendous `std::vector<Frame>` was replaced by a `std::unique_ptr<std::array<Value, 8192>>`!

Results:
```
Benchmark                  Time             CPU   Iterations
Ackermann_3_7_ark        146 ms          146 ms            5
```

Then, in v3.1.3 the `ExecutionContext` appeared: it's a struct with everything the VM need to run code (instruction, page and stack pointer, stack, `std::vector<Scope>` for locals...). This has been added to help with adding parallelism to the language.

In later versions, more AST and new IR optimizations were implemented, which helped reach those numbers:

```
Benchmark                   Time             CPU   Iterations
ackermann                60.4 ms         60.3 ms           50
```

However, we still spend around 35% of our time in `findNearestVariable` (which calls `Scope::operator[]` on line 5):

```cpp
inline Value* VM::findNearestVariable(const uint16_t id, internal::ExecutionContext& context) noexcept
{
  for (auto it = context.locals.rbegin(), it_end = context.locals.rend(); it != it_end; ++it)
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

todo

implement the array of locals and bench

- store locals on the stack (https://craftinginterpreters.com/local-variables.html)
    -> not doable for us because closure lookups
- array<Local, 8192> locals
    -> Scope = view {locals, start = x, length = L, min_id, max_id}
    -> linear, better for cache, no more allocations, space is already available
    -> peut fonctionner car on ajoute des variables que dans le tout dernier scope
    -> idem pour les closures? attention car on a une histoire de shared_ptr
        -> on veut garder les closures en vie et on a des mergeScopeInto
        -> les scope de closure devront être différents: créés à la volée quand on make_closure au lieu de dépendre du scope en cours
        -> comment gérer les merdes sur stacked_closure_scopes?

