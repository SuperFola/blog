+++
title = 'Code formatter for ArkScript'
date = 2024-07-31T22:32:45+02:00
tags = ['arkscript']
categories = ['pldev']
+++

why?
uniformity, creating a norm

complexe piece of code
how do you split code on multiple lines and when

do not remove comments because they aren't nodes, so finding to which node we should attach them is tough
Also do we attach them to the next node or the previous node? To put them before or after the node it is attached to?
We can’t use a single policy (always attach to the next node) because it can’t handle something like
```
# comment
(node)

(fun ()
  (do stuff)) # this obviously needs to be attached to the (fun) node

# comment without a node after
```
The opposite policy of attaching to the previous node doesn’t work either

making it idempotent
-> finding bugs in the parser and the tracking of lines/col number

the result
about 500-600ish lines of code, but by far a lot more complex than the compiler (> 3000 lines)

