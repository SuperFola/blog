+++
title = "Creating custom GitHub webhooks for automatic deployments"
date = 2024-08-25T13:20:00+02:00
draft = false
tags = ['github', 'javascript', 'api']
+++

For a while, when updating [ArkScript website](https://arkscript-lang.dev), I have needed to remember to update the copy on my VPS so that the changes would be reflected to the world. Since I'm quite lazy, I'd like to automate this!

## The solutions

The first solution would be to use `crontabs`. Easy to setup, find a schedule, write a bash script that `cd` and `git pull` and you're down. However, it has some caveats:

- the changes are not reflected immediately, as you need to wait for your schedule to hit
- we could use a schedule that hit every 5 minutes, but then we would be many useless `git pull`s (which could be bad for our account/server, as GitHub could see this as a bad automated behavior and ban us)
- permissions? I tried to set this up on my server and probably messed something up somewhere, because my script started (shows up in syslog) but did nothing (project was lagging behind and I had to `git pull` myself)

The second funnier solution is to use [webhooks](https://docs.github.com/en/webhooks). Basically, every event (a push, star, fork, action running...) can be filtered and sent as *json* or *xml* to an URL of your choice. You might have already used them to set up channels on Slack or Discord with push/merge/star/whatever events, but did it occur to you that we could use them to detect changes to a project and run automated actions on a deployed version of said project?

## Our needs

What we want:

1. upon pushing to the `master` (or `main`) branch, GitHub will send an event to our webhook
2. check that the event is really coming from GitHub (and not from a script kiddy abusing our webhook)
3. update our project (that can come in the form of a `git pull` or something more elaborate like pulling and building our webapp)

### Registering our webhook on GitHub

The first step is trivial, by going to **https://github.com/USERNAME/REPOSITORY/settings/hooks**, we can create a new webhook. We will need:

1. a payload url: `https://server.com/PROJECT`
2. a content type: `application/json` (so that if we need to read values from it, it will be easier than parsing and reading `x-www-form-urlencoded`)
3. a secret: that's like a password GitHub will be using to hash the payload (HMAC SHA256), which can be used later to ensure that the payload is coming from GitHub and not someone else
4. the type of event(s) we want: `push event` is more than enough to me so that's what I'll focus on

Our 3rd point here solved our 2nd problem, neat!

For the payload url, I put something like `webhooks.myserver.com/project-name`. Since I have a domain I can create subdomains for free (and also request SSL certificates with LetsEncrypt), and adding the project name in the URL will let me have multiple webhooks on the same server, to update different projects without spinning up a new server.

### Checking the event origin

As said before, we need to check that the event is coming from GitHub and not from someone trying to make us pull indefinitely our project(s) to use precious bandwidth.

That's where the **secret** comes in! GitHub uses and HMAC SHA256 digest to compute the hash of the payload it sends us. Said hash is computed from our secret and the payload, which means we can compute it on our side and compare it with the hash GitHub sends us, since our **secret** is... well, secret, only GitHub and us will know its value.

I'll then be using NodeJS and [express](https://expressjs.com/) as it feels to be the easiest way to spin a server:

```javascript
const express = require('express');
const crypto = require('crypto');

const routes = JSON.parse(readFileSync('./routes.json'));

const sigHeaderName = 'X-Hub-Signature-256';
const sigHashAlg = 'sha256';

const app = express();
app.use(express.json());

// the rest of our routes

app.listen(5000, () => {
  console.log('Server Running on port 5000');
})
```

Given a secret, a payload and a computed hash, we can check for it in JavaScript:

```javascript
const data = JSON.stringify(req.body);
const sig = Buffer.from(req.get(sigHeaderName) || '', 'utf8');
const hmac = crypto.createHmac(sigHashAlg, secret);
const digest = Buffer.from(sigHashAlg + '=' + hmac.update(data).digest('hex'), 'utf8');
if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig)) {
  return false;
}
return true;
```

To decompose the second algorithm:

1. we are stringifying the request body (json) to be able to compute its hash
2. getting the signature from the headers
3. creating a HMAC SHA256 from our secret
4. create a digest from our data, using the HMAC
5. comparing the length of the given signature and digest, and if they match, comparing the hash using `crypto.timingSafeEqual` to perform constant time string comparison, to help mitigate timing attacks (and thus potentially leaking our secret)

### Registering our routes

We can then implement this check as an express middleware, and use it in our routes:

```javascript
const verifyPostData = (secret) => {
  return (req, res, next) => {
    if (!req.body) {
      return next('Request body empty');
    }

    const data = JSON.stringify(req.body);
    const sig = Buffer.from(req.get(sigHeaderName) || '', 'utf8');
    const hmac = crypto.createHmac(sigHashAlg, secret);
    const digest = Buffer.from(sigHashAlg + '=' + hmac.update(data).digest('hex'), 'utf8');
    if (sig.length !== digest.length || !crypto.timingSafeEqual(digest, sig)) {
      return next(`Request body digest (${digest}) did not match ${sigHeaderName} (${sig})`);
    }

    return next();
  }
};

app.post('/website', verifyPostData(secret), (req, res) => {
  console.log('Cloning repository...');
  cloneRepo('/docker/website', 'master');
  res.status(204).send('{}');
});
```

To make registering routes easier, and to avoid having to go back to the code every time I need to add a new webhook, we can make use of JSON files as configuration files:

```json
// routes.json
{
  "/route-name-here": {
    "secret": "my secret",
    "folder": "absolute path to folder in volume",
    "branch": "master"
  }
}
```

```javascript
// app.json
const { readFileSync } = require('fs');

const routes = JSON.parse(readFileSync('./routes.json'));

const cloneRepo = (folder, branch) => {
  execSync(`git pull origin ${branch}`, {
    stdio: [0, 1, 2],
    cwd: resolve(__dirname, folder),
  })
}

for (let [route, data] of Object.entries(routes)) {
  app.post(route, verifyPostData(data.secret), (req, res) => {
    console.log(`Cloning ${data.folder} repository...`);
    cloneRepo(data.folder, data.branch);
    res.status(204).send('{}');
  });
}
```

Once we all put that together, we'll need an error handler to handle the bad signature / non-signed case, to provide an answer to the caller (since our middleware calls `next()` with an error message when the provided signature and the computed digest do not match):

```javascript
app.use((err, req, res, _) => {
  if (err) console.error(err);
  res.status(403).send('Request body was not signed or verification failed');
});
```

## Conclusion

We're now ready to go: we can easily create new webhooks and register them on GitHub, we just have to make more projects and deploy them on the same VPS under a `docker/` folder for example (so that we can mount `./docker:/docker` in our webhooks server container, to run the `git pull` commands in the projects).

This setup is pretty basic though, as it only pulls changes when an event is received it assumes the project is served by something like [Apache HTTPD](https://hub.docker.com/_/httpd) and that there are no additional steps (eg building with `npm run build`), hopefully it can get you started!

## Links

1. GitHub repository: [SuperFola/webhooks](https://github.com/SuperFola/webhooks)
2. [GitHub — Validation webhook deliveries](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries)

