+++
title = 'Different kinds of tests'
date = 2024-04-24T21:45:19+02:00
draft = false
tags = ['tests']
+++

Everyone loves their tests, they can help with refactoring, code quality, adding new feature more easily... but you can also find the opposite points of view. Some may argue that yes, tests are great, but they can also hinder your ability to refactor your code.  
Or give you a false sense of security about your project, eg. you have thousands of tests but you mocked your database and never tested your code against a real one (think code coverage: a 100% test coverage with every service mocked is not really of value).

I think that I'm in the middle, currently working on a pretty long hobby project of mine with a mediocre test coverage, that I'm trying to improve. I love having tests when I'm in the middle of adding a new feature, to ensure everything still behaves as intended, but I heavily distrust the system and assume that anything can go wrong (because of a lack of tests or an overlook like a mocked service).

A brief word about said project: it's a programming language, compiled for a custom virtual machine (think Java but small). Testing it is trivial and hard at the same time.

## Unit tests

[Some](https://www.shaiyallin.com/post/unit-tests-considered-harmful) [articles](https://matklad.github.io/2022/07/04/unit-and-integration-tests.html) will argue that unit tests are not useful, can be bad for refactoring, give a false sense of security... and I agree with those. Defining "unit tests" and what your unit is is important.

For my projects, particularly [ArkScript](https://github.com/ArkScript-lang/Ark), I have written as many "unit tests" as I could in the language itself. My unit here is a small functionnality of the language, while some people may argue it's an integration test because I'm now testing a parser + compiler + virtual machine + maybe more C++ code, and I invite you to read matklad's article linked above, about thinking of your *test purity* instead of an opposition *unit* and *integration*.

Hence I call them *unit tests*, because they fall in the scope of 
- fast running tests (250+ tests in less than 10ms)
- one or two lines per test at most
- tested functionnality has the least IO and impurity possible

One of my test case on conversions looks like this (using a DSL written using the language's macro system):

```lisp
(test:case "conversions" {
    (test:eq (toNumber "12") 12)
    (test:eq (toNumber "abc") nil)
    (test:eq (toNumber "-12.5") -12.5)
    (test:eq (toString 12) "12")
    (test:eq (toString nil) "nil")
    (test:eq (toString true) "true")
    (test:eq (toString false) "false")
    (test:eq (toString [1 2]) "[1 2]")
    (test:eq (toString ["12"]) "[\"12\"]") })
```

I'm testing the conversion between any type to a number/string, the tests are easy to read and extend.

## Integration tests

Another kind of tests is the *integration* one, to check that multiple components work together and not just in isolation. I like to think about those as a big unit test with more IO and impurity.

I've written some integration tests to ensure you can easily bind a C++ function in ArkScript, traversing the parser, compiler and virtual machine ; what differentiate this specific test from a *unit test* here, is the intent: in the previous section I said that I wanted to test a single functionnality (conversions), here I want to test all the components integrating with one another (even though both scenarios ends up doing the same thing).

Such a test would look like this (in C++ this time, using [boost ut](https://github.com/boost-ext/ut)):

```cpp
ut::suite<"VM"> vm_suite = [] {
    using namespace ut;

    "[run string and call arkscript function from cpp]"_test = [] {
        Ark::State state;

        should("compile the string without any error") = [&] {
            expect(mut(state).doString("(let foo (fun (x y) (+ x y 2)))"));
        };

        Ark::VM vm(state);
        should("return exit code 0") = [&] {
            expect(mut(vm).run() == 0_i);
        };

        should("have symbol foo registered") = [&] {
            auto func = mut(vm)["foo"];
            expect(func.isFunction());
        };

        should("(foo 5 6.0) have a value of 13") = [&] {
            auto value = mut(vm).call("foo", 5, 6.0);
            expect(value.valueType() == Ark::ValueType::Number);
            expect(value.number() == 13.0_d);
        };
    };
```

I want to test that I can
* compile ArkScript code in C++ using the API
* run said code and get no error
* get an object from the VM, with the code I ran
* call a function defined in ArkScript, from C++, with C++ values

You can still break the test down to very specific expectations, but all those expectations together form an *integration test*.

## Benchmarking

Is that really some kind of tests? If you call it regression testing (regarding performances), then yes! And that's exactly what I'm doing with ArkScript: I have a few benchmarks running computation heavy code in ArkScript, that I run once in a while to ensure that I didn't introduce any regression in term of speed.

When I wrote those tests, it wasn't because I wanted to achieve the maximum speed possible, it was to track slowdown that I could introduce. Thus, when refactoring code (particulary on the virtual machine side), I will often run those benchmarks after every commit, if not after every file modified (to guide me and give me a rough intuition of how all my code interacts in term of performance).

A few important things to note:
- I always run the benchmarks multiple times to ensure that the number I get are reproducible and not a fluck
- when running benchmarks, I monitor my CPU usage and load to keep it below 3-4, to ensure reproducibility and rule out interferences as much as possible (leading to run Clion in *power saving mode* quite often)
- I have to run the benchmarks on the same hardware, and always run the same benchmarks (you can't compare two different runs of two different benchmarks!)
- the benchmarks also have to be fast ; I don't want to sit and do nothing for 5 minutes, they have to run for at most 10-20 seconds!

```cpp
// cppcheck-suppress constParameterCallback
void ackermann(benchmark::State& s)
{
    Ark::State state;
    state.doFile(std::string(ARK_TESTS_ROOT) + "tests/benchmarks/ackermann.ark");

    for (auto _ : s)
    {
        Ark::VM vm(state);
        benchmark::DoNotOptimize(vm.run());
    }
}
BENCHMARK(ackermann)->Unit(benchmark::kMillisecond)->Iterations(50);
```

This specific test uses the [Ackermann Peter function](https://en.wikipedia.org/wiki/Ackermann_function) which is computation heavy and allows me to ensure that the tail call optimization still does it's job.

