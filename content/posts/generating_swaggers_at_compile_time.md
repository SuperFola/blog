+++
title = 'Generating swaggers at compile time'
date = 2025-03-07T13:20:45+02:00
tags = ['scala', 'swaggers']
categories = []
+++

At work, we've been generating code from swaggers and publishing said generated code. Alas, this requires us to remember to generate the swagger(s), as well as fixing versions of libraries (which means you need to upgrade versions in the server, publish updated generated code, then update your client), see this examples from [eikek/sbt-openapi-schema](https://github.com/eikek/sbt-openapi-schema):

```scala
import com.github.eikek.sbt.openapi._

val CirceVersion = "0.14.1"
libraryDependencies ++= Seq(
  "io.circe" %% "circe-generic" % CirceVersion,
  "io.circe" %% "circe-parser"  % CirceVersion
)

openapiSpec := (Compile/resourceDirectory).value/"test.yml"
openapiTargetLanguage := Language.Scala
Compile/openapiScalaConfig := ScalaConfig()
    .withJson(ScalaJson.circeSemiauto)
    .addMapping(CustomMapping.forType({ case TypeDef("LocalDateTime", _) =>
      TypeDef("Timestamp", Imports("com.mypackage.Timestamp"))
    }))
    .addMapping(CustomMapping.forName({ case s => s + "Dto" }))

enablePlugins(OpenApiSchema)
```

## The problem

When defining endpoints, it's not uncommon to couple the endpoint and its implementation with a `.serverLogic`, meaning creating our endpoints relied on the implementation being available (need to instantiate the API, repositories to connect to databases, http clients...).

This made it harder than necessary to write our swaggers to disk:
- you needed to compile the app,
- run all the services (databases, kafka...),
- run the app,
- go to http://localhost:8080/swagger/

For the swagger to be generated and written to disk. Otherwise, generated code wouldn't be up to date, which is a problem. A very long procedure, not very convenient, that we used to do once in a while.

## Simple solution

We can generate swaggers using libraries like [tapir](https://github.com/softwaremill/tapir):

```scala
val swagger = OpenAPIDocsInterpreter()
  .toOpenAPI(
    tapirEndpoints,
    "my app",
    "v0.0.1"
  )
  .openapi("3.0.3")
  .toYaml

writeSwaggerToFile(swagger, pathToSwaggerFile)
```

Then we would just have to decouple our `Endpoint`s and their implementation (which made them `ServerEndpoint`s by the way, but you only need `Endpoint` to generate the OpenAPI spec).

```scala
// MyApiEndpoints.scala
class Endpoints {
  protected val booksListingEndpoint: PublicEndpoint[(BooksQuery, Limit, AuthToken), String, List[Book], Any] = 
    endpoint
      .get
      .in(("books" / path[String]("genre") / path[Int]("year")).mapTo[BooksQuery])
      .in(query[Limit]("limit").description("Maximum number of books to retrieve"))
      .in(header[AuthToken]("X-Auth-Token"))
      .errorOut(stringBody)
      .out(jsonBody[List[Book]])

  val plainEndpoints: List[AnyEndpoint] = List(booksListingEndpoint)
}
```

```scala
// MyApiRoutes.scala
class Routes(api: MyApiService) extends Endpoints {
  private val booksListing =
    booksListingEndpoint
      .serverLogic { case (booksQuery, limit, authToken) =>
        api.listBooks(authToken, booksQuery, limit)
      }

  val endpoints: List[ServerEndpoint[Fs2Streams[IO], IO]] = List(
    booksListing
  )
  val routes: HttpRoutes = Http4sServerInterpreter()
    .toRoutes(endpoints)
}
```

And then find a way to compile and run code calling `OpenAPIDocsInterpreter` with the `new Endpoints().plainEndpoints`. Easy right?

## Let's over engineer it

Splitting endpoints and server endpoints implementation is the right and easy thing to do, but we can go further. What if we could leverage our build system to generate a swagger for us each time we compile?

### Making a sbt plugin

[sbt](https://www.scala-sbt.org/) is the *de facto* build tool in Scala, hence I made a plugin to do the generating for us. A plugin can define a task, which you can then call inside the sbt shell as a command.

```scala
import sbt.Keys.*
import sbt.*

object SpecGen extends AutoPlugin {
  object autoImport {
    val Spec = config("spec").extend(Runtime)
    val specGenMain = settingKey[String]("Main class (FQDN) to run")
    val specGenArgs = settingKey[Seq[String]]("Arguments to pass to runner")
    val specGenMake = taskKey[Unit]("run code/resource generation from config")
  }

  import autoImport.*

  override def projectSettings: Seq[Def.Settings[?]] = inConfig(Spec)(Defaults.configSettings ++ Seq(
    specGenMain := "<user defined>",
    specGenArgs := Seq.empty,
    specGenMake := {
      val logger = streams.value.log
      val classPath = Attributed.data((Spec / fullClasspath).value)
      (Spec / runner).value.run(specGenMain.value, classPath, specGenArgs.value, logger).get
    }
  )) :+ (ivyConfigurations := overrideConfigs(Spec)(ivyConfigurations.value))
}
```

> [!TIP]
> This small implementation is the bare minimum to register a class, instantiate it, and run it via sbt.
> 
> To make our task run after `compile` we would have to make it return a `File` and add a resource generator: `Compile / resourceGenerators += (Spec / specGenMake).taskValue`.

This simple plugin can be enabled on projects as follows:

```scala
val `my-api` = (project in file("application/my-api"))
  .settings(...)
  .enablePlugins(SpecGen)
  .settings(
    Spec / specGenMain := "org.myapi.GenerateSwagger"
  )

// we need a project to be able to `publish` the swagger.
// GenerateSwagger would write to the <module>/src/resources/swagger.yaml
val `my-api-swagger` = project in file("modules/my-api-swagger")
```

And we just have to write a `GenerateSwagger` class that instanciate `Endpoints` and call `OpenAPIDocsInterpreter` on them, to write the resulting yaml to a file!

> [!NOTE]
> For now, this small implementation requires the user to run `Spec / specGenMake;compile` to have the swagger generated and code to be compiled, until I revisit it. For our needs it isn't a huge deal, as we generate and publish swaggers inside our CI/CD environement.

### Generating Scala code from a published swagger

How would you generate code from a swagger inside a jar downloaded by sbt?

Using [sbt-swaggerinator](https://github.com/SuperFola/sbt-swaggerinator), the swagger downloader and unpacker, it's quite easy! Add your swagger module as a dependency and let the plugin do the job:

```scala
// build.sbt
object Dependencies {
  lazy val swagger = "com.example" % "my-api-swagger_2.13" % "1.0.0"
  lazy val circe = Seq(
    "io.circe" % "circe-core",
    "io.circe" % "circe-generics",
    "io.circe" % "circe-generic-extras"
  ).map(_ %% "0.14.1")
}

lazy val `my-api-generated` = (project in file("modules/my-api-generated"))
  .enablePlugins(OpenApiSchema)
  .enablePlugins(SwaggerinatorSbt)
  .settings(swaggerinatorDependency := Dependencies.swagger)
  .settings(swaggerinatorPackage := Pkg("com.example.my-api.generated"))
  .settings(libraryDependencies ++= Dependencies.circe)

lazy val infrastructure = (project in file("modules/infrastructure"))
  // ...
  .dependsOn(`my-api-generated` % "compile->compile")
```

Passing the dependency to swaggerinator will let it access the swagger inside it, by unzipping the jar (after all, it's just a ZIP file with another extension). Then the plugin generates code from the swagger, by calling the `OpenApiSchema` plugin for us.

