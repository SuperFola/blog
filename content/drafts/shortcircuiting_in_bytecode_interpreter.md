+++
title = 'Adding short-circuiting in a bytecode interpreter'
date = 2024-09-10T15:48:00+02:00
tags = ['bytecode', 'vm']
categories = ['pldev']
+++

[In the previous article]({{< ref "/posts/function_calls_in_bytecode_interpreters" >}} "Function calls in bytecode interpreters"), we saw how to compile functions and handle their scopes. We also saw how to optimize a certain kind of function calls, the tail call ones in [Understanding tail call optimization]({{< ref "/posts/understanding_tail_call_optimization" >}} "Understanding tail call optimization"), now we are going to see yet another optimization, this time on conditions and expression evaluation.