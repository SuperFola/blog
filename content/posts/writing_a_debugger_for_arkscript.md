+++
title = 'Writing a debugger for ArkScript'
date = 2026-10-06T19:31:10+02:00
tags = ['arkscript', 'pldev']
+++

In February 2024, I first discussed adding a debugger to ArkScript with other devs that were involved in the project at
that time. I didn't know where to start or how it should work ; and about two years later this is now done.

## What should it do?

With an ideal debugger, I'd like to be able

- to add a breakpoint in my code, without relying on specific IDEs integration ; a `(breakpoint condition)` expression
  is more portable
- to trigger the debugger when there is a runtime error (type error, arity error, assert failed...)
- to have breakpoints in the code but allow them to start the debugger only if we passed a specific CLI flag, eg
  `arkscript -fdebugger myfile.ark`
- to spawn a REPL-like shell on a breakpoint / error, that allows users to write ArkScript code to examine what went
  wrong
- maybe add breakpoints from the debugger, given a file and line

<!--more-->

## Introducing a new instruction: BREAKPOINT

If we want to place breakpoints everywhere in our code (either at runtime when the debugger is running, or when writing
code), it has to be a special instruction that won't push anything to the stack, to avoid messing up calls:

{{< highlight_scripts >}}

{{< highlight_arkscript >}}
(let foo (fun (a b c) {
  (let d (+ a b))
  (* d c) }))

(foo 1 2 (breakpoint true) 3)
{{< /highlight_arkscript >}}

We wouldn't want to be passing 4 arguments to `foo`, but instead trigger a breakpoint while passing arguments to `foo`.

-----

Breakpoints should also take (an optional) boolean argument, to be able to conditionally trigger them.  
To me, this should be a basic feature of any debugger: maybe I always want to trigger a breakpoint, or only inside a
*while loop* when a counter is over 5 and below 10, or inside a function being called from all over my code but only
with a specific set of arguments. This helps a lot when debugging, because I don't want to waste time skipping
breakpoints until I find the call I'm interested in (and sometimes miss it, forcing me to start all over again): I want
to focus on the weirdness of my code and the bugs.

## Toggle the debugger

In the current implementation, `BREAKPOINT` instructions are always emitted, and the VM skips them if the debugger
wasn't enabled via the CLI flag. I might compile breakpoints only if `-fdebugger` is passed in the future, to avoid
computing unused conditions that would slow down code.

Another important thing is that enabling the debugger won't disable optimisation passes, IR would still be optimised,
unused code would still be pruned, which is something other languages wouldn't do. When you are tracking down a bug, it
sometimes only happen in a given configuration, and disabling every optimisation might make the bug go away, and thus
harder to track down.

## Implementing the breakpoint logic

Passing `-fdebugger` to the CLI would allow the VM to create and use a `Debugger` object which would know everything
about the current execution state of the VM:

```cpp
int VM::safeRun(ExecutionContext& context) {
  // ...
  TARGET(BREAKPOINT) {
    {
      bool breakpoint_active = true;
      // retrieve a boolean from the stack only if we
      // were passed one: (breakpoint cond)
      if (arg == 1)
        breakpoint_active =
          *popAndResolveAsPtr(context) == trueSym;

      if (m_state.m_features & FeatureVMDebugger &&
          breakpoint_active)
      {
        initDebugger(context);
        m_debugger->run(*this, context);
        m_debugger->resetContextToSavedState(context);
      }
    }
    DISPATCH();
  }

  // ...
}

void VM::initDebugger(ExecutionContext& context) {
  if (!m_debugger)
    m_debugger = std::make_unique<Debugger>(
      context,
      m_state.m_libenv,
      m_state.m_symbols,
      m_state.m_constants);
  else
    m_debugger->saveState(context);
}
```

We should create only one debugger in the VM, and only on demand. Plus, since the debugger will most probably have to
push values on the stack, create variables, call functions... we will have to save the VM state from before the debugger
is called using `m_debugger->saveState(context)` (this is also done by the constructor of the debugger). This way, we
can go back to the normal VM state (instruction, page and stack pointers, as well as locals and closures) after the
debugger gives control back to the VM, using `m_debugger->resetContextToSavedState(context)`.

Done this way, it is very easy to test the `BREAKPOINT` instruction with a nearly empty `Debugger` class that prints the
context and reset an `ExecutionContext`:

