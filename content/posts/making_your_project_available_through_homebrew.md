+++
title = 'Making your project available through Homebrew'
date = 2022-09-12T11:47:37+02:00
draft = false
tags = ['brew', 'tooling', 'productivity']
categories = []
+++

As software developers, having our projects available easily to anyone is a goal, but it can be hard to achieve. Using package managers like `apt`, `pacman` or `brew` has become an industry standard (compared to wget + compile it yourself + install it), but publishing a project on it can be quite tedious.

In this article, we will go through the basics of creating a tap for homebrew (available on both Linux and MacOS).

## Creating a tap

A tap is an external source of formulae (installation scripts) for homebrew. Using them requires to add them with `brew tap user/repo`. It is much easier than submitting a new formula to homebrew/core and waiting for it be approved (or rejected).

Creating a new tap is as easy as
```shell
# creates a folder under /opt/homebrew/Library/Taps/xxx/xxx
brew tap-new arkscript-lang/homebrew-arkscript

# generates a formula in your newly created tap
brew create --cmake \
    'https://github.com/ArkScript-lang/Ark.git' \
    --HEAD \
    --set-name 'arkscript@3.3.0' \
    --set-version '3.3.0' \
    --tap arkscript-lang/homebrew-arkscript
```

I specified the type of build needed with `--cmake` (other templates are available for crystal, go, meson, python, node, ruby, perl and rust), the URL of my git repository (`--HEAD` is here to tell brew that the URL is a repo, not a file). With `set-name` I gave the formula's name, and then its version with `set-version`. Finally, with `tap` I gave it a repository (the user and repo name will have to match on GitHub/GitLab/etc).

## Editing your formula

Once this last command has been entered you will be entering your selected editor (for me it's vim) to edit the formula:

```ruby
# Documentation: https://docs.brew.sh/Formula-Cookbook
#                https://rubydoc.brew.sh/Formula
# PLEASE REMOVE ALL GENERATED COMMENTS BEFORE SUBMITTING YOUR PULL REQUEST!
class ArkscriptAT330 < Formula
  desc ""
  homepage ""
  license ""
  head "https://github.com/ArkScript-lang/Ark.git"

  depends_on "cmake" => :build

  def install
    # ENV.deparallelize  # if your formula fails when building in parallel
    system "cmake", "-S", ".", "-B", "build", *std_cmake_args
    system "cmake", "--build", "build"
    system "cmake", "--install", "build"
  end

  test do
    # `test do` will create, run in and delete a temporary directory.
    #
    # This test will fail and we won't accept that! For Homebrew/homebrew-core
    # this will need to be a test that verifies the functionality of the
    # software. Run the test with `brew test arkscript@3.3.0`. Options passed
    # to `brew install` such as `--HEAD` also need to be provided to `brew test`.
    #
    # The installed folder is not in the path, so use the entire path to any
    # executables being tested: `system "#{bin}/program", "do", "something"`.
    system "false"
  end
end
```

Note that because we used `--HEAD` this formula will only work with `brew install --head`. To remedy this, we will add an `url`:

```ruby
class ArkscriptAT330 < Formula
  desc ""
  homepage ""
  url "https://github.com/ArkScript-lang/Ark.git", tag: "v3.3.0"
  license ""
  head "https://github.com/ArkScript-lang/Ark.git"
```

It has to go right before the license field, which itself has to follow the SPDX license naming convention (https://spdx.org/licenses/), eg `MPL-2.0`.

## Custom steps

Once every field has been filled, and default comments have been removed, we can play a little more with the formula's steps.

For testing, I added a `post_install` step:

```ruby
class ArkscriptAT330 < Formula
  # ...

  def post_install
    ohai "ℹ️  Add ARKSCRIPT_PATH=" + lib + "/Ark/ to your bashrc/zshrc"
  end

  # ...
```

This basically tells the user to add an environment variable to their shell configuration file for the project to work with `ohai` (prints a message). There is `odie` as well to display an error message and `opoo` for warnings. You can find more steps and fields to customize your formula here: https://rubydoc.brew.sh/Formula.html.

## Checking for errors

Now that you have written a formula, let's test it with

```shell
brew audit --new arkscript@3.3.0
```

If it returns nothing, then you are good to go and you can publish your tap.

You should build your formula to check for misconfiguration and errors using

```shell
brew install --build-from-source <user>/<repo>/<formula>
```

If you need to do the test again, just do a `brew remove <formula>`.

## Publishing a tap

First, you will have to create a repository on GitHub/GitLab if that wasn't already done, with the following name: `homebrew-<tap name>`. The prefix is mandatory.

Then, you can add a remote to your tap with

```shell
git remote add origin git@github.com:<user>/<repo>.git
```

Commit your work, and you can now push to your repository and voilà!

## Using your tap

Using `brew tap <user>/<repo>`, you will add your tap to brew list of taps. Then your formulae will be available either as `brew install <formula>` or `brew install <user>/<repo>/<formula>` if the name is already taken in homebrew core.

## Going further

Now that you have published your formula in a tap, and made your project easily available to anyone, you might want to go further and check this complete guide: https://docs.brew.sh/Formula-Cookbook

