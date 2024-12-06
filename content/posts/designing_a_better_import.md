+++
title = 'Designing a better import for ArkScript'
date = 2024-12-02T22:03:00+02:00
tags = ['arkscript']
categories = ['pldev']
+++

In December 2022, a colleague gave me the idea to improve ArkScript import system. All it was doing was using a `(import "folder/file.ark")` syntax, and copy / pasting the content of the file (duplicate imports were removed).

The idea was to be able to do something akin to Scala or Python imports:

1. import a whole file, and have it in a namespace of it own ; eg `(import std.List)`
2. import only a few symbols from a file ; eg `(import std.List :map :flatten)`
3. import all symbols from a file, unprefixed ; eg `(import std.List:*)`

And it's finally done. About 730 days later. Because I took the wrong path forward, having a big compiler trying to do everything at once!

## Getting started

### ArkScript compiler in 2022

The compiler toolchain used to look like this:

```goat
.-------.      .--------.     .-----------------.
| Lexer | ---> | Parser | --> | Macro Processor | --.
.-------.      .--------.     .-----------------.    |
                 ^    |                              |
                 |    |                              |
                  '--'                               |
                   .----------.     .-----------.    |
                   | Compiler | <-- | Optimizer | <-'
                   .----------.     .-----------.
```

The compiler was doing a lot of work, transforming an AST into bytecode, checking for the presence of undefined symbols, suggesting alternative names… It was too big to be manageable, so it had to be split. The parser was also in charge of resolving imports, by recursively calling itself when it found an import node, leading to a code that was hard to read, navigate and update.

### ArkScript compiler as of now

After October 5th refactor, it's more like:

```goat
.--------.     .--------------.     .----------------.
| Parser | --> | ImportSolver | --> | MacroProcessor | --.
.--------.     .--------------.     .----------------.    |
                                                          |
 .----------.     .-----------.     .----------------.    |
 | Compiler | <-- | Optimizer | <-- | NameResolution | <-'
 .----------.     .-----------.     .----------------.
      |
      |     .-------------.     .------------.
       '--> | IROptimizer | --> | IRCompiler |
            .-------------.     .------------.
```

- The **Lexer** disappeared, as the old parser was also not very manageable, hard to evolve, had a lot of bugs and could create invalid nodes. We’re now using a *parser combinators* approach, checking syntax more seriously while parsing, ensuring only correct nodes can be created.
- The **import solving** got put in a separate pass, in charge of finding and replacing import nodes by a `Namespace` node with the different attributes of the import (glob, with prefix, specific symbols to import)
- The **macro processor** handles macros before name resolution happens, because it can craft identifiers! This is a complex piece of code that will have its own article as well.
- Then a new compiler pass appeared, and it is the one we will talk about the most: the **name resolution pass**, in charge of detecting unbound symbols and resolving namespaces.
- The **optimizer** is a simple mark and sweep algorithm, to remove dead code in the AST.
- The **compiler** now does the bare minimum and outputs *IR entities*, that are then grouped (by 2, 3 or even 4) by the **IROptimizer**, which tries to combine them together in a single more specialized instruction. The resulting **IR entities** are then compiled to bytecode for the VM.

## Name resolution

I wanted to keep the code as simple as possible, so as to avoid having to rewrite the compiler from scratch « just » to add better imports, all of this because I didn’t think about imports when I started ArkScript (after all, it was just a toy project in the early days).

There were multiple solutions:
- Parse the entry file, then get a list of its imports and parse them too, recursively, until we parsed all files that will be imported
	- Compile them separately, with informations about the namespaces to help linking
	- Add a linker stage
	- Somewhat don’t break the other passes like the macro processor, AST optimizer…
- Parse the entry file, get a list of all the imports, rename the symbols when they are used
	- But we have to be careful with global imports that can cause name conflicts!
	- Maybe we should create hidden namespaces and add aliases to be able to import only a few symbols, but how should that work if we import `foo`, that calls `bar` from the same module, while only `foo` is imported?
- Parse the entry file, get a list of all the imports
	- Have imports be replaced by a new node: `Namespace(is_glob: bool, with_prefix: bool, prefix: str, symbols: vec[str], ast: Node)`
	- Track all scopes (entering a function creates a scope, entering a namespace creates a named scope)
	- Fully qualify every name in the AST when we find a symbol, by using the stack of scopes & named scopes

