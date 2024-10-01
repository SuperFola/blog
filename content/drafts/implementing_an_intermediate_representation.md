+++
title = 'Implementing an Intermediate Representation for ArkScript'
date = 2024-10-01T17:45:45+02:00
tags = ['arkscript']
categories = ['pldev']
+++

Currently: arkscript code -> ast -> bytecode 
Goals: optimizing bytecode to remove useless/redundant instructions, replacing N instructions with a single bigger instruction
Problems: operating on bytecode to optimize it isn’t optimal: we either need to replace instructions with NOP or move all instructions when a pair is replaced by a single instruction as well as jumps