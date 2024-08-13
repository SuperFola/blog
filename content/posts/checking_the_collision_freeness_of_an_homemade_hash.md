+++
title = 'Checking the collision "freeness" of an homemade hash'
date = 2024-08-13T20:03:37+02:00
draft = false
tags = ['cpp', 'optimization']
+++

## Why?

In a work related context, I had to create a hash algorithm working on a finite set of values (`[0, 0xFFFFFFFF]`) to output a non sequential serie from a sequential one (the output had to be rendered as a [UUID](https://fr.wikipedia.org/wiki/Universally_unique_identifier).

Basically, I wanted to avoid generating UUID looking like `00000000-0000-0000-0000-000000000001`, that will **definitely** appear to be sequential and easily abused to find other IDs.

## The transformation

Previously I called it a hash, it's more like a `map` function (or `transform` function for my C++ folks), operating on `[0, 0xFFFFFFFF] -> [0, 0xFFFFFFFF]` where the sequential aspect is lost.

What I was looking for is something like:
- 0 -> 5
- 1 -> 1632
- 2 -> 9018235
- 3 -> 543

and so on.

Easy to do, just put a few bitflips, bitswaps and call it a day. That might work, but I needed to make sure the transformation doesn't generate any collision, or that would be bad in our case.

If you're curious, the transformation I choose for this article looks like
```cpp
(((~constant ^ x) & 0x0000ffffl) | (~(constant ^ x) & 0xffff0000l)) & 0xffffffffl
```

A bunch of incomprehensible symbols that could seem random, as if I typed on my keyboard without looking. However the domain is crafted so that the first side `(~constant ^ x) | 0x0000ffffl` won't interfere with the second side `(~(constant ^ x) & 0xffff0000l)`, with a `& 0xffffffffl` at the end because I put `long` everywhere to avoid casting my `int` to `long` each time I use them due to potential overflow (that's still controled with the masks).

## Checking that the transformation is collision-free

My first approach was in Scala, as it is the language we use at work. I just put a few lines of code with a mutable set and hoped for the best.

```scala
def test(): Boolean = {
    var set = mutable.Set[Long]()
    for (x <- 1 to 0xFFFFFFFFl) {
        val r = compute(constant, x)
        if (set.contains(r)) {
            println(s"$x has a collision, generated $r")
            return false
        }
        set.add(r)
    }
    true
}

test()
```

However, after 10 minutes on an M1 MacBook Pro it wasn't finished, so I stopped it and started looking for a better way to check if my transformation was collision-free.

What's better than trying again without changing your code? Well I did just that, but using another language, much more low level: C++.

### The C++ way

I wrote nearly the same code, but using C++, and a "better set" (since `std::set` is ordered and slower in access and write), thinking that would do it:

```cpp
#include <iostream>
#include <unordered_set>

int main()
{
    auto set = std::unordered_set<long>();

    for (long x = 1; x < 0xffffffffl; ++x)
    {
        const long r = (((~constant ^ x) & 0x0000ffffl) | ((~(constant ^ x) & 0xffff0000l))) & 0xffffffffl;
        if (set.contains(r))
        {
            std::cout << x << " (uuid bits=" << r << ") already in set" << std::endl;
            return 1;
        }
        set.emplace(r);

        if ((x % 128000) == 0)
            std::cout << (100.0 * x / 0xffffffffl) << "%        \r";
    }

    return 0;
}
```

And compiled in release mode to get the best performances: `clang++ compute.cpp -o compute -O3 --std=c++20`. To my surprise, on my M1 MacBook Pro, it was a faster than the Scala solution but moved by 1% every 20 seconds or so! I didn't want to have to wait for so long to iterate on the transformation in case it generated a collision.

The "slowness" lies in two things here:
1. the way I check for collisions can not be parallelized (unless I compute N sets and then merge them, which will likely take a lot of time since we are working on 4'294'967'295 values)
2. emplacing in a set is more costly than just looking in an array at index `r`, it is itself hashing the value, and doing much more math than we need.

### A better C++ version

So what's stopping me from using a `std::array<char, 0xffffffff>` array? The memory (that would eat about 4GB of RAM!). But luckily all we want to do is mark an element as "used" and check if it is already registered. We could use a `std::vector<bool>`, but [I've taken this user's comment as true](https://stackoverflow.com/questions/5780112/define-a-large-bitset-in-c#comment58975406_32831639): “std::vector is of poor performance compared to bitset”, which reminded me that [std::bitset](https://en.cppreference.com/w/cpp/utility/bitset) existed!

Creating a `std::bitset<0xffffffff>` will most likely not work, since it would try to allocate it on the stack and we don't have 530+MB of stack available, so I just wrapped it in a `std::unique_ptr` for good measure:

```cpp
#include <iostream>
#include <memory>
#include <bitset>

int main()
{
    auto bits = std::make_unique<std::bitset<0xffffffffl + 1>>(0);

    for (long x = 1; x < 0xffffffffl; ++x)
    {
        const long r = (((~constant ^ x) & 0x0000ffffl) | ((~(constant ^ x) & 0xffff0000l))) & 0xffffffffl;
        if (bits->test(r))
        {
            std::cout << x << " (uuid bits=" << r << ") already in set" << std::endl;
            return 1;
        }
        bits->set(r);

        if ((x % 128000) == 0)
            std::cout << (100.0 * x / 0xffffffffl) << "%        \r";
    }

    return 0;
}
```

If you have a keen eye you will have noticed a weird size for the `std::bitset`: 0xffffffff + 1. That's because 4'294'967'295 should be a valid value, so I needed to have it available.

This new version (including the `std::cout` printing the percentage periodically) only takes about 12 seconds to tell me if the transformation has a collision or not (less if the collision is found at the beginning of the sequence). I'd say that this is quite good for me!

