+++
title = 'Function calls in bytecode interpreters'
date = 2021-05-10T23:02:10+02:00
draft = false
keywords = ['bytecode', 'vm', 'pldev']
+++

[In the previous article]({{< ref "/posts/understanding_bytecode_interpreters" >}} "Understanding bytecode interpreters"), we discussed the global idea behind a bytecode interpreter, and explained the concept of a stack and how the instructions could be represented. Now we will dive a bit more in *tables* and *call stack*.

# Tables?

As we saw in the previous article, we need a way to keep track of symbols' identifiers, to refer to them using a fixed size number instead of a variable size string.

Now, one could wonder why are we keeping the variables' names, instead of using only the identifiers. The two possibilities would work, however, our first approach (keeping the names) will come in handy when debugging our programs: we will be able to give names to the numbers.

## Values' table

We introduced a table to keep track of the variables' names, so that we could refer to variables by using a single fixed length number in our bytecode. The same should apply to values if we want to be able to handle more than unsigned numbers, currently used to refer to variables' identifiers. Remember our bytecode example:

```
\x01 \x00\x05   ->   PUSH 0x0005
\x01 \x00\x04   ->   PUSH 0x0004
\x02            ->   EQ
\x03 \x00\x0f   ->   POP_JUMP_IF_TRUE 0x000f
```

The argument after the `PUSH` instruction is the same kind of number as the one after `POP_JUMP_IF_TRUE`, even though they should have entirely different types, one being a number, the other being a *bytecode address* (where we should jump). If we were to have 8 bytes long numbers, we would have to put every instruction's arguments on 8 bytes as well! While this is doable, we would create very huge bytecode files: who on Earth will need to jump to an absolute address being between 0 and 2^64-1 (that's more than a tera, and terabytes of RAM are not that common).

That's why choosing 2 bytes to store instructions' arguments isn't that silly: we can address at most 65'535 different variable's names, 65'535 values, and 65'535 instructions which is more than enough.

To come back to our original discussion, we can not have our values in the bytecode directly, because we would need to introduce two different numbers' types: instructions' arguments type as 2 bytes numbers, and our 8 bytes numbers. The same problem arise if we want to add strings.

Thus, we need to design a table to store each value encountered in the original program to refer to them by their identifier. The table of the previous code sample could look like this:

```
let a = 4 + 5 * 12
let foo = (a, b, c) {
    let d = a + b
    print(d - c, c)
    if (d > 0)
        return 2 * a + b * b - 4 * a * c
    else
        return 0
}
foo(a, 2 * a, 3 * a)
```

Type | Value | ID
-----|-------|----
0 (number) | 4 | 0
0 (number) | 5 | 1
0 (number) | 12 | 2
0 (number) | 0 | 3
0 (number) | 2 | 4
0 (number) | 3 | 5

Notice that even if a value was repeated in the program, we didn't duplicate it in the table. Also, we introduced a *type* column, even though we deal only with numbers here, that will come in handy when dealing with strings, functions, and more.

*Nota bene:* we could have the same discussion we had with `print`, about special values such as `true` and `false`, and give them fixed identifiers, like `0` and `1`, and make it so that every value identifier starts at 2. We won't do that here.

# Keeping track of variables

Now that we have a way to identify variables and load them, we need something to store them. There are multiple ways to achieve that, for example storing the variables on the stack (so they have a fixed offset on the stack and we can read/write them in O(1)). We could also add an extra structure, for example a list of lists, to keep a LIFO stack of scopes. The latter is what we're going to do here, since it's easier, and the first idea has drawbacks:
* to read a variable from a previous scope (useful in recursive functions), we need to crawl back to the top of the stack each time, a stack which can get pretty heavy on functions like Fibonacci function (recursive version)
* we need to add a special instruction to read global variables, to know when we're reading a variable on the stack in the current scope, or at the beginning of the stack

