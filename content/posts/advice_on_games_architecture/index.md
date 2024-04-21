+++
title = 'Advice on games architecture'
date = 2021-04-22T23:02:10+02:00
draft = false
keywords = ['gamedev', 'architecture']
+++

In this article, I will try to highlight important things when developping your own games, according to me.

# The importance of a clean code

I started programming game at a very young age, in C with the [SDL](https://www.libsdl.org/), and I have to say that my code got messy very quickly. Functions with hundreds of lines, structures handling too many different things... which ultimately led to poor bug tracking, memory leaks and in the end another unfinished project.

Learning as soon as possible to divide your code into small functions, each doing one and only one single task, putting your related data into the same structure for efficient memory access, will save you a lot of time when debugging, and ultimately will help you when enhancing your games.

## Re-using code

The importance of re-usable code is that you won't have to reinvent the wheel for common problems. Instead of having 10 functions reading configuration files, each one taking different parts of the file, you could have a single function loading the file and returning a map `String -> Value`, which will be used by the other functions.

This way, if you want to change the type of configuration file you use, let's say from JSON to CSV, you only have a single function to update: your maintenance cost will be lower and you will have more time to spend on more important part of your project.

## Dividing into scenes

Very often when I start working on a new game, I just put everything in the `main()` function:
* the game loop
* the update process
* the rendering
* ...

And it gets quickly bulky and hard to manage.

I quickly came up with a known pattern: a game manager with scenes (I'm talking in OOP).

The idea is to have an Application class, in charge of:
* running the game loop
* updating the current scene (and maybe GUI)
* rendering the current scene (and maybe GUI)
* handling the events

It could look like this (C++):

```cpp
class Application
{
public:
	template <typename S, typename... Args>
	void add_scene(Args&&... args)
	{
		m_scenes.push_back(
			std::make_unique<S>(std::forward<Args>(args)...)
		);
	}
	
	void render()
	{
		// GUI specific
		// ...
		m_scenes[m_current]->render(m_screen);
	}
	
	void update(float delta_time)
	{
		// GUI specific
		// ...
		m_scenes[m_current]->update(delta_time);
	}
	
	void run()
	{
		while (m_screen.isOpen())
		{
			float dt = getTimeSinceLastFrame();
			
			if (auto event = getEvent(); event)
			{
				// handle App specifics
				// ...
				m_scenes[m_current]->handle_event(event);
			}
			
			update(dt);
			render();
			m_screen.flip();
		}
	}

private:
	std::vector<std::unique_ptr<Scene>> m_scenes;
	std::size_t m_current;
};
```

The idea is to have a global entity controlling every scene, allowing easy transition between a `MenuScene` and a `OverWorldScene`, a `BattleScene`...

This way, the code related to the menu stays in an entity devoted to this and *only* this, making code updates easier: we know that the menu related code will be there and not anywhere else.

## Scene graph and animations system

Animated sprites are very common in games, and I often find myself writing an animator for them. I found that the best way of doing this is having a scene graph, where every entity is a node of this graph (my scenes are nodes, themselves having children). Thus an animated sprite is a node as well.

An animated sprite would be a collection of predefined sprites, with a given delta time between each of its frames. This implies that, the animation being a node of the scene graph, a node needs an `update(delta_time)` and a `render(surface)` method!  
We could even take it further and add states to the animated sprites (which I often do), to have a single entity managing all the animations for, let's say, your player: when running, walking, crouching...

![Example of a scene graph](/scene_graph.png)
*Source: [jmonkeyengine wiki](https://wiki.jmonkeyengine.org/docs/3.3/core/scene/spatial.html)*

Of course, the order of the children of a given node in the scene graph is important, here we would draw the character and its weapon on the front, then the house, then the other NPCs, and finally the terrain.

But a scene graph can be even more powerful, you can have a GUI being a node of your graph as well as a sprite, animated or not, a background image, a text...

## An easy way to represent actions

It's something I learnt about recently, and it drastically changed the way I was creating my games. It's called the command pattern: everything you can do *is* an action.

Opening a door? An action.  
Attacking an ennemy? An action.  
Burning the floor with a spell? Also an action.  
Healing your character? Still an action.

And you can even extend it to NPCs: a monster attacking you will create an `AttackAction(source, target, damage)`, in charge of handling the attack (if it's possible, ie the target has HP, if it misses, its crit chance...).

Every entity that can "act" would return a polymorphic `Action` class, may it be a `MoveAction`, `AttackAction`, or even `UseObjectAction`, and the application will receive the actions and run them if they met some requirements for example.

The idea is explained by Bob Nystrom in ["Is There More to Game Architecture than ECS?"](https://youtu.be/JxI3Eu5DPwE?t=965).

*Note*: I implemented this pattern [here](https://github.com/SuperFola/pataro/tree/master/include/Pataro/Actions), and they are executed [here](https://github.com/SuperFola/pataro/blob/master/src/Pataro/Map/Level.cpp#L162-L175).

# Conclusion

If you wish to take this subject a bit further, I advise you to read ["Game Programming Pattern"](https://gameprogrammingpatterns.com) by Bob Nystrom!

