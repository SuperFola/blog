+++
title = 'ArkScript - April 2025 update'
date = 2025-04-26T19:19:00+02:00
tags = []
categories = ['arkscript']
+++

Since the [last update post]({{< ref "/posts/arkscript_update_december_2024/index.md" >}}), there was a total of 89 commits, for 393 files changed, 5699 insertions, 1978 deletions. I mainly focused on test coverage, adding around a hundred tests on type checking errors.

automatically generating documentation for the instructions on the website, instead of describing each one by hand (which was very tedious when their value changed)
added interactive repl tests in the ci
added a bunch of rosetta code solutions
added random as a builtin
changing the serialization of numbers in the value table to be loss less (used to represent them as strings)
enable unity builds
quality of life update when using a hexeditor: the table start bytes are now 0xA* and the value type tags are 0xF*, making them standout more
small compiler optimization behind `LOAD_SYMBOL_BY_INDEX`, that required a bigger vm optimization: new way to store locals, on a contiguous stack (benchmarks??)
also added instruction source location tracking, enhancing runtime errors
finished the http module (client only, no more server!)
task tracker ref

