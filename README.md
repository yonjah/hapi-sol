# Hapi-Sol

A Session based auth scheme for Hapi

<sub><sup>This scheme is based on [hapi-session](https://github.com/nlf/hapi-session) but the API is a bit diffrent (mostly using async and callback scheme) and most of the underline code has changed.
As with the original scheme a lot of the code was gratuitously stolen from the hapi [auth cookie scheme](https://github.com/hapijs/hapi-auth-cookie), and this module works in much the same way.</sup></sub>

This Module will save a cookie with a unique session ID, the ID has high entropy and is randomly secure so it should be impossible to fake. all other data is never sent to the user so you can save in the session whatever information you wont without the fear of it being faked or compromised.

## Usage
For demo server example usage see the [server.js](https://github.com/yonjah/hapi-session/blob/master/examples/server.js)


### Loading the module
```javascript
server.pack.register(require('hapi-sol'), function cb (err) {
	server.auth.strategy('session', 'session', true, {
		// Options Object
	});
});
```


### handling Login
After validating the user credentials saving them to the cookie is done by the session.set
method
```javascript
request.auth.session.set({'logined': true, 'userid': 1}, function () {
	return reply.redirect('/');
});
```
notice this method is asynchronous.
once the user is logged in you will have the credentials passed to the set method available in future connections at -
```javascript
console.log(request.auth.credentials); //{'logined': true, 'userid': 1}
```

To logout the user call the clear method
```javascript
return request.auth.session.clear(function () {
	return reply.redirect('/');
});
```
As with the set this method is asynchronous.

## Available options
when setting an auth strategy you can set the following options:
- `cookie` The cookie name __default('sid')__
- `path` The cookie path __default('/'')__
- `ttl` Cookie and cache TTL in milliseconds __default(1000 * 60 * 60 * 24 //one day)__
- `isHttpOnly` Set HTTP only cookie flag __default(true)__
- `isSecure` Force SSL for cookie __default(true)__
- `password` Password to be use to encrypt the cookie data sent to the user, since we are not sending any sensitive data this can be be left undefined __default(undefined)__
- `cacheId` the cache ID to use when saving sessions __default('\_hapi\_session')__
- `cache` caching manager if you don't want to use something else (needs to implement _get_,_set_ and _drop_ methods) __default(undefined)__
- `validateFunc` A function to farther validate the cookie if needed __default(undefined)__
- `clearInvalid` If cookie is tested to be invalid by the validateFunc should we clear the existing cookie __default(true)__
- `assumePromise` if set to true assumes `validateFunc` and `cache` methods will return a promise __default(false)__
- `sidLength` The length in Bytes for the generated random ID Should be high enough so collision would be impossible __default(36)__
- `uidRetries` How many retries should be made to generate the ID (in case of collisions or missing entropy) __default(5)__
- `redirectTo` Location to redirect to in case of auth Error __default(''//Empty string)__
- `appendNext` if truthy will add a query parameter with the same name in the redirection url back to the current route boolean true will set the name 'next' __default(''//Empty string)__
- `redirectOnTry` if mode is set to try and auth fails redirect the request __default(true)__

