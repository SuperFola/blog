+++
title = 'Implementing an Intermediate Representation for ArkScript'
date = 2024-10-01T17:45:45+02:00
tags = ['arkscript']
categories = ['pldev']
+++

Currently: arkscript code -> ast -> bytecode
Goals: optimizing bytecode to remove useless/redundant instructions, replacing N instructions with a single bigger instruction
Problems: operating on bytecode to optimize it isn’t optimal: we either need to replace instructions with NOP or move all instructions when a pair is replaced by a single instruction as well as jumps

Compiler: flatten the ast (tree) into a list of instructions

First idea: output a tree of IR instructions instead of list of instructions (but flatter than the ast)
Feels like reinventing the wheel, another ast, we have something not flat to handle a sequence of conditions (if cond (if cond2 ...))

Second idea: use a lisp like, (mov a 0), (jump addr)...
Flat, feels good, but we still have a problem with jump addresses that need to be updated when the instruction count changes
Solution: introduce labels and goto inside the IR, and compile them later to addresses

1. Go through the IR inst look for Load store, load load, store store...
2. Do not work on load label store as that would break the label/goto (investigation needed here)
3. Go through all the code to remove NOP
4. Go through the code to find the labels and their address, to compute the final bytecode
