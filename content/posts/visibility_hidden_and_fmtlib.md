+++
title = '-fvisibility=hidden and fmtlib'
date = 2025-02-24T14:33:39+01:00
tags = ['cplusplus', 'fmtlib']
categories = ['cplusplus']
+++

After having watch a video of Jason Turner about [visibility=hidden](https://www.youtube.com/watch?v=vtz8S10hGuc), I wanted to try and apply this compiler switch to my project, [ArkScript]({{< ref "/categories/ArkScript" >}}). This is useful for me as I build ArkScript in two phases: a shared library and an executable, and marking the symbols of the shared library as hidden unless specified otherwise allows the compiler to apply more optimizations.

In this project, I also use [fmtlib](https://fmt.dev), whose code is directly integrated to the shared library:

```cmake
# files needed for the library ArkReactor
file(GLOB_RECURSE SOURCE_FILES
        ${ark_SOURCE_DIR}/src/arkreactor/*.cpp
        ${ark_SOURCE_DIR}/lib/fmt/src/format.cc)

# ...

target_include_directories(ArkReactor
        SYSTEM PUBLIC
        "${ark_SOURCE_DIR}/lib/picosha2/"
        "${ark_SOURCE_DIR}/lib/fmt/include")
```

## The problem

I found it easier to add it this way, but after adding `-fvisibility=hidden`, any program linking against **ArkReactor** would have linker errors:

```
Undefined symbols for architecture arm64:
  "fmt::v11::vformat(fmt::v11::basic_string_view<char>, fmt::v11::basic_format_args<fmt::v11::context>)", referenced from:
      std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> fmt::v11::format<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, char const* const&>(fmt::v11::fstring<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, char const* const&>::t, std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, char const* const&) in server.cpp.o
      std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> fmt::v11::format<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>, char const* const&>(fmt::v11::fstring<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>, char const* const&>::t, std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&&, char const* const&) in server.cpp.o
      std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> fmt::v11::format<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, unsigned long&, unsigned short const&>(fmt::v11::fstring<std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, unsigned long&, unsigned short const&>::t, std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>>&, unsigned long&, unsigned short const&) in server.cpp.o
      std::__1::basic_string<char, std::__1::char_traits<char>, std::__1::allocator<char>> fmt::v11::format<unsigned long&, unsigned long&, unsigned short const&>(fmt::v11::fstring<unsigned long&, unsigned long&, unsigned short const&>::t, unsigned long&, unsigned long&, unsigned short const&) in server.cpp.o
ld: symbol(s) not found for architecture arm64
```

I had exported all the symbols I needed in my shared library, but I forgot about **fmtlib** symbols! Since I didn't want to mess with its source code, I either had to mess around with linker flags or find how to correctly link **fmtlib** to **ArkReactor** so that symbols would be correctly exported.

## fmtlib and visibility handling

**fmtlib** uses no visibility settings (<= 11.1.3) by default, handled by the macro `FMT_API`, which means nothing gets exported under `-fvisibility=hidden`!

### Solution

This is something we can play with by defining `FMT_STATIC` or `FMT_SHARED` ; in our case we need `FMT_SHARED` to be defined so that symbols will be exported with `FMT_VISIBILITY(default)` (which expands to `__attribute__((visibility(default)))`). As counter-intuitive as it seems, we are in fact making a shared library with **fmtlib** bundled in it, it does not just means "fmtlib will be compiled on its own as a shared library".

This one made me scratch my head a lot, I even resorted to asking ChatGPT (which provided no interesting solutions other than "modify fmtlib source code"). In the end, I might have saved myself all this trouble if I had used `target_link_libraries(ArkReactor PUBLIC fmtlib)` instead.

