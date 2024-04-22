+++
title = 'Starting a journey with cmake'
date = 2020-09-16T23:02:10+02:00
draft = false
tags = ['cmake', 'cpp', 'beginners']
+++

Very often, I have to help friends and colleagues to build a C or C++ project, and my solution is always the same: "use CMake!", but their documentation isn't pretty good so we have to spend a few hours on stackoverflow to get it to work for their specific use cases.

This blog post will try to provide basic CMake knowledge and how to produce a nice and working `CMakeLists.txt`.

# Introduction: what's CMake? Why should I use it?

CMake is called a project generator. It can generate `Makefile`s, Visual Studio projects, ninja files... In a nutshell it generates files used to compile a project.

It's awesome in a way because you only have a single `CMakeLists.txt` for your project, and then run `cmake` on this file to generate a project for the current platform. It means that we don't have to bother anymore with creating and maintaining a lot of build files to compile your code on Linux, Windows, MacOS and many more operating systems.

# Compiling some files into an executable/library

Let's go through a basic CMakeLists.txt:

```cmake
# using the latest version currently
cmake_minimum_required(VERSION 3.18)

# the name of our project is put as an argument of this command
project(project_name)

# configure file takes a file using CMake variables between @@
# and output another file with the defined values
# example in Constants.hpp.in: #define PROJECT_NAME "@PROJECT_NAME@"
configure_file(
    ${PROJECT_SOURCE_DIR}/include/${PROJECT_NAME}/Constants.hpp.in
    ${PROJECT_SOURCE_DIR}/include/${PROJECT_NAME}/Constants.hpp
)

# every header file from include/ or ext/ will be used like this:
# #include <lib/file.hpp>
# folder structure:
# ext/
#     lib/
#         file.hpp
include_directories(
    ${PROJECT_SOURCE_DIR}/ext  # ext libs
    ${PROJECT_SOURCE_DIR}/include  # includes for the project
)

# fetching all .cpp
file(GLOB_RECURSE SOURCE_FILES
    ${PROJECT_SOURCE_DIR}/src/*.cpp
  
    # add this if there are .c/.cpp to compile in the ext folder
    ${PROJECT_SOURCE_DIR}/ext/*.cpp
    ${PROJECT_SOURCE_DIR}/ext/*.c
)

# create an executable named after the project's name
# built from the source files we gathered previously
add_executable(${PROJECT_NAME} ${SOURCE_FILES})
# link external libraries, if any
target_link_libraries(${PROJECT_NAME} PUBLIC lib_name1 lib_name2)

# set target properties for C++ projects to use C++17
set_target_properties(
    ${PROJECT_NAME}
    PROPERTIES
        CXX_STANDARD 17
        CXX_STANDARD_REQUIRED ON
        CXX_EXTENSIONS OFF
)
```

Basically what it does is:
1. declares a project named `project_name`, name that will be available in CMake by using the variable `PROJECT_NAME`
1. configure a project file with CMake variables, useful to set parameters like the project's version, debug options
1. add every header file under include/ and ext/ to the includes path
1. list all the .cpp files of the project under src/ and all the .c/.cpp files from ext/
1. compile the project as an executable by using the list of source files we fetch
1. link libraries to our project (eg. opengl, X11, fs...)
1. set the project properties to request at least C++ 17

## Launching CMake and compiling

Now that we have a nice CMakeLists.txt, we need to tell CMake to use it:

```
cmake -Bbuild -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_COMPILER=g++-8
```

Here I gave the following options:
* `-Bbuild` to tell CMake to output its files into a `build/` folder
* `-DCMAKE_BUILD_TYPE` can take either `Debug` or `Release` with G++, and also `RelWithDebInfo` with MSVC, it's optional, default value is `Debug`. If you give this parameter one time and then re-run CMake, its value will be cached and re-used
* `-DCMAKE_CXX_COMPILER` is also optional, but might be useful if you have multiple compilers on your computer and want to use a specific one

Another useful option is `-G "generator name"` if you want to generate Ninja files, Unix makefile...  
My favorite on Windows is `-G "Visual Studio <version> Win64"` to force the generation of the 64 bits project.

Then we build a project by using

```
cmake --build build --config Debug
```

The `--build` option tells CMake where its generated files are, and the `--config` option tells CMake in which mode the project shall be generated (this is useful only with multi-target compilers like MSVC, which thus ignores `-DCMAKE_BUILD_TYPE`).

With multi-target compilers, the output files will be under `build/<config>/<project name>`, with single-target compilers like G++, under `build/<project name>`.

# Including a project B in a project A
*each with its own CMakeLists.txt*

When dealing with a large codebase, we often need to use external dependencies which already come with their own CMakeLists.txt. The goal is to make use of this power in a very lines to avoid rewriting everything.

```cmake
add_subdirectory("${PROJECT_SOURCE_DIR}/submodules/nice-cmake-project")

# ...
add_executable(${PROJECT_NAME} ${SOURCE_FILES})
target_link_libraries(${PROJECT_NAME} PUBLIC NiceCmakeProjectLib)
```

And we're done. Here what happens is that CMake will register the subdirectory as a separate CMake project (I assumed this project was generating a lib by using `add_library` instead of `add_executable`, name `NiceCmakeProjectLib`).

# Conclusion

A few tips before leaving:
* when adding new files to a project, you need to regenerate the CMake files by using the command `cmake -Bbuild`. The previous settings sent by using `-D<name>=<value>` are kept and re-used
* to change a previous CMake setting sent using `-D<name>=<value>`, just add `-D<name>=<new value>` again when regenerating CMake files
* if you have conflicts with external libraries when compiling, check if everything is compiled using the same set of instructions (32 bits or 64 bits)