```cpp
Debugger::Debugger(...)
{
  saveState(context);
}

void Debugger::saveState(ExecutionContext& context) {
  m_states.emplace_back(
    std::make_unique<SavedState>(
      context.ip,
      context.pp,
      context.sp,
      context.fc,
      context.locals,
      context.stacked_closure_scopes));
}

void Debugger::resetContextToSavedState(ExecutionContext& context) {
  const auto& [ip, pp, sp, fc, locals, closure_scopes] =
    *m_states.back();

  context.locals = locals;
  context.stacked_closure_scopes = closure_scopes;
  context.ip = ip;
  context.pp = pp;
  context.sp = sp;
  context.fc = fc;

  m_states.pop_back();
}

void Debugger::run(VM& vm, ExecutionContext& context)
{
  m_running = true;

  fmt::print("> ");
  std::string line;
  std::getline(std::cin, line);

  fmt::println("{} {} {}", context.ip, context.pp, context.sp);

  m_running = false;
}
```

## Launching the debugger on error

This seems identical to the breakpoint logic: catch C++ exceptions, display backtrace, launch debugger. However, there
is a subtlety: the `VM::backtrace()` would traverse the stack, roll back the instruction and page pointers, and remove
values from the stack to create a stack trace with all the function calls.

Thus, we need to save the execution state *before* computing the backtrace, and reset the context to the saved state
*after*. This is something that can easily be done,  since popping a value from ArkScript's VM stack doesn't remove
anything but returns a pointer to an element in an array, and decrement the stack pointer!

```cpp
void VM::showBacktraceWithException(const std::exception& e, ExecutionContext& context) {
  std::string text = e.what();
  if (!text.empty() && text.back() != '\n')
    text += '\n';
  fmt::println("{}", text);

  // If code being run from the debugger crashed,
  // ignore it and don't trigger a debugger inside
  // the VM inside the debugger inside the VM
  const bool error_from_debugger = m_debugger && m_debugger->isRunning();
  if (m_state.m_features & FeatureVMDebugger && !error_from_debugger)
    initDebugger(context);

  const std::size_t saved_ip = context.ip;
  const std::size_t saved_pp = context.pp;
  const uint16_t saved_sp = context.sp;

  backtrace(context);

  fmt::println("At IP: {}, PP: {}, SP: {}", saved_ip / 4, saved_pp, saved_sp);

  if (m_debugger && !error_from_debugger)
  {
    m_debugger->resetContextToSavedState(context);
    m_debugger->run(*this, context);
  }
```

## Compiling code at runtime

We can now get to the heart of the debugger: we hit an error, and we want to inspect the current VM state using code!

To achieve that goal, we need to be able to compile code given by the user that can reference live variables, which is
tricky since we potentially do not have access to the original source code, and also we wouldn't want to trigger a
complete recompilation of all the user's code, adding the debugger code to it!

That's why I introduced partial compilation: since the debugger has access to the entirety of the VM, it has also access
to all the symbols and constants that are currently used, which we can use when compiling code:

```cpp
std::optional<std::vector<bytecode_t>> Debugger::compile(
  const std::string& code,
  const std::size_t offset
) {
  Welder welder(0, m_libenv, DefaultFeatures);
  if (!welder.computeASTFromStringWithKnownSymbols(code, m_symbols))
    return std::nullopt;
  if (!welder.generateBytecodeUsingTables(m_symbols, m_constants, offset))
    return std::nullopt;

  BytecodeReader bcr;
  bcr.feed(welder.bytecode());
  const auto syms = bcr.symbols();
  const auto vals = bcr.values(syms);
  const auto files = bcr.filenames(vals);
  const auto inst_locs = bcr.instLocations(files);
  const auto [pages, _] = bcr.code(inst_locs);

  m_symbols = syms.symbols;
  m_constants = vals.values;

  return pages;
}
```

- on line 6, we compute an AST from the code given by the user inside the debugger, using the known symbols from the VM.
  This way, we won't have an "Unknown symbol" error
- on line 8, we compile the AST to bytecode using the existing symbols and constants, and offsetting the bytecode pages
  by the number of bytecode pages the VM is currently running: this way we won't overwrite existing code, only append to
  it
- on lines 11-20, we read the computed bytecode to extract the new symbols and constants tables to use in the VM, so
  that we can create new variables inside the debugger, and actually use them

## Executing the debugger code

Execution itself is very easy: like the REPL, we just have to reset the instruction and page pointers to point to our
newly compiled code, and run the VM:

