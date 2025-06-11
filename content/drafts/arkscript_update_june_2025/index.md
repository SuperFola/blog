+++
title = 'ArkScript - June 2025 update'
date = 2025-06-08T19:02:45+02:00
tags = []
categories = ['arkscript']
+++

Since my [last update post]({{< ref "/posts/arkscript_update_april_2025/index.md" >}}), there was a total of 941 files changed, 10'780 insertions and 4'105 deletions in 71 commits. I mainly focused on optimizing the runtime performances of the language.

additional context in errors (useful for macro errors) ; overall enhanced error messages

benchmarks with codspeed

new instructions:
- reset scope (while loops)
- super instructions LT const jump if false (same with symbols, eq, neq, gt), call symbol, get field from symbol
- at sym sym
- increment store, decrement store
- check type of
- append in place sym
- push return address, now emitted by the compiler instead of done by the vm at runtime automagically
    - allowed to remove the weird stack swapping at runtime, to remove another operation

better implementation of shortcircuiting and/or to avoid useless push/pop

