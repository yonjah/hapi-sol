# Hapi-Session

This is a session based auth scheme for Hapi.
A lot of stuff from the original scheme (mostly using async and callback scheme) so if your upgrading please refer to the examples or read on.
As with the original scheme a lot of the code was gratuitously stolen from the hapi [auth cookie scheme](https://github.com/hapijs/hapi-auth-cookie), and this module works in much the same way.

This Module will save a cookie with a unique session ID, the ID has high entropy and is randomly secure so it should be impossible to fake. all other data is never sent to the user so you can save in the session whatever information you wont without the fear of it being faked or compromised.

## Usage
For demo server example usage see the [server.js](https://github.com/yonjah/hapi-session/blob/master/examples/server.js)


### Loading the module
```javascript
server.pack.register(require('hapi-session'), function cb (err) {
	server.auth.strategy('session', 'session', true, {
		// Options Object
	});
});
```

### Available options
when setting an auth strategy you can set the following options:
- 'cookie' The cookie name *default('sid')*
- 'path' The cookie path *default('/'')*
- 'ttl' Cookie and cache TTL in milliseconds *default(1000 * 60 * 60 * 24 // one day)*
- 'isHttpOnly' Set HTTP only cookie flag *default(true)*
- 'isSecure' Force SSL for cookie *default(true)*
- 'password' Password to be use to encrypt the cookie data sent to the user, since we are not sending any sensitive data this can be be left undefined *default(undefined)*
- 'sidLength' The length in Bytes for the generated random ID Should be high enough so collision would be impossible *default(36)*
- 'uidRetries' How many retries should be made to generate the ID (in case of collisions or missing entropy) *default(5)*
- 'redirectTo' Location to redirect to in case of auth Error *default(''//Empty string)*
- 'appendNext' if truthy will add a query parameter with the same name in the redirection url back to the current route boolean true will set the name 'next' *default(''//Empty string)*
- 'validateFunc' A function to farther validate the cookie if needed *default(undefined)*
- 'clearInvalid' If cookie is tested to be invalid by the validateFunc should we clear the existing cookie *default(true)*
- 'redirectOnTry' if mode is set to try and auth fails redirect the request *default(true)*
- 'cacheId' the cache ID to use when saving sessions *default('_hapi_session')*

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


