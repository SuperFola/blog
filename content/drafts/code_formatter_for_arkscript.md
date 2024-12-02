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

Group code together when there isn’t a blank line between them (be careful with comments!), and keep the blocks that are separated by blanks lines, separated by at most one blank line

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

Found it easier to format all nodes the same way at first, starting from a very small rule set I had in mind, then iterating on the output produced until I like it. Having a decent number of files (50+) to parse helps, with various code blocks and file lengths to be somewhat assured that all cases are reached

making it idempotent
-> finding bugs in the parser and the tracking of lines/col number
-> running on a formatted code shouldn’t update the code again (would indicate a bug in our rules, eg one rule that creates code that should trigger a second rule ; running the formatted X times on a file to be sure all rules are applied wouldn’t be suitable)

the result
about 500-600ish lines of code, but by far a lot more complex than the compiler (> 3000 lines)

