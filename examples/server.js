"use strict";
var hapi    = require('hapi'),
	session = require('../'),
	server  = new hapi.Server(3000);

var users = {
	john: {
		id: 'john',
		password: 'password',
		name: 'John Doe'
	}
};

var home = function (request, reply) {
	reply('<html><head><title>Login page</title></head><body><h3>Welcome ' + request.auth.credentials.name + '!</h3><br/><form method="get" action="/logout">' + '<input type="submit" value="Logout">' + '</form></body></html>');
};

var login = function (request, reply) {
	if (request.auth.isAuthenticated) {
		return reply.redirect('/');
	}

	var message = '';
	var account = null;

	if (request.method === 'post') {

		if (!request.payload.username || !request.payload.password) {
			message = 'Missing username or password';
		} else {
			account = users[request.payload.username];
			if (!account || account.password !== request.payload.password) {
				message = 'Invalid username or password';
			}
		}
	}

	if (request.method === 'get' || message) {
		return reply('<html><head><title>Login page</title></head><body>' + (message ? '<h3>' + message + '</h3><br/>' : '') + '<form method="post" action="/login">' + 'Username: <input type="text" name="username"><br>' + 'Password: <input type="password" name="password"><br/>' + '<input type="submit" value="Login"></form></body></html>');
	} else {
		return request.auth.session.set(account, function () {
			return reply.redirect('/');
		});
	}
};

var logout = function (request, reply) {
	return request.auth.session.clear(function () {
		return reply.redirect('/');
	});
};

server.pack.register(session, function (err) {

	server.auth.strategy('session', 'session', true, {
		password: undefined,
		cookie: 'sid-example',
		redirectTo: '/login',
		isSecure: false
	});

	server.route([{
		method: 'GET',
		path: '/',
		config: {
			handler: home
		}
	}, {
		method: ['GET', 'POST'],
		path: '/login',
		config: {
			handler: login,
			auth: {
				mode: 'try'
			},
			plugins: {
				'session': {
					redirectTo: false
				}
			}
		}
	}, {
		method: 'GET',
		path: '/logout',
		config: {
			handler: logout
		}
	}]);

	server.start(function () {
        console.log('Server ready');
    });
});