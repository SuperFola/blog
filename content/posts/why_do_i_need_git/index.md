+++
title = 'Why do I need git?'
date = 2020-04-08T22:57:17+02:00
draft = false
tags = ['git', 'beginners']
image = '/git_log.png'
+++

Nowadays, we have code everywhere. We need to patch bugs, find how and why a bug was introduced to fix it, find when a functionality was added and by who, thus we need what is called "version control".

Version control is a bunch of things to solve the problem stated above:
* handling a bunch of small changes (= **commit**)
* commits are signed to know who made them, thus who made the changes listed by a commit
* handling different version of the same code (= **branches**) at the same time
* ability to take 2 branches, compare them, and assemble them together (= **merging** branches)
* ability to create your own copy (= **forking**) of a collection of files (= **repository**) to modify your copy and suggest changes (= make a **pull request**)

And `git` is a tool to do all those things! Awesome, isn't it?

## Glossary

**commit**: we can see it as a list of changes made to a project ; for example a line in this index would be: `file which had been modified`, `lines of the file changed`, `new content for each line`

**branch**: a collection of commits, ordered by their *date of birth*

**repository**: a `git` repository is a collection of branches, resulting in a collection of files (your project's files)

**merging**: when we take two branches, thus two collections of commits, and we put it in a single branch: we are merging changes made on a branch A with the changes made on branch B

**forking**: starting from an existing repository hosted on the internet, we copy it to our account, to change it without affecting the original repository

**pull request**: after having created your own branch or after having forked a repository, you made some changes to the project, and ask the maintainer to merge your changes with their changes

## How do I use `git`?

*Nota bene*: this post will only cover the basic usage of `git` through the command line

*Requirements*:
* how to launch a terminal
* basic usage of a terminal (moving between folders, executing commands)
* `git` is installed (if not: https://git-scm.com/)

### Initializing a repository on your computer

First thing we want to do is to create a repository on your computer to register your changes to your project through commits.

We can do that using the command `git init` in a terminal, it will create a `.git` folder which you won't have to touch, `git` will do everything (storing commits, branches names and much more) in this folder. Thus we **don't want** to delete this folder!

Next thing is to add a `.gitignore` file to your project: it will list all the files that shouldn't be committed (such as build outputs, private keys...).

Example of a `.gitignore`:

```
build/
my-private-key.priv

# this is a comment

# here we want to exclude all the .o files, we don't want to commit those files
# since users can generate them themselves using cmake, make or whatever
*.o
```

### Creating your first commit

To create a commit, we need to add files to it, since a commit is collection of changes made to file, it needs to know which files to look at.

We can use

```
git add <myfile> <otherfile> <a/nice/file.txt>
```

to add specific files, or

```
git add .
```

to add all the files in the current directory and sub-directories.

Then we create a commit with those files with

```
git commit -m "a nice commit message here"
```

The `-m` is for `message`.

### Checking which files were updated since last commit

It's useful to know which files have been modified when you have been working for hours on a problem, to know which files to commit.

The command is

```
git status
```

giving a pretty verbose output:

```
On branch master
Your branch is up to date with 'origin/master'.

Changes not staged for commit:
  (use "git add ..." to update what will be committed)
  (use "git checkout -- <file>..." to discard changes in working directory)

        modified:   CHANGELOG.md

no changes added to commit (use "git add" and/or "git commit -a")
```

To show a shorter output, we can use the `-s` option (stands for short) along with `-b` (show branch information), like so:

```
git status -sb
```

giving a better output:

```
## master...origin/master
 M CHANGELOG.md
```

### Listing your last commits

To list commits with their message and date, we use

```
git log
```

Commits are listed from the most recent to the oldest one.

Example output:

```
commit c7d20ab1c669f2d177c4bf826bebe95ceb758270 (HEAD -> master, tag: 0.0.2, origin/master)
Date:   Tue Apr 7 11:54:36 2020 +0200

    updating gitignore

commit e18d52a2403a8310cb00b123b087d2d60716900b
Author: Name <my email here>
Date:   Mon Apr 6 17:13:47 2020 +0200

    adding examples/Tilemap
```

A shorter version without the dates is available by using

```
git log --oneline
```

to quickly see a list of changes made to a project (here we can see the importance of making good commit messages, to sum up the changes made). Example output:

```
c7d20ab (HEAD -> master, tag: 0.0.2, origin/master) updating gitignore
e18d52a adding examples/Tilemap
cc6457a adding a tilemap
8f3b747 updating profiler
58cc268 adding an imgui flamegraph widget
b3f0c6e updating All.hpp
```

Another one to show a pretty graph with branches (thanks Drarig29):

```
git log --all --decorate --oneline --graph
```

![git log with pretty branches graph output](/git_log.png)

### Pushing your local repository to a remote one

Once we have made a few commits, we would like to host them on a repository, such as on GitHub or GitLab. You will need to have an account on one of those website, and create a repository on your account.

![Creating a new repository on GitHub](https://help.github.com/assets/images/help/repository/repo-create.png)

Once this is done, we need to add a *remote* to our local git repository, to tell git that we have a remote location where we want to push our code. On GitHub, an HTTP remote looks like this `https://github.com//.git`. We can add it to git by using

```
git remote add origin https://github.com/<username>/<repository name>.git
```

By doing so, we add a remote named *origin* to our local git repository. Then we have to tell git that we want to push our current branch (the *default* one, named `master` by default) on this remote:

```
git remote -u origin master
```

The `-u` stands for `set upstream`, we are pushing our commits to the remote `origin`, and registering origin as the upstream for our branch `master`.

### Creating a new version of a project

Don't start over! You can easily reuse your existing code by creating a *branch*.

If you remember correctly, a branch is just a collection of commits, thus a *version* of a repository since we can recreate a repository by reading all the commits.

This means that we can create a new version of a project by creating a new branch, like so:

```
git checkout -b the_name_of_my_branch
# or using switch:
git switch -c the_name_of_my_branch
```

The branch name can not have any whitespace in it. This command will create the new branch (the `-b` stands for *create a new branch*), and automatically move you to this branch. If you want to go back to another branch to retrieve code, you can do:

```
git checkout my_branch
# with switch:
git switch my_branch
```

Using `git switch` you can even jump between you current and last branch:

```
# current branch: feature

git switch master
# -> current branch: master

git switch -
# -> current branch: feature
```

### Updating your main branch with code added on another branch

Let's say you have a `master` *branch* for your project, where the stable and tested code lies. You might create a `feature/login` *branch* to develop the login / logout feature, test it on its own, before adding this code in your `master` *branch*. As said earlier, this process is called merging.

There are multiple ways to merge a *branch* into another:
1. creating a *pull request* (on GitHub) or a *merge request* (on GitLab) between `feature/login` and `master`
2. using the command line:
    1. `git switch master ; git merge feature/login`: this will *merge* the *commits* from `feature/login` into `master`, creating a *merge commit* to indicate a merge occurred
    2. `git switch master ; git rebase feature/login`: this will *rebase* the *commits* from `feature/login` into `master`, reapplying them one after another (the *commit hashes* will change due to this, that's not a problem at all). You might get conflicts, then you will have to solve them and edit the commits as they come to solve the conflicts. No *merge commit* will be created

## Understanding GitHub/GitLab vocabulary

An *issue* is a discussion thread about a problem/idea/question an user has with your code.

*Forking* a repository results in copying the repository to your account, to modify it on your own.

A *pull request* is made by someone who *forked* your repository, modified it, and ask you to pull their modifications to your repository, to update it with their changes. Really useful when it comes to team work: someone can work on the game engine, someone else on the network plugin, and they make pull requests to the main repository to update it when they need it. Thus, nobody is bothering anyone.

*Merging* is the action of taking two versions of a repository, comparing the changes listed in each commit and checking if it is possible to unite the commits history (understand: their isn't collision in commit history). It's often the result of a pull request when it's accepted.

--------

Hopefully this article has helped you understanding git, feel free to comment if you need clarification!

