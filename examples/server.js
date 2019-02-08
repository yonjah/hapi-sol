'use strict';
const hapi    = require('hapi');
const sol     = require('../');
const server  = new hapi.Server({port: 8000, debug: {request: ['error']}});

const users = {
	john: {
		id: 'john',
		password: 'password',
		name: 'John Doe'
	}
};

function home (request) {
	return `<html>
	<head>
		<title>Login page</title>
	</head>
	<body>
		<h3>Welcome ${request.auth.credentials.name}!</h3>
		<br/>
		<form method="get" action="/logout">
			<input type="submit" value="Logout">
		</form>
	</body>
</html>`;
}

async function login (request, h) {
	if (request.auth.isAuthenticated) {
		return h.response('You are being redirected...').takeover().redirect('/');
	}

	let message = '',
		account = null;

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
		return `<html>
	<head>
		<title>Login page</title>
	</head>
	<body>
	${message ? '<h3>' + message + '</h3><br/>' : ''}
	<form method="post" action="/login">
		Username: <input type="text" name="username"><br/>
		Password: <input type="password" name="password"><br/>
		<input type="submit" value="Login">
	</form>
	</body>
</html>`;
	} else {
		await request.auth.session.set(account);
		return h.response('You are being redirected...').takeover().redirect('/');
	}
}

async function logout (request, h) {
	await request.auth.session.clear();
	return h.response('You are being redirected...').takeover().redirect('/');
}


async function initServer () {
	await server.register({plugin: sol});
	server.auth.strategy('session', 'session', {
		password: undefined,
		cookie: 'sid-example',
		redirectTo: '/login',
		isSecure: false
	});
	server.auth.default('session');

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
				'sol': {
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

	await server.start();
	console.log('Server ready !!!'); //eslint-disable-line no-console
}

initServer();