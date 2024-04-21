+++
title = 'What are those things named pointers?'
date = 2018-09-08T22:05:34+02:00
draft = false
keywords = ['explainlikeimfive', 'memory']
+++

Why did I write this article ? In my engineering school, we have C++ lessons, and very often, students do not understand what a *pointer* is, and what are their use. I tried to write something as simple as possible to fix this issue, do not hesitate to tell me if there is anything missing/wrong/whatsoever !

# What are those things called "pointers" ?

When programming in what we call "low level" programming language, you can sometimes meet what is called a *pointer*. In this post, we'll go through a bit of history and describe how a computer works before explaining what is this strange thing: "pointer".

# How does a computer store variables ?

Under the hood, a computer has what we call RAM - or memory - to store variables. Basically, it's a small hard drive dedicated to store data represented in binary format. Everything in memory is stored as a sequence of 0 and 1, formatted in such a way your computer can understand it.  
When creating a program, you can create variables of differents type, such as *number* (integers or floating point numbers), *string* (sequence of characters)... And they are all stored in memory as 0 and 1 !

It means that, when you create a new variable of type *integer*, it will allocate space for it in memory (usually 4 bytes), in order to store a value, for example "10", in binary format.

# A bit of history

We covered how variables are stored in memory, let's go through a bit of history to understand why pointers were created.

Basically, you can imagine that the number of variables we can create on a computer depends on the size - in bytes - of the memory available in your computer. Back in the time, when IT just started, the computers had fewer memory available, and managing it correctly was crucial.

Each variable declared in a program is created when the program starts, and the space allocated for it is only freed up when it's closed. The problem which can now appear is that if you need a temporary variable, eg for an equation, it won't be that temporary since it will live during all the execution of the program !

And here appeared "dynamic memory management". Behind those ugly words, there is a pointer ! The goal of "dynamic memory management" (I'll write it *DMM* since it's a bit shorter) is to be able to allocate memory at *runtime*, eg for a variable, and destroy it when it's not needed anymore. We can now create a temporary variable at runtime and save memory !

# How does *DMM* works ?

In pseudo-code, we could write this :

```
integer my_temporary_variable = allocate(integer);
```

This pseudo-function *allocate* will have to ask the operating system to search for available space in memory for an *integer*. If the OS found some space, it will allocate *sizeof(integer)* (as said before, usually 4 bytes) where the free space was found, and return the address where it was allocated. This address is a *pointer on integer* since it points to space in memory where this an integer.

Then, when we will need to use the value stored at this address, we'll need to tell our program not to use the *pointer*, but what is allocated where the *pointer* points.

As a comparison, we could say that :
When using a variable, we are sending a letter to the operating system, to ask for the value of this variable. No need to know where this variable is allocated in memory, the OS knows it.  
When we need to get the value pointed by a *pointer*, we send a letter with an *address* to the OS, which will go to this address, and send us back whatever is located there.

Lets illustrate this with some pseudo-code :

```
integer my_variable = 10;
print(my_variable);  // the OS knows where is 'my_variable'

// dynamically allocating memory
integer* pointer_to_int = allocate(integer);
// if the OS couldn't find space to allocate our integer, it returns the address 0
if (pointer_to_int == 0) {
    print("Could not find space for integer, aborting");
    abort();
} else {
    // otherwise, we can use our pointer
    // we use the notation '*variable' to tell the computer to get what is pointed by the pointer,
    //    instead of manipulating the pointer itself (which is basically an address, represented by an integer)
    *pointer_to_int = 12;
    print(pointer_to_int);  // will print something like '0x12ab45' (the value of the pointer: the address
                            //     of the variable allocated before)
    print(*pointer_to_int);  // will print '12', the value pointed by our pointer
    // do not forget to deallocate the space allocated before
    deallocate(pointer_to_int);
    // now, pointer_to_int points to nothing, the value was destroyed and space used was fred up
}
```

