+++
title = 'The beginning of my journey: making a rendering engine'
date = 2018-10-07T22:11:13+02:00
draft = false
keywords = ['gamedev', 'cpp']
+++

![](/cover_image.png)

*Nota Bene*: This serie of articles is mainly focused on my experience while making *Voksel*, a 3D game made in a Minecraft style, so I will only write about my opinion and how I solve the problems I met !

A month ago, I got this strange idea after having taught myself on OpenGL : What if I made my own rendering engine? It could be funny, and I could learn a lot ! That's how I started making [Zavtrak](https://gitlab.com/SuperFola/Zavtrak). Few days after, another idea hit me: what if I made my own version of Minecraft using this engine ? So that's how my journey started, on a sunny day of September !

I made a small ToDo to know where I was going :

* abstraction code for :
    * VAO, VBO, EBO
    * shaders
    * free fly camera
    * window creation

(my goal was, and still is, to create a 3D rendering library acting as a nearly 0 cost abstraction for OpenGL)

A VAO acts an array storing vertex (a collection of data per 3D point) attribute pointers, used by OpenGL when given a VBO (vertex buffer object, storing vertices) to know if it looking at a position, a color, a texture coordinate... in a given vertex.

An EBO (element buffer object) is an array storing indexes of vertices (stored in a given VBO) to "link" them :

```python
vertices = [
    # position      # color
    [0.0, 0.0, 0.0, 1.0, 0.5, 0.0],
    [0.0, 1.0, 0.0, 0.0, 0.5, 1.0],
    [1.0, 0.0, 0.0, 0.5, 1.0, 0.5]
]
elements = [
    0, 1, 2
]
```

defines a right-angle triangle (when giving the data to OpenGL). An EBO avoids repeting the same vertex multiple times, which can be pretty heavy when giving a lot of vertices to the GPU, by only defining the index of the element to use.

A shader is a small program (written in [GLSL](https://en.wikipedia.org/wiki/OpenGL_Shading_Language)) to tell OpenGL how to draw a single pixel, given a vertex.

My idea was to have something like this :

```cpp
auto shader = zk::Shader("shader.vert", "shader.frag");

zk::Vertices vertices({
    // positions         // colors
     0.5f, -0.5f, 0.0f,  1.0f, 0.0f, 0.0f,   // bottom right
    -0.5f, -0.5f, 0.0f,  0.0f, 1.0f, 0.0f,   // bottom left
     0.0f,  0.5f, 0.0f,  0.0f, 0.0f, 1.0f    // top 
});
zk::objects::VertexArray VAO;
zk::objects::VertexBuffer VBO;
// bind the Vertex Array Object first, then bind and set vertex buffer(s)
// and then configure vertex attributes(s).
VAO.bind();
VBO.setData(vertices);
zk::objects::setVertexAttrib(0, 3, 6, 0);
zk::objects::setVertexAttrib(1, 3, 6, 3);

shader.use();
// do drawing...

```

which is basically the same thing as [this](https://learnopengl.com/code_viewer_gh.php?code=src/1.getting_started/2.1.hello_triangle/hello_triangle.cpp) (without the window configuration and all, which you can find [here](https://gitlab.com/SuperFola/Zavtrak/blob/master/examples/hello_triangle.cpp)), a lot shorter and easier to understand, uh ?

The biggest problem I have now is that we must configure everything ourself (setting vertex attributes, and creating a VAO and a VBO, binding them...) (and I still didn't fix it, since I wanted to focus on the game and rewrite the engine later).

After writing a lot of [redundant code](https://gitlab.com/SuperFola/Zavtrak/blob/master/include/Zavtrak/common/events.hpp), I could start writing a small game with it (you can find my experimentations [here](https://gitlab.com/SuperFola/Zavtrak/tree/master/examples)). My biggest struggle when I started writing the game was the vertex attributes (as you can see on the cover image, I messed up my vertex attributes and OpenGL handled it as if everything was fine).

![GIF: everything is fine](https://media.giphy.com/media/z9AUvhAEiXOqA/giphy.gif)

This concludes the first article of this serie, which is more a "explain-me-the-plot" article than a "the-problems-of-writing-a-rendering-engine", but if you want to know my pros and cons of making your own, here they are :

Pros

* you control everything
* you can give it the interface you want (I mean, not graphically but programmatically)
* you understand how it works under the hood

Cons

* writing your own rendering engine is really hard (I made a very simple one since Zavtrak acts as an abstraction layer for OpenGL)
* it can take a lot of time (and headaches !)

----

I will now explain briefly the purpose of this video game I am making, *Voksel*.

As I said, it is a 3D exploration game made in a Minecraft style, where the player can explore a procedurally generated world made of [voxel](https://en.wikipedia.org/wiki/Voxel) (3D pixels). The goal behind this project is to create a game in the same spirit as [Proteus](http://twistedtreegames.com/proteus/): an audio-visual exploration game, but with something more: helping the players to relax.

----

P.S.: I wrote this article in one go, only keeping in mind "how could I introduce you to the problems we met when creating a game", so it can be quite disjointed, I am sorry about that

