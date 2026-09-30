+++
title = 'macOS 27 causing C++ linker errors'
date = 2026-09-16T18:28:00+02:00
tags = ['macos', 'cpp', 'knowledge base']
+++

macOS 27 Golden Gate has just been released, and I updated perhasp a bit too quickly. All I wanted was to see if I could
still compile my C++ projects, and what needed to be changed to run on the new OS version.

<!--more-->

## Linker error

I'm now getting hit by a linker error, that will block CMake from configuring a project and building it:

```text
ld: warning: ignoring file /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/libSystem.tbd, malformed file
/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/libSystem.tbd:4:20: error: unknown architecture
                   arm64e.x1-macos, arm64e.x1-maccatalyst ]
                   ^~~~~~~~~~~~~~~

ld: warning: ignoring file /Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/libm.tbd, malformed file
/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/lib/libm.tbd:4:20: error: unknown architecture
                   arm64e.x1-macos, arm64e.x1-maccatalyst ]
                   ^~~~~~~~~~~~~~~
```

## Workaround

```bash
export SDKROOT=/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk/
```

and after having accepted XCode license with `sudo xcodebuild -license`:

```bash
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

To check that `clang` is now on the correct version, run `clang -v`, it now returns:

```text
Apple clang version 21.0.0 (clang-2100.3.34.2)
Target: arm64-apple-darwin27.0.0
Thread model: posix
InstalledDir: /Library/Developer/CommandLineTools/usr/bin
```

while it used to return:

```text
Apple clang version 17.0.0 (clang-1700.6.4.2)
Target: arm64-apple-darwin27.0.0
Thread model: posix
InstalledDir: /Applications/Xcode.app/Contents/Developer/Toolchains/XcodeDefault.xctoolchain/usr/bin
```

