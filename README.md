# Hapi-Sol
[![npm version](https://img.shields.io/npm/v/hapi-sol.svg)](https://www.npmjs.com/package/hapi-sol)
[![Build Status](https://travis-ci.org/yonjah/hapi-sol.svg?branch=master)](https://travis-ci.org/yonjah/hapi-sol)
[![codecov](https://codecov.io/gh/yonjah/hapi-sol/branch/master/graph/badge.svg)](https://codecov.io/gh/yonjah/hapi-sol)
[![License](https://img.shields.io/npm/l/hapi-sol.svg?maxAge=2592000?style=plastic)](https://github.com/yonjah/hapi-sol/blob/master/LICENSE) [![Greenkeeper badge](https://badges.greenkeeper.io/yonjah/hapi-sol.svg)](https://greenkeeper.io/)

A Session based auth scheme for Hapi

<sub><sup>This scheme is based on [hapi-session](https://github.com/nlf/hapi-session) but the API is a bit diffrent (mostly using async and callback scheme) and most of the underline code has changed.
As with the original scheme a lot of the code was gratuitously stolen from the hapi [auth cookie scheme](https://github.com/hapijs/hapi-auth-cookie), and this module works in much the same way.</sup></sub>

This Module will save a cookie with a unique session ID, the ID has high entropy and is randomly secure so it should be impossible to fake. all other data is never sent to the user so you can save in the session whatever information you wont without the fear of it being faked or compromised.

## Usage
**For Hapi 16.x and lower see [previous version](https://github.com/yonjah/hapi-sol/tree/v0.6.0)**
For demo server example usage see the [server.js](https://github.com/yonjah/hapi-session/blob/master/examples/server.js)


### Loading the module
```javascript
await server.register({plugin: require('hapi-sol')});
server.auth.strategy('session', 'session', {/* Options Object*/});
server.auth.default('session');
```


### handling Login
After validating the user credentials saving them to the cookie is done by the session.set
method
```javascript
await request.auth.session.set({'logined': true, 'userid': 1});
return h.response('You are being redirected...').takeover().redirect('/');
```
notice this method is asynchronous.
once the user is logged in you will have the credentials passed to the set method available in future connections at -
```javascript
console.log(request.auth.credentials); //{'logined': true, 'userid': 1}
```

To logout the user you can either call set with null value or call the clear method
```javascript
await request.auth.session.set(null);
return h.response('You are being redirected...').takeover().redirect('/');
//
await request.auth.session.clear();
return h.response('You are being redirected...').takeover().redirect('/');
```
the `clear` method will completely remove the session from cache and create a new one while the `set` method will leave the current session active but unauthenticated. As with the `set` method `clear` is asynchronous.

## Synchronous methods on request.auth.session
`request.auth.session.getId` returns the current session ID

## Asynchronous methods on request.auth.session
`request.auth.session.getSeesion` returns the current session object

`request.auth.session.setSeesion(session)` save `session` as the current session object

since clients will always have an active persistent session it can be useful to attach some extra data to the session object

```javascript
//on failed login attempt
const session = await request.auth.session.getSession();
session.attempts = session.attempts ? session.attempts + 1: 1;
await request.auth.session.setSession(session);
if (session.attempts > 5) {
    //block user ip
}
```

Notice that the `session` Object has two internally used properties
`authenticated` Boolean is the true if the session has credentials associated with it.
`credentials` Object credentials saved with the session
it better to avoid doing manual changes to this values (use the `set` method instead) since `setSession` will not do any validations on your session Object.


## Available options
when setting an auth strategy you can set the following options:
- `cookie` The cookie name __default('sid')__
- `sessionCookie` use browser session cookies (will only apply `ttl` settings for built in cache) 
- `path` The cookie path __default('/'')__
- `ttl` Cookie and cache TTL in milliseconds __default(1000 * 60 * 60 * 24 //one day)__
- `isHttpOnly` Set HTTP only cookie flag __default(true)__
- `isSecure` Force SSL for cookie __default(true)__
- `secret` Secret to be used to create local HMAC of the cookie id can help reduce timing attacks and using stolen cookies __default(null)__
- `hmacAlgo` HMAC algorithm to be used (only used if `secret` is set) _default(sha1)__
- `hmacEncoding` HMAC encoding (only used if `secret` is set) _default(base64)__
- `hmacRequest` Array of values to be taken from the request that will be included in the HMAC make session harder to steal(only used if `secret` is set) _default(['info.remoteAddress', 'headers.user-agent'])__
- `rlClient` rate limiting client to use for rate  limiting users who try to bruteforce session ids. you can use [ralphi-client](https://github.com/yonjah/ralphi/tree/master/client) or any object which implements `query` and `take` methods.
- `rlBucket` bucket to use for rate limiting __default('session')__
- `rlGetKey` function/async for getting the rate limiting key from the request __default(request => request.info.remoteAddress)__
- `rlAddHeaders` add rate limiting headers to limited responses __default(true)__
- `cacheId` the cache ID to use when saving sessions __default('\_hapi\_session')__
- `cache` caching manager if you want to use your own storage (needs to implement _get_,_set_ and _drop_ methods) __default(undefined)__
- `validateFunc` Async function to farther validate the cookie if needed function signature should be (request, credentials) function should return an array first item is boolean value indicating if credentials are valid, and optional second value can be returned with an object of a parsed credentials to replace the credentials being set in the authentication process __default(undefined)__
- `clearInvalid` If cookie is tested to be invalid by the validateFunc should we clear the existing cookie __default(true)__
- `sidLength` The length in Bytes for the generated random ID Should be high enough so collision would be impossible minimum 10 bytes __default(16)__
- `uidRetries` How many retries should be made to generate the ID (in case of missing entropy) __default(5)__
- `redirectTo` Location to redirect to in case of auth Error __default(''//Empty string)__
- `appendNext` if truthy will add a query parameter with the same name in the redirection url back to the current route boolean true will set the name 'next' __default(''//Empty string)__
- `redirectOnTry` if mode is set to try and auth fails redirect the request __default(false)__

