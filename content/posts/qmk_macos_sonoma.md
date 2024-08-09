+++
title = 'Enabling caps word in my Vial firmware on MacOS Sonoma'
date = 2024-08-08T23:46:47+02:00
draft = false
tags = ['keyboard', 'qmk', 'macos']
+++

Just tonight, I wanted to add support for `caps word` to my [keyboard](https://github.com/SuperFola/arkenswoop), but it needed an update to its qmk firmware. "No problem" I thought to myself, I already did this a lot in the past, what could go wrong? Well, everything.

## Dependencies, compilers, versions and brew

I had QMK 1.1.1 when I first compiled my arkenswoop firmware, but in the mean time I ran `brew install xyz` several times. If you know anything about brew, it is probably that it updates all your packages before installing anything by default. Well, of course, it had to update QMK to `1.1.5_1` and several other components like Python (on my Mac M1, I can't use Python > 3.11 with vial/qmk due to syntax errors) and a gcc toolchain we’ll talk about later.

I forgot to mention that I was using vial-qmk and not raw qmk, which I installed as follows:

```shell
brew install qmk/qmk/qmk
qmk setup -H ~/vial-qmk
```

vial-qmk is a fork of qmk adding support for updating your keymap interactively through a gui, allowing you to save and load keymaps quickly, which I love because it works through your browser too, so I can update my keymap at work, even on a laptop with no admin rights where I can't install anything.

As far as I know, it is a Python GUI and a collection of scripts to make your firmware and bundle it with your keymap serialized in JSON.

### Fixing Python

So I went ahead and tried to fix my Python installation, so that I could run the commands to build my firmware with vial.

No easy way to do this except with an additional command (or risking breaking your system by downgrading the system python), `pyenv`. I installed it with `brew install pyenv`, and set it up in my `~/.zshrc`:

```shell
if command -v pyenv >/dev/null; then
    export PYENV_ROOT=$HOME/.pyenv
    [[ -d $PYENV_ROOT/bin ]] && export PATH="$PYENV_ROOT/bin:$PATH"
    eval "$(pyenv init --path)"
fi
```

But then I discovered when running `pyenv versions` that it could list only versions it installed, or the system one! So I had to uninstall nearly all my brew python versions (except for 3.11 and 3.12, because why not keep the most recent ones just in case) installed through brew, and install python 3.8 with pyenv: `pyenv install 3.8`. Then make it the default with `pyenv local 3.8` in the vial-qmk folder.

### Fixing my toolchain...?

Now I could run `make arkenswoop:vial:flash` without Python errors blocking the compilation process, but then, avr-gcc screwed up? An error very similar to this one, down to the compiler version (apart from the keyboard name) popped up:

```
Copyright (C) 2023 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

Compiling: .build/obj_lily58_rev1_via/src/default_keyboard.c                                       In file included from ./lib/pico-sdk/src/common/pico_base/include/pico/types.h:12,
                 from ./lib/pico-sdk/src/common/pico_base/include/pico.h:24,
                 from ./lib/pico-sdk/src/rp2_common/hardware_flash/include/hardware/flash.h:10,
                 from ./platforms/chibios/drivers/wear_leveling/wear_leveling_rp2040_flash_config.h:6,
                 from <command-line>:
./lib/pico-sdk/src/common/pico_base/include/pico/assert.h:18:10: fatal error: assert.h: No such file or directory
   18 | #include <assert.h>
      |          ^~~~~~~~~~
compilation terminated.
 [ERRORS]
 |
 |
 |
gmake[1]: *** [builddefs/common_rules.mk:361: .build/obj_lily58_rev1_via/.build/obj_lily58_rev1_via/src/default_keyboard.o] Error 1
gmake: *** [Makefile:392: lily58/rev1:via] Error 1
Make finished with errors
```

But I had a toolchain, see brew search results:

```
brew search avr-gcc
==> Formulae
osx-cross/avr/avr-gcc@10             osx-cross/avr/avr-gcc@13             osx-cross/avr/avr-gcc@8 ✔
osx-cross/avr/avr-gcc@11             osx-cross/avr/avr-gcc@14             osx-cross/avr/avr-gcc@9
osx-cross/avr/avr-gcc@12             osx-cross/avr/avr-gcc@5              osx-cross/avr/avr-gdb

brew search arm-none-eabi
==> Formulae
arm-none-eabi-binutils ✔                                osx-cross/arm/arm-none-eabi-binutils ✔
arm-none-eabi-gcc                                       osx-cross/arm/arm-none-eabi-gcc@8 ✔
arm-none-eabi-gdb                                       osx-cross/arm/arm-none-eabi-gcc@9
```

And it did seem like a PATH problem at first, so I tried adding all sort of LDFLAGS and PATH modifications, to no avail.

### Resorting to Google... page 2

The solution lies on a [japanese website](https://web.archive.org/web/20240808220242/https://zenn.dev/ynkt/scraps/18e2c698eacfdc) which I didn't translate, I just went through and copied commands (**don't do this!** It could have ended really badly) because they showed the same error I had and I somewhat understood the commands and probably what was going on.

I first read this command output, which shows that they had the same arm-none-eabi-gcc version as I have, and the same error:

```
$ qmk compile -kb aki27/cocot46plus -km rp2040
Ψ Compiling keymap with gmake -r -R -f builddefs/build_keyboard.mk -s KEYBOARD=aki27/cocot46plus KEYMAP=rp2040 KEYBOARD_FILESAFE=aki27_cocot46plus TARGET=aki27_cocot46plus_rp2040 INTERMEDIATE_OUTPUT=.build/obj_aki27_cocot46plus_rp2040 VERBOSE=false COLOR=true SILENT=false QMK_BIN="qmk"


arm-none-eabi-gcc (GCC) 14.1.0
Copyright (C) 2024 Free Software Foundation, Inc.
This is free software; see the source for copying conditions.  There is NO
warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

Generating: .build/obj_aki27_cocot46plus_rp2040/src/info_config.h                                   [OK]
Generating: .build/obj_aki27_cocot46plus_rp2040/src/default_keyboard.c                              [OK]
Generating: .build/obj_aki27_cocot46plus_rp2040/src/default_keyboard.h                              [OK]
Compiling: keyboards/aki27/cocot46plus/matrix.c                                                    In file included from ./lib/pico-sdk/src/common/pico_base/include/pico/types.h:12,
                 from ./lib/pico-sdk/src/common/pico_base/include/pico.h:24,
                 from ./lib/pico-sdk/src/rp2_common/hardware_flash/include/hardware/flash.h:10,
                 from ./platforms/chibios/drivers/wear_leveling/wear_leveling_rp2040_flash_config.h:6,
                 from <command-line>:
./lib/pico-sdk/src/common/pico_base/include/pico/assert.h:18:10: fatal error: assert.h: No such file or directory
   18 | #include <assert.h>
      |          ^~~~~~~~~~
compilation terminated.
 [ERRORS]
 |
 |
 |
gmake: *** [builddefs/common_rules.mk:373: .build/obj_aki27_cocot46plus_rp2040/matrix.o] Error 1
```

### The solution

The next message suggested the following commands:

```shell
brew uninstall arm-none-eabi-gcc
brew install --cask gcc-arm-embedded
```

Which solved my problem, and hopefully solves yours too if you're here!

Alas, it seems it wasn't enough for the original poster, I hope they found the solution to their particular problem. Reading the next messages, it seems that it could be related to errors / updates in their matrix definition.

## Finally, adding caps word to my firmware

I just wanted to be able to press my "double shift" combo (pressing `S`+`L` simultaneously, which are my two *tap/hold* shift keys, triggers caps lock on my keyboard) to trigger caps word and not caps lock, so that I could do **caps words**, write a sql command eg `SELECT`, then press any "non word" character like `space` or `comma` and exit the caps lock without pressing my combo again. Yes, I'm quite lazy, but one less keypress is like one second saved in my day!

To enable caps word in vial, all I had to do was to add `CAPS_WORD_ENABLE = yes` to my root `rules.mk`, recompile the firmware, and use the `ANY` key with the keycode `0x7c73` ([thanks to xyzz for this trick!](https://github.com/vial-kb/vial-qmk/discussions/629)).