```cpp
const std::string& line = maybe_input.value();
const auto pages = compile(m_code + line, vm.m_state.m_pages.size());

if (pages.has_value())
{
  context.ip = 0;
  context.pp = vm.m_state.m_pages.size();
  // create dedicated scope, so that we won't be overwriting existing variables
  context.locals.emplace_back(context.scopes_storage.data(), context.locals.back().storageEnd());

  // vvv this is the tricky part, to get our code to run!
  vm.m_state.extendBytecode(pages.value(), m_symbols, m_constants);

  if (vm.safeRun(context) == 0)
  {
    // executing code worked
    m_code += line;

    const Value* maybe_value = vm.peekAndResolveAsPtr(context);
    if (maybe_value != nullptr)
      fmt::println("{}", maybe_value->toString(vm));
  }
  context.locals.pop_back();
}
```

The magic happens on line 12, we have compiled the code entered in the debugger, using the symbols of the script to have
everything align neatly, so that the compiled code is valid and will be able to reach live variables. We now have to
add the compiled code to the running code, as a new bytecode page (which represents a function).

What we have to do to get our code to run is to add it to a big contiguous chunk of bytecode, potentially register some
new symbols and values, and... that's it! Running the code is as simple as jumping to the first added page, which is
done on line 7.

## Adding functionalities to the debugger

We can now run code pretty easily, inspect our code with code. But we still can't access the virtual machine inner
workings, like the stack, the locals, the pointers' values!

That's something I solved with a custom `prompt()` function, asking the user for code... or for a debugger command:

```cpp
// Debugger::run
std::optional<std::string> maybe_input = prompt(ip_at_breakpoint, pp_at_breakpoint, vm, context);

// ...

std::optional<std::string> Debugger::prompt(
  const std::size_t ip,
  const std::size_t pp,
  VM& vm,
  ExecutionContext& context
) {
  std::string code;
  long open_parens = 0, open_braces = 0;

  while (true)
  {
    const bool unfinished_block = open_parens != 0 || open_braces != 0;
    fmt::print(m_os, "dbg[pp:{},ip:{}]:{:0>3}{} ", pp, ip / 4, m_line_count, unfinished_block ? ":" : ">");

    std::string line;
    std::getline(std::cin, line);
    Utils::trimWhitespace(line);

    if (line.empty() && !unfinished_block)
    {
      fmt::println(m_os, "dbg: continue");
      return std::nullopt;
    }

    if (const auto& maybe_cmd = matchCommand(line))
    {
      const Command cmd = maybe_cmd.value();
      if (cmd.action(line, CommandArgs { .vm_ptr = &vm, .ctx_ptr = &context, .ip = ip, .pp = pp, .me = cmd }))
        return std::nullopt;
    }
    else
    {
      code += line + "\n";
      open_parens += Utils::countOpenEnclosures(line, '(', ')');
      open_braces += Utils::countOpenEnclosures(line, '{', '}');

      ++m_line_count;
      if (open_braces == 0 && open_parens == 0)
        break;
    }
  }
  return code;
}
```

We can ask how many lines of text we need to the user (until the parens are balanced for example), and if a line matches
a registered command, we can run it with the needed context!

The current implemented commands are:
- `help`, to display the list of known commands,
- `c`, `continue`, to resume execution,
- `q`, `quit`, to quit the debugger, stopping the script execution,
- `stack <n=5>`, to show the last n values on the stack,
- `locals <n=5>`, to show the last n values on the locals' stack,
- `scopes <n=5>`, to show the last n scopes,
- `ptr`, to show the values of the VM pointers,
- `trace <n=10>`, to show the last n executed instructions.

That makes a decent framework of tools to catch bugs and understand them, and adding more commands is made easy, as they
are all objects with a shared interface:

```cpp
struct Command
{
  using Action_t = std::function<bool(const std::string&, const CommandArgs&)>;
  using Args_t = std::vector<std::pair<std::string, std::string>>;

  bool is_exact;
  std::vector<std::string> names;
  Args_t args;
  std::string description;
  Action_t action;
};
```

`is_exact` with require matching the entire command line as one of the `names` if true, otherwise we'll try to match
only a prefix, like `stack 5` will match the command with a name `stack`, and the remaining text will be passed as
`args`, separated by spaces. *I basically wrote a small parser to implement a small language for the debugger of
another language, ArkScript. Yes, I like implementing programming languages.*

`trace` displays the last `n` instructions executed by the virtual machine, stored in a queue to avoid storing millions
of instructions in a vector. We only store the last 4096 last executed instructions, and only if the debugger is active!
That way, when the debugger isn't needed, the VM can avoid some useless work.

---

The next goals will be, in no particular order:
- adding breakpoints at runtime, inside the debugger, given a filename and a line ;
- adding step by step debugging, so that we can execute one operation and go back to the debugger ;
- make the debugger follow the Debugger Adapter Protocol (DAP), to integrate it in IDEs