I went for the third solution, which had the benefit of being able to track unbound variables too. If we encountered a new name, we could look it up recursively in our scopes, and if it didn’t find anything, then the variable is unbound! Otherwise we can update its name by asking the scope it’s in how to name it (scopes return the name as is, while named scopes return the name prefixed by the namespace).

Also, this solution wasn’t breaking anything more than:
- macro processing, as we now needed to traverse `Namespace` nodes (which is an easy fix),
- the compiler (which also has to know how to compile a `Namespace`: compile its inner AST without asking questions),
- name resolution (which now needed to track named scopes and rename symbols)

### The algorithm

1. visit AST
2. resolve Symbol
    1. find nearest scope that can resolve the name
    2. if the name didn't change: it is either already fully qualified or defined in a scope
    3. otherwise, get the `prefix:` of the fully qualified name
        1. if the prefix was added by the top most namespace scope, it is marked as resolved (meaning we can only have unprefixed `name` resolved as `prefix:name` inside the namespace `prefix`)
        2. otherwise, if the prefix was added by another namespace scope that is either glob (`(import package:*)`) or symbol lists (`(import package :a :b :c)`), it is marked as resolved
    4. throw an error if the name isn't marked as resolved: we found a potential match but most likely the provided name isn't correctly qualified

### A bit of code


The interesting parts of the Name Resolution in ArkScript are how names are resolved. To achieve this, we have a stack of (polymorphic) `Scope` (either `StaticScope` or `NamespaceScope`, to handle prefixes and such), and when we visit a symbol, we call `updateSymbolWithFullyQualifiedName`, to get a resolved symbol name, and raise potential errors if the resolution isn't allowed.

```cpp
std::string updateSymbolWithFullyQualifiedName(Node& symbol)
{
  auto [allowed, fqn] = m_resolver.canFullyQualifyName(symbol.string());

  if (!allowed)
  {
     std::string message;
     // Hidden symbols (that should be available to the code but not
     // the user) are suffixed by a comment, that a user can not input
     // This is a bit hackish but it works
     if (fqn.ends_with("#hidden"))
       message = fmt::format(
         "Unbound variable \"{}\". However, it exists in a namespace as"
         "\"{}\", did you forget to add it to the symbol list while"
         "importing?)",
         symbol.string(),
         fqn.substr(0, fqn.find_first_of('#')));
     else
       message = fmt::format(
         "Unbound variable \"{}\". However, it exists in a namespace as"
         "\"{}\", did you forget to prefix it with its namespace?)",
         symbol.string(),
         fqn);
     throw CodeError(
       message,
       symbol.filename(),
       symbol.line(),
       symbol.col(),
       symbol.repr());
  }

  symbol.setString(fqn);
  return fqn;
}
```

The name resolution retrieves a *fully qualified name* (or **FQN** in my code) from the nearest scope that can resolve it. Then it checks the name against a set of rules to tell its caller if the resolution is actually legal.

#### Determining if a qualified name is applicable

```cpp
std::pair<bool, std::string> ScopeResolver::canFullyQualifyName(
  const std::string& name
) {
  // a given name can be fully qualified if
  // old == new
  // old != new and new has prefix
  //     if the prefix namespace is glob
  //     if the prefix namespace has name in its symbols
  //     if the prefix namespace is with_prefix && is top most
  const std::string maybe_fqn = getFQNInNearestScope(name);

  if (maybe_fqn == name)
    return std::make_pair(true, maybe_fqn);

  const std::string prefix =
    maybe_fqn.substr(0, maybe_fqn.find_first_of(':'));
  auto namespaces =
    std::ranges::reverse_view(m_scopes) |
    std::ranges::views::filter([](const auto& e) {
      return e->isNamespace();
    });
  bool top = true;

  // iterate only on namespace scopes, in reverse!
  for (auto& scope : namespaces)
  {
    if (top && prefix == scope->prefix())
      return std::make_pair(true, maybe_fqn);
    if (!top && prefix == scope->prefix() &&
      (scope->isGlob() || scope->hasSymbol(name)))
      return std::make_pair(true, maybe_fqn);

    // and check saved scopes only for symbol imports
    for (const auto& saved_scope : scope->savedScopes())
    {
      if (prefix == saved_scope->prefix() &&
        saved_scope->hasSymbol(name))
        return std::make_pair(true, maybe_fqn);
    }

    top = false;
  }

  return std::make_pair(false, maybe_fqn);
}
```

