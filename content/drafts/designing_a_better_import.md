+++
title = 'Designing a better import for ArkScript'
date = 2024-10-28T12:58:00+02:00
tags = ['arkscript']
categories = ['pldev']
+++

Currently ast are merged together, we can’t import with a prefix nor import only a few symbols

Need to treat each file as a module

A module has a prefix (can be empty) and a list of symbols to export (if empty export everything)

We could have x modules with x files but then the name and scope resolution does not work? Do we need linkage to merge values and symbols tables? If we compile module separately we would need that, in a linkage step after compiling, before optimizing the ir. But we lose the ability to trim down the ast by removing unused code

How can we merge modules in a single ast? Modify all the declared and used symbols in a module to prefix it accordingly?