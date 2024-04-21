+++
title = 'Call me maybe: an explanation of Python callable'
date = 2020-03-24T22:55:57+02:00
draft = false
keywords = ['python', 'explainlikeimfive']
+++

If you have some experience with Python, you must have already seen a `TypeError: 'T' object is not callable`.

In this article we will try to demystify this kind of errors.

# What is a callable?

A `callable` is anything that can be called, from a function, to a class constructor.

For example, `len` is a callable because we can write `len(object)`.

# Creating a callable

The easiest way is to write a function or a lambda:

```python
def foo(*args):
    pass

bar = lambda *args: 0
```

But here we won't cover those things as they are basic Python knowledge.

```python
class Foo:
    def __call__(self, *args):
        print("hello world!")

bar = Foo()  # instanciating a Foo object, creating a callable
bar()  # calling it!
```

We created a basic callable by giving it a `__call__` method, and we can check if an object is callable (useful when debugging) by using:

```python
# homemade method to explain EAFP
def is_callable(obj, *args, **kwargs, ***okwargs):
    try:
        obj(*args, **kwargs, ***okwargs)
    except TypeError as e:
        return 'object is not callable' not in str(e)
    return True

# built-in way to check if an object is callable (thanks rhymes for pointing it out): using callable(obj)
>>> callable(foo), callable(bar), callable(Foo), callable(Foo()), callable(3)
(True, True, True, True, False)
```

Because we can't use `hasattr(obj, '__call__')`, since Python is skipping `__getattribute__` and `__getattr__` when *calling* something, thus we can only do what's called **EAFP**: **E**asier to **a**sk for **f**orgiveness than **p**ermission.

------

Hopefully this article has helped you, if you have anything to add feel free to leave a comment!

