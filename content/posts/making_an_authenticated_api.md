+++
title = 'Making an authenticated API'
date = 2021-11-12T23:02:10+02:00
draft = false
keywords = ['javascript', 'api', 'auth']
+++

This week, I had to design an API with protected routes, which needed the user to be logged in. There is even more to it, said API should be used by a website (where you have access to cookies).

----

**Technologies used**: NodeJS & expressjs

----

# Making a simple server

Let's create a small server for this demonstration:

```javascript
const express = require('express')
const app = express()

const port = 3000

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/protected', (req, res) => {
  res.send('This should be protected')
})

app.listen(port)
```

We have two routes here, one unprotected `/` and one which we want to protect. If we only had to use this route through the browser, the answer would be easy: just use `express-session` and a cookie parser, to send a cookie to the user, and retrieve it to check if they are logged in or not.

# Basic protection of a route

Said idea would look as follows
```javascript
// ...
const session = require('express-session')
const cookieParser = require('cookie-parser')
// ...

app.use(cookieParser())
app.use(session({
    secret: 'a secret phrase',
    resave: true,
    saveUninitialized: false,
}))

app.get('/protected', (req, res, next) => {
  // this is very basic, don't do this at home
  if (req.session.userID !== null) {
    res.send('This should be protected')
  } else {
    next(new Error('You need to be logged in to view this page'))
  }
})
```

Easy and quick to use, just set a session and check if some data is present (here we are checking against `userID`).

We can even make it simpler to use by making a middleware:
```javascript
// ...

const authMiddleware = (req, _, next) => {
  if ("userID" in req.session && req.session.userID !== null) {
    return next()
  } else {
    const err = new Error("Not authorized, please log in")
    err.status = 403
    return next(err)
  }
}

app.get('/protected', authMiddleware, (req, res) => {
  res.send('This should be protected')
})
```

But there is more to it, how would you use those cookies from an **API**?
* Just add a `Cookie` header with the cookie value? Doesn't work, and even if it does, it's quite ugly
* Send the userID in our requests? The API could be bruteforced until the attacker finds a valid user identifier they can use

# Making the API callable from outside the browser

The idea I went with is using the `Authorization` header. It can take multiple values, but the one I'm interested in is `Authorization: Basic <base64 token>`. Once the base64 token is decoded, we will have something like `userID:hash`.

We can get those information like this in our middleware:
```javascript
const authMiddleware = async (req, _, next) => {
  if (req.headers.authorization) {
      const auth = new Buffer.from(req.headers.authorization.split(' ')[1], 'base64').toString().split(':')
      const user = auth[0]
      const token = auth[1]

      if (await checkToken(user, token)) {
        // creating a cookie, just in case it's used by another route
        req.session.userID = user
        return next()
      }
  } else if ("userID" in req.session && req.session.userID !== null) {
      return next()
  } // ...
}
```

# Security concerns

Now this API could work in a browser with cookies, and with curl (if we don't forget to send the authorization header). This sounds too easy, right?

Indeed. If the `hash` in our base64 token is just the password hash, then again, an attacker could bruteforce it, though it would take much longer. Even worse, someone could listen to packets on your network and use your token, for as long as they want!

The way I've chosen to address the latter is
* to avoid sending the password hash in the authorization token (someone might try to bruteforce it)
* to send a unique hash from which you can't recover the password
* to have a time bound token (eg the token is unusable/deleted after 15 or 60 minutes)

To accomplish this, I could have just send `userID:hash(now.timestamp + 3600)`. But anyone can forge said token easily, so it's not secure. How about a double hash?

We can send something like `userID:hash(creation_timestamp + hash(secret + password))`. Good luck making a hash table to reverse this (note: the secret is server side, unknown by the client, to make the password hash robust against hash tables attacks). Then we only have to store something like `"tokens": [{"expireAt": Date.now(), "value": token}]` in our user database, to be able to check if we got a valid token.

Our `checkToken` function can look like this:
```javascript
const checkToken = async (user, token) => {
  const db = getDatabase("users")
  const rows = await db.select(user)

  // checking that the user exists
  if (rows.length === 1 && rows[0].tokens) {
    const validTokens = rows[0].tokens.filter(tok => tok.value === token && tok.expireAt > Date.now())
    if (validTokens.length > 0) {
      return true
    }
  }
  return false
}
```

# Conclusion

Avoid sending raw credentials in your authorization header, as they could be stolen by an attacker. Also use time based tokens, to automatically remove tokens from users' accounts when they are expired, setting the security level of your application a bit higher. You could even delete the tokens when they have been used more than X times, it's up to you.

