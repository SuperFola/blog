+++
title = 'Publishing ZIP artifacts with SBT'
date = 2025-03-21T15:42:45+02:00
tags = ['scala', 'sbt']
categories = []
+++

[In my previous article about Scala]({{< ref "/posts/generating_swaggers_at_compile_time.md" >}}), I briefly mentionned we were publishing Swaggers inside JARs, that we could unzip to retrieve the Swagger definition and then run our code generation. It works, but using ZIPs would feel better and less confusing for users.

I have decided to nerd snip myself and see how I could publish a ZIP using SBT, and then use said ZIP as a dependency for [sbt-swaggerinator](https://github.com/SuperFola/sbt-swaggerinator).

## sbt-native-packager to the rescue

I quickly noticed that sbt-native-packager could [output ZIPs](https://www.scala-sbt.org/sbt-native-packager/formats/universal.html#build), which was very helpful as we are already using it for bundling JARs and creating Docker images.

With this basic SBT configuration, you can publish a ZIP:

```scala
lazy val publishZipSettings = Seq(
  publishTo := "https://my-maven-repository",
  publishConfiguration := publishConfiguration.value.withOverwrite(true),
  Universal / mappings ++= contentOf(sourceDirectory.value / "main" / "resources"),
  publish := (publish dependsOn (Universal / packageBin)).value,
  publishLocal := (publishLocal dependsOn (Universal / packageBin)).value,
) ++ makeDeploymentSettings(Universal, Universal / packageBin, "zip")

lazy val `my-api-swagger` = (project in file("modules/my-api-swagger"))
  .enablePlugins(UniversalPlugin)
  .enablePlugins(UniversalDeployPlugin)
  .settings(publishZipSettings)
```

- Line 4 is quite important ; at first I wrote `Universal / mappings += (Compile / packageBin).value -> "swagger.yaml"`, as per the docs, not really knowing what I was doing. It seems that it worked, but it is actually **putting the JAR in the ZIP as a file named swagger.yaml**, which isn't ideal if you ask me. Since we generate the Swagger files under the `resources/` folder, using `contentOf` is good enough.
- Lines 5 and 6 aren't strictly necessary, just useful to be able to generate the ZIP file in a single command: `sbt "my-api-swagger / publish"`.

Problems:

1. Publishing works as expected, but we have problems when trying to retrieve the ZIP for the Maven repository: SBT is looking for a POM file which isn't generated! Great, we can push artifacts but not retrieve them.
2. Apparently we need to generate POM files, which we do not have.
3. The module is published with a `_2.13` suffix at the end, even though it doesn't depend on any particular Scala version.

## Using SBT artifacts

We can tell SBT that we are [publishing an artifact](https://www.scala-sbt.org/1.x/docs/Artifacts.html), that might help us. At first, I thought we had to publish a module, eg `my-api`, with an attached artifact named `my-api-swagger` ; not really what I was looking for but let's try this anyway.

It turns out that creating a project with a single artifact correctly configured was a thing: an artifact is just what SBT is publishing (by default: the binary JAR, docs etc). And we can disable JAR publishing, as well as docs, since we don't need them!

New settings:

```diff
 lazy val publishZipSettings = Seq(
   publishTo := "https://my-maven-repository",
   publishConfiguration := publishConfiguration.value.withOverwrite(true),
   Universal / mappings ++= contentOf(sourceDirectory.value / "main" / "resources"),
+  Compile / packageBin / publishArtifact := false,
+  Compile / packageDoc / publishArtifact := false,
   publish := (publish dependsOn (Universal / packageBin)).value,
   publishLocal := (publishLocal dependsOn (Universal / packageBin)).value,
+  crossPaths := false,
 ) ++ makeDeploymentSettings(Universal, Universal / packageBin, "zip")

 lazy val `my-api-swagger` = (project in file("modules/my-api-swagger"))
   .enablePlugins(UniversalPlugin)
   .enablePlugins(UniversalDeployPlugin)
   .settings(publishZipSettings)
+  .settings(addArtifact(Artifact("my-api-swagger", "zip", "zip"), Universal / packageBin))
```

With those additions, we can:

- avoid publishing a `jars/` folder (line 5) ;
- avoid publishing a `docs/` folder (line 6) ;
- avoid the `_2.13` suffix (line 9) ;
- generate POM and ivy.xml files for SBT ;
- keep publishing a ZIP under the `zips/` folder (line 16).

It's still a bit verbose, and I would have liked to be able to add the `addArtifact(...)` setting inside the `publishZipSettings`, deducing the artifact name from the module ; alas we need to rely on a setting (`projectID.value.name`), and you can only use `.value` on settings inside other settings or macros. That leaves room for improvements, but for now, it's good enough!

