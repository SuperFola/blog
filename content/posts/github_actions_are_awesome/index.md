+++
title = 'GitHub actions are awesome'
date = 2021-06-08T23:02:10+02:00
draft = false
tags = ['github', 'ci', 'automation']
+++

Until recently, when we wanted to create new releases for [ArkScript](https://github.com/ArkScript-lang/Ark), we had to build the language on all the system we support (currently Windows and Linux), build the modules (http, console, random, etc), test everything on *each* operating system, and then package the needed files and directory in ZIPs. We had to go to GitHub, create a new release, add the correct tag (and not mix it with the title as they are different things!), grep the latest changelog, and add our artifacts.

All that without forgeting to increment the version number in our CMakeLists, and in the CHANGELOG. A lot of steps for something we do quite often (at least 6 time a year, maybe more now that we can easily create releases).

That's why I decided to make a "button-click-to-release" GitHub actions.

# What are GitHub actions?

They are steps (build, log, download, upload, whatever), chained in an environment (a container to be exact). Those steps are described in YAML files, under a magic folder `.github/workflows/` in your repository.

This can be used to create continuous integration workflows, to ensure that your code can still build on many operating systems when you create a new pull request, it can be used to run a linter on your code... It can do a lot of things.

# Pre-requisites

For this "button-click-to-release" action, I needed
- a changelog, following [this nomenclature](https://keepachangelog.com)
- build artifacts from other workflows
- (optional) a Discord webhook link

## Build artifacts? What are they?

This is a new thing introduced with Actions: the possibility to store files (zip, tar.gz, text files, whatever) on a specific workflow run. For example, your workflow is producing a binary (in our case, an executable `ark` and multiple static objects files), you can add a special step in your workflow to zip those files and attach them to the workflow run. By doing this, when visiting your actions runs history (under `Actions`), you can have a snapshot build per workflow run.

By doing this, we don't have to build our language on multiple OS ourselves, the CI does it for us, and even better, make those build artifacts available to us!

*Note*: the build artifacts are available for at most 90 days (you can lower this duration if you want to)

## Creating artifacts

In our build workflows (linux-gcc, linux-clang, msvc for Windows), we added testing steps after building, to ensure everything works, and only if they succeeded, we create a build artifact. Otherwise we would waste space uploading a non-working version of the project!

The step is quite straightforward, we retrieve the wanted files, add them to a folder, zip it, and tell another step to use our zip.

```yaml
    - name: Organize files for upload
      shell: bash
      run: |
        mkdir -p artifact/lib
        cp build/ark artifact
        ...

    - name: Upload artifact
      uses: actions/upload-artifact@v2
      with:
        name: ark-linux-clang-version
        path: artifact
```

## Creating the workflow

I created a `release.yml` workflow under `.github/workflows/`, with a `workflow_dispatch` field. This allows us to run the workflow manually *and* gives it parameters (eg. the version number, title, etc).

```yaml
name: "Create a release"

on:
  workflow_dispatch:
    inputs:
      versionName:
        description: 'Name of version  (ie 5.5.0)'
        required: true
      isDraft:
        description: 'Should we create a draft release?'
        required: false
        default: 'true'
```

For now, the inputs in `workflow_dispatch` only support strings, thus my "boolean" `isDraft` must be written as `default: 'true'`. The idea is that the workflow can create a draft or non-draft release, according to what the user wants. Creating a draft is useful to review everything the action put in the release, to ensure nothing bad happened, and/or add notes in the release body.

Then, we declare the jobs of our workflow, here, a single one, running on the latest ubuntu container.

```yaml
jobs:
  release:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2
```

The checkout action is used to clone our repository in the container, so that we have access to our `CHANGELOG.md`.

Then, we download the artifacts produced by other workflows (the one making up our CI) and zip then under new names (each release artifacts in ArkScript follow a naming convention: `{short_os_name}{if 32bit: '32' else: '64'}`).

```yaml
      - name: Download artifact Linux GCC
        uses: dawidd6/action-download-artifact@v2
        with:
          workflow: linux-gcc.yml
          branch: dev
          name: ark-linux-gcc-version
          path: ark-linux-gcc-version

      - name: Download artifact Windows MSVC
        ...

      - name: Make ZIPs
        shell: bash
        run: |
          (cd ark-linux-gcc-version && zip -r ../linux64.zip ./)
          ...
```

*Note*: we are using `dawidd6/action-download-artifact@v2` because the official GitHub action to download build artifacts doesn't work accross workflows/repositories, and has far less customization. Here we want to take the latest artifacts produced on the `dev` branch.

Onto the release creation:
```yaml
      - name: Extract release notes
        id: extract-release-notes
        uses: ffurrer2/extract-release-notes@v1

      - name: Create release
        uses: actions/create-release@v1
        id: create_release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.event.inputs.versionName }}
          release_name: ArkScript v${{ github.event.inputs.versionName }}
          draft: ${{ github.event.inputs.isDraft }}
          prerelease: false
          body: ${{ steps.extract-release-notes.outputs.release_notes }}
```

We added an identifier to the extract release notes step, to reference its output more easily, to give it as the body of our create-release step. The `draft` parameter is set according to the workflow input `isDraft`, if it's truthy, then we post a message on Discord to ask the team for a review:

```yaml
      - uses: sarisia/actions-status-discord@v1
        if: ${{ github.event.inputs.isDraft }} == 'true'
        with:
          webhook: ${{ secrets.DISCORD_WEBHOOK }}
          title: "A new release (v${{ github.event.inputs.versionName }}) has been drafted"
          description: |
            Please review it **before publishing it**, as this action would trigger workflows and GitHub webhooks,
            notifying everyone of a new release! You want to be sure **everything** is correct
            [Release draft URL](${{ steps.create_release.outputs.html_url }})
          nodetail: true
          username: GitHub Actions
```

Finally, we attach our artifacts to the created release:
```yaml
      - name: Upload Linux artifact
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ github.token }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./linux64.zip
          asset_name: linux64.zip
          asset_content_type: application/zip

      - name: Upload Windows artifact
        ...
```

# The output

Now, we just have to:
- update the version in the CMakeLists
- update the changelog `[Unreleased]` section to `[version] - date`
- commit and push those modifications, ensure that all checks are green
- click on a fancy button

![fancy button](/fancy_button.png)
 
If it was marked as a draft, we get a fancy message on our Discord dev team channel:

![fancy discord message](/discord.png)
 
Finally, we get our release on GitHub:

![GitHub release](/release.png)

*yes the version displayed on the last screenshot doesn't match the one in the webhook as they were made separately*

# Conclusion

In a few lines of code, we can finally create releases in a near friction-less way, and I hope that it will help us to create more regular releases of our project!

