+++
title = 'What is OOP?'
date = 2018-09-28T22:09:38+02:00
draft = false
tags = ['oop']
categories = ['eli5']
+++

**Why** did i write this article ? Object Oriented Programming is very useful, but also a wide subject, and in my engineering school, I found it was a bit tough to understand this concept.

# A class describes an object

## ... but isn't the object itself.

When you are writing what we call a `class` in OOP, it's basically an instruction manual to build an *object*. Let's think about a chair: the chair itself is the object - who sometimes says it's an *instance* of the class - while the manual written to help you build one would be the class.

## A class also describes the behaviour of an object

Now that you understand the most primitive difference between a *class* and an *object*, I have to add something to the definition of a *class*: it doesn't **only** describe the shape of an object, it also describes its behaviour. To explain this, I will take an animal: a duck. Its manual would be something like the following:

```
Manual of: Duck
    - 2 webbed feet
    - 1 beak on a head at the end of a neck, linked to the body
    - feather on the body
    - 2 wings in feather, one on each side of it
    - rectangular shape for the body
```

*I know, our duck will look like this, but well, it looks nice, no ?*

```
       ___
   ___/   \
  /__  O   |
  \__     /
     \   /
    _|   |_      _____
   |       \\||//     |
   |       \\||//     |
   |___  __ __________|
      /..\ \\
```

And its behaviour should follow those rules:

```
Behaviour of: Duck
    - cackle with its beak
    - swim with its webbed feet
    - eat and drink with its beak
    - fly with its wings
    - walk with its feet
```

So a *class* is a combinaison of both of those things:
- the manual
- the behaviour

Let's keep this manual in a corner of your brain, we'll need it later.

# Some technical vocabulary

We saw the manual, to build a duck, and what behaviour it should have. All of these belong to a single *class*:
- all the parts of our duck described in the manual will have a corresponding *attribute* in our Duck *class*
- it's behaviour will be translated into *methods* in the same *class* Duck

So, with this new vocabulary, we now have this:
```
class: Duck
    attributes:
        - number of feet = 2
        - number of beak = 1
        - beak position = end of neck
        - number of neck = 1
        - position of neck = top left corner of body
        - material covering body = feather
        - number of wings = 2
        - wings material = feather
        - position of wing 1 = left side of body (centered)
        - position of wing 2 = right side of body (centered)
        - body shape = rectangular
    
    methods:
        - cackle with beak
        - eat with beak
        - drink with beak
        - swim with feet
        - walk with feet
        - fly with wings
```

We have the definition of our *class* Duck now ! We can create as many *object*s Duck as we want, but you may have notice that they will all look the same. Indeed, we didn't add an attribute for the age of the duck, or its color, its size...

# Extending our classes

## The concept of inheritance

We've seen that we can describe a duck with a class. Sometimes, writting those classes can take a long time since we need a lot of attributes and methods, and very often other people have already written those classes for us.

This means we can take there code and use it ! But... what if I want a class "SuperDuck", which could destroy buildings with a laser coming out of its beak ? Would I have to rewrite a whole class SuperDuck with the same attributes and methods as the class Duck, but also add attributes and methods related to the laser ?

The answer is no ! Thanks to inheritance, we can say "SuperDuck is a class. Its mom is Duck. SuperDuck has a laser coming out of its beak". It means we can define a class a child of another, which would take all the attributes and methods of the other class (called the "parent") and add our attributes and methods.

```
class: SuperDuck
    parents: Duck

    attributes:
        - laser emitter
        - batteries for laser

    methods:
        - emit laser
        - reload laser's baterries
```

You may have notice I wrote "parents" and not just "parent": yes, a class can have multiple parents ! This way, we could have a class Animal, a Duck with Animal as its parent, another class SuperHero, and a class SuperDuck which would inherit from the class Duck and the class SuperHero, and we won't have any code to write for this SuperDuck :)