On lines 27-29, the top scope get a special treatment, as it is the only scope that can resolve an unprefixed name to a prefixed FQN. This is because the nearest namespace scope is the namespace we're currently in, and symbols can get automatically prefixed by namespaces with prefix only in their own namespace!

#### Retrieving qualified names

```cpp
std::string ScopeResolver::getFQNInNearestScope(
  const std::string& name
) const {
  for (const auto& scope : std::ranges::reverse_view(m_scopes))
  {
    if (auto maybe_fqn = scope->get(name, true); maybe_fqn.has_value())
      return maybe_fqn.value().name;
  }
  return name;
}
```

Scopes are tested one after the other, in reverse order again, and return a `std::optional<Declaration>` (populated if the symbol is in scope, hence a `StaticScope` can resolve only known symbols, `NamespaceScope` can resolve known symbols but also assign them a new name.

```cpp
std::optional<Declaration> NamespaceScope::get(
  const std::string& name, const bool extensive_lookup
) {
  const bool starts_with_prefix =
    !m_namespace.empty() && name.starts_with(m_namespace + ":");
  // If the name starts with the namespace and we imported the
  // namespace with prefix, search for name in the namespace
  if (starts_with_prefix && m_with_prefix)
  {
    const auto it = std::ranges::find(m_vars, name, &Declaration::name);
    if (it != m_vars.end())
      return *it;
  }
  // If the name does not start with the prefix, and we import
  // through either glob or symbol list, search for the name in
  // the namespace
  // If the name does not start with the prefix, in a namespace
  // with a symbol list but can be resolved
  // If the name wasn't qualified, in a prefixed namespace, look
  // up for it but by qualifying the name
  else if (!starts_with_prefix)
  {
    auto it = std::ranges::find(
      m_vars,
      fullyQualifiedName(name),
      &Declaration::name);
    // search by original name too, in case the name was already
    // hidden on a previous pass
    auto it_original = std::ranges::find(
      m_vars,
      fullyQualifiedName(name),
      &Declaration::original_name);

    if ((m_is_glob || hasSymbol(name) || m_with_prefix) &&
      it != m_vars.end())
      return *it;

    if (!m_symbols.empty() && it_original != m_vars.end())
      return *it_original;
  }
  // lookup in the additional saved namespaces
  if (extensive_lookup)
  {
    for (const auto& scope : m_additional_namespaces)
    {
      if (auto o = scope->get(name, extensive_lookup); o.has_value())
        return o;
    }
  }
  // otherwise we didn't find the name in the namespace
  return std::nullopt;
}
```

The main rules are all in the `get` method of the scopes, but still quite concise and heavily commented, because I know I will get lost in a few months when I'll have to come back to it. Hiding symbols that aren't exported is done when adding symbols to the scope:

```cpp
std::string NamespaceScope::add(const std::string& name, bool is_mutable)
{
  // Since we do multiple passes on namespaces, we need to check if the
  // given name is already hidden, so that we can save the name as it
  // was on the first pass
  if (name.ends_with("#hidden"))
  {
    std::string std_name = name.substr(0, name.find_first_of('#'));
    // store final name, original name, mutability
    return m_vars.emplace(name, std_name, is_mutable).first->name;
  }

  // Otherwise, we also have to check for the presence of a namespace
  // prefix, and remove it when checking against the symbols list, to
  // determine if we need to hide the name or not
  const bool starts_with_prefix =
    !m_namespace.empty() && name.starts_with(m_namespace + ":");
  std::string fqn = fullyQualifiedName(name);
  std::string unprefixed_name =
    starts_with_prefix ? name.substr(name.find_first_of(':') + 1) : name;

  if (!m_symbols.empty() && !hasSymbol(unprefixed_name))
    return m_vars.emplace(fqn + "#hidden", fqn, is_mutable).first->name;
  return m_vars.emplace(fqn, fqn, is_mutable).first->name;
}
```

## Parting words

This article showed bits of code I used to make this import feature work. However, if you are on the same route: don't do what I did. Design your compiler / interpreter with a correct import system in mind first, otherwise you will have to do this weird AST modifying / linking pass, and it felt quite painful to integrate it at first (even though that's about 700 lines of code at most, in a 10K lines project).

Hopefully it can inspire you and give you a few ideas on how to resolve names, and what kind of rules you might want!

