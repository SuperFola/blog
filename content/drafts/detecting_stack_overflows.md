+++
title = 'Implementing stack overflow protection in ArkScript'
date = 2025-09-11T08:46:48+02:00
tags = ['arkscript']
categories = ['pldev']
+++

ArkScript is a programming language running in a stack-based virtual machine, implemented in C++. If we are not careful, we could blow the stack (even though it is about 4096 elements long) and crash the VM!

There are multiple methods to prevent a stack overflow: bound checking every read/write, making the stack grow before it overflows, designing the language in a way overflows are not possible (which is either impossible to do or seriously limiting the language capabilities).