Our scopes will be kept in the following structure:
```python
class Scope:
	def __init__(self):
		self.data = []
		
	def insert(self, id_: int, value):
		self.data.append((id_, value))
		
	def get(self, id_: int):
		for (i, v) in self.data:
			if i == id_:
				return v
		raise RuntimeError(f"Trying to reference an undefined of id {id_} in the current scope")
		
	def __len__(self):
		return len(self.data)
```

Here we are just having our variables stored along their numeric identifier instead of their string identifier, because it takes less space and it's faster to create it (even though it wouldn't matter here since this code is Python).

Then our virtual machine will keep a `scopes: List[Scope] = [Scope()]` (with a default scope to store the globals), and when we call a function, we just add a new scope onto the list, and remove the top scope when we return from a function.

Our `LOAD_SYM` instruction will have to iterate in reverse order over the list of scopes, to read from the most recent scope to the least recent one, and our `STORE` instruction will just have to insert a new variable in the latest scope, i.e. the one on top of the scopes' stack.

# Calling a function

Now, we need a way to represent our functions easily in our bytecode.

Let's break this down: what is a function? It's a serie of instructions, like `print(a)`, `a += b` and `return 2`. It can take arguments, and can be called from anywhere through its name. It's not that much different from our global scope!

The idea now is to represent our functions as we do with our global scope: a serie of instructions. We'll need to add a new instruction `RET` to exit from a function (destroy the associated scope and jump to the caller bytecode address).

This assumes that we have to keep track of the caller bytecode address, to be able to get back to it. We have two solutions (maybe even more):
* add a new LIFO stack (another one) to keep track of all the bytecode addresses which called a function, until a `RET` is encountered and forces us to pop the most recent one to jump back to it
* use our already existing stack to store the previous address!

The latter is what we will go with in these articles. Since our stack stores values for our language, those values (numbers, strings, booleans...) must have a type. What if we added another type specific to bytecode address? This way, we can easily clear the stack of junk values when we met a `RET` and retrieve the latest bytecode address to go back to!

## Bytecode pages

We will divide our bytecode into pages, since a bytecode is a serie of instructions, or phrases, like a book. Some people also call that *bytecode chunks*. A page = a function, which the 0th one being for the global scope. This will ease function representation: we just need to know to which *page* we need to jump to.

In term of bytecode, we could have something like:

```
LOAD_CONST 1 (page number 2)
LOAD_CONST 2 (number 1)
LOAD_CONST 3 (number 0)
CALL 2
```

The `2` after `CALL` is here to tell the instruction that we are calling a function taking two arguments, located on our stack. This instructions will pop two values off the stack, to create the argument list of the function, and then pop another one to know where it should jump to in term of pages in the bytecode. It should go to page `n`, and put the *instruction pointer* at the beginning of said page, position 0.

We need to push our absolute address in the bytecode on the stack, so that we can get back there later.

Then, the `CALL` instruction will push the arguments it got, though, be careful with ordering: we popped them this way: [number 0, number 1] because it's a LIFO stack! The function's bytecode should start with `STORE 1 (symbol a), STORE 2 (symbol b)` if it was written like this: `function foo(a, b) { ... }`, it will get the values from the stack.

```
Original code calling foo(a=1, b=0):
	LOAD function foo
	LOAD number 1
	LOAD number 0
	CALL 2

Our stack:
	number 1
	number 0

The function:
	POP (number 1 was popped), STORE in a
	POP (number 0 was popped), STORE in b
	
	rest of the instructions...
	
	RET
```

## Recursivity?

Now you may wonder how we can implement recursivity. We already have what's needed to call a single function, but can it call itself?

Well, yes it can! Remember, we have a scoping system allowing us to search each scope for a value, the address of our function. And we have a single unique scope *per* function call. Thus a recursive function calling itself will create a pile of scopes, one per call!

So yes, *it just works* as it is.

A problem may arise, a performance related one: if we continue to put a new scope each time a recursive function calls itself, we will need more and more time to search our pile of scope for the address of our function. A simple trick is to register the function address in the new scope right when creating it (that can be done by the `CALL` instruction).

