/* globals describe, before, it, beforeEach*/
"use strict";
var should      = require('should'),
	sol         = require('../'),
	hapi        = require('hapi'),
	hoek        = require('hoek'),
	Promise     = require("bluebird"),
	port        = 3000,
	cookieRegex = /(?:[^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)\s*=\s*(?:([^\x00-\x20\"\,\;\\\x7F]*))/;


function promisifyInject (server) {
	var inject  = server.inject;
	server.inject = function (options) {
		return new Promise(function (resolve) {
			inject.call(server, options, resolve);
		});
	};
}


function setServer (options) {
	var server = new hapi.Server();
	server.connection();
	promisifyInject(server);
	server.start = Promise.promisify(server.start, {context: server});
	server.stop = Promise.promisify(server.stop, {context: server});
	return new Promise((resolve, reject) => {
		server.register(sol, (err) => {
			if (err) {
				reject(err);

			}

			try {
				server.auth.strategy('default', 'session', true, options);

			} catch (e) {
				reject(e);

			}

			resolve(server);

		});

	});

}

describe('scheme', () => {

	it('passes with no plugin options', () => {
		return setServer();
	});

	it('fails if cacheId is not a string', () => {
		return setServer({ validateFunc: 387498 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if sidLength is not a positive integer', () => {
		return setServer({ sidLength: 'not a number' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ sidLength: 1.5 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ sidLength: -1 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if uidRetries is not a positive integer', () => {
		return setServer({ uidRetries: 'not a number' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ uidRetries: 1.5 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ uidRetries: -1 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if clearInvalid is not a boolean', () => {
		return setServer({ clearInvalid: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if ttl is not a positive integer', () => {
		return setServer({ ttl: 'not a number' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ ttl: 1.5 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ ttl: -1 });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if cookie is not a string', () => {
		return setServer({ cookie: 1234 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if cache is not an object with set,get and drop methods', () => {
		return setServer({ cache: 'not an object' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ cache: { } });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ cache: {set: () => {}, get: () => {}} });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ cache: {set: () => {}, drop: () => {}} });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ cache: {get: () => {}, drop: () => {}} });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});
	});

	it('fails if assumePromise is not a boolean', () => {
		return setServer({ assumePromise: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if isSecure is not a boolean', () => {
		return setServer({ isSecure: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if isHttpOnly is not a boolean', () => {
		return setServer({ isHttpOnly: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if redirectOnTry is not a boolean', () => {
		return setServer({ redirectOnTry: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if password is not a string or buffer', () => {
		return setServer({ password: 2432 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if redirectTo is not a string or empty value', () => {
		return setServer({ redirectTo: 12354 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ redirectTo: true });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if validateFunc is not a func', () => {
		return setServer({ validateFunc: 'not a function' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if appendNext is not a string boolean or empty value', () => {
		return setServer({ appendNext: 12354 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {
				return setServer({ appendNext: {} });

			}).then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if path is not a string', () => {
		return setServer({ path: 12234 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});


	it('authenticates a request', () => {
		let user = { fake: 'user'},
			resource = {fake: 'resource'};
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject('/login/valid'))
					.then((res) => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						res.statusCode.should.be.equal(200);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it.skip('fails over to another strategy if not present', () => {

		const extraSchemePlugin = function (plugin, options, next) {

			const simpleTestSchema = function () {

				return {
					authenticate: function (request, reply) {

						return reply.continue({ credentials: { test: 'valid' } });
					}
				};
			};

			plugin.auth.scheme('simpleTest', simpleTestSchema);
			return next();
		};

		extraSchemePlugin.attributes = {
			name: 'simpleTestAuth'
		};

		function validateFunc (request, session, callback) {
			const override = hoek.clone(session);
			override.something = 'new';

			return callback(null, session.user === 'valid', override);
		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true, validateFunc: validateFunc})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {

							request.auth.session.set({ user: request.params.user });
							return reply(request.params.user);
						}
					}
				});

				return new Promise((resolve, reject) => {
					server.register(extraSchemePlugin, (err) => {
						if (err) {
							reject(err);

						}

						try {
							server.auth.strategy('simple', 'simpleTest');

						} catch (e) {
							reject(e);

						}

						resolve(server);
					});

				});
			}).then((server) => {
				server.route({
						method: 'GET',
						path: '/multiple',
						config: {
							auth: {
								mode: 'try',
								strategies: ['default', 'simple']
							},
							handler: function (request, reply) {

								const credentialsTest = (request.auth.credentials && request.auth.credentials.test) || 'NOT AUTH';
								return reply('multiple ' + credentialsTest);
							}
						}
					});

				return server.inject('/multiple');
			}).then((res) => {
				should.exist(res);
				res.result.should.be.equal(200);
				res.result.should.be.equal('multiple valid');
			});
	});

	it('ends a session', () => {
		let user = { fake: 'user'},
			cookie;
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/logout', handler: function (request, reply) {

						request.auth.session.clear()
							.then(() => reply('logged-out'));
					}
				});

				return server.start()
					.then(() => server.inject('/login/valid'))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						res.statusCode.should.be.equal(200);
						res.result.should.be.equal('logged-out');
						res.headers['set-cookie'][0].should.be.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; Path=/');
						return server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } });
					}).then((res) => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('clear cookie on invalid', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true})
			.then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('ok');
					}
				});


				return server.start()
					.then(() => server.inject({url: '/',  headers: { cookie: 'special=123456' }}))
					.then((res) => {
						should.exist(res);
						res.statusCode.should.be.equal(401);
						res.headers['set-cookie'][0].should.be.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; Path=/');

					}).finally(() => server.stop());

			});

	});

	it('fails a request with invalid session', () => {
		let user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		function validateFunc (request, session, callback) {
			const override = hoek.clone(session);
			override.something = 'new';

			return callback(null, session.user === 'valid', override);
		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true, validateFunc: validateFunc})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject('/login/invalid'))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal('invalid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						res.headers['set-cookie'][0].should.be.equal('special=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; Path=/');
						res.statusCode.should.be.equal(401);
					}).finally(() => server.stop());

			});
	});

	it('does not clear a request with invalid session (clearInvalid not set)', () => {
		let user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		function validateFunc (request, session, callback) {
			const override = hoek.clone(session);
			override.something = 'new';

			return callback(null, session.user === 'valid', override);
		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: false, validateFunc: validateFunc})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject('/login/invalid'))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal('invalid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						should.not.exist(res.headers['set-cookie']);
						res.statusCode.should.be.equal(401);
					}).finally(() => server.stop());

			});

	});

	it('logs in and authenticates a request', () => {
		let name = 'steve',
			user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							request.auth.session.set({ user: hoek.merge({name: request.params.user}, user)})
								.then(() => reply(request.params.user));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						try {
							should.exist(request.auth.credentials);
							request.auth.credentials.should.have.property('user');
							request.auth.credentials.user.should.have.property('name', name);
						} catch (e) {
							return reply(e);
						}
						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject(`/login/${name}`))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						res.statusCode.should.be.equal(200);
						res.result.should.be.equal(resource);
					}).finally(() => server.stop());

			});

	});

	it('errors in validation function', () => {
		let name = 'steve',
			user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		function validateFunc (request, session, callback) {
			return callback(new Error('boom'));

		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', validateFunc: validateFunc})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject(`/login/${name}`))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then((res) => {
						res.statusCode.should.be.equal(401);
					}).finally(() => server.stop());

			});

	});

	it('authenticates a request (session cookie)', () => {
		let name     = 'steve',
			user     = { fake: 'user'};

		return setServer({ cookie: 'special', sessionCookie: true})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				return server.start()
					.then(() => server.inject(`/login/${name}`))
					.then((res) => {
						let header;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.not.match(/Max-Age/);
					}).finally(() => server.stop());

			});

	});

	it('authenticates a request on a sub-path', () => {
		let path     = '/subpath',
			name     = 'steve',
			user     = { fake: 'user'},
			resource = { fake: 'resource'};

		return setServer({ cookie: 'special', ttl: 60 * 1000, path: path })
			.then((server) => {
				server.route({
					method: 'GET', path: `${path}/login/{user}`,
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: `${path}/resource`, handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject(`${path}/login/${name}`))
					.then((res) => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						header[0].should.match(new RegExp(`Path=${path}`));
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: `${path}/resource`, headers: { cookie: 'special=' + cookie[1] } });
					}).then((res) => {
						res.statusCode.should.be.equal(200);
						res.result.should.be.equal(resource);
					}).finally(() => server.stop());

			});

	});
});

describe('set()', () => {

	it('errors on missing session in set()', () => {
		let name = 'steve';

		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							request.auth.session.set(undefined)
								.then(
									() => reply('ok'),
									(e) => reply(e.message || 'ok')
								);

						}
					}
				});


				return server.start()
					.then(() => server.inject(`/login/${name}`))
					.then((res) => {
						should.exist(res);
						res.result.should.be.equal('Invalid credentials');

					}).finally(() => server.stop());

			});

	});

});

describe('clear()', () => {

	it('clear a specific session key', () => {
		let name = 'steve',
			user = { fake: 'user'},
			_cache = Object.create(null),
			cache  = {
				set: function (key, value, ttl, cb) {
					_cache[key] = value;
					cb(null, true);
				},
				get: function (key, cb) {
					cb(null, _cache[key], !!_cache[key]);
				},
				drop: function (key, cb) {
					delete _cache[key];
					cb(null, true);
				}
			};

		return setServer({ ttl: 60 * 1000, cookie: 'special', cache: cache})
			.then((server) => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set({ user: user })
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/clearKey', handler: function (request, reply) {

						request.auth.session.clear()
							.then(() => {
								reply();
							});
					}
				});


				return server.start()
					.then(() => server.inject(`/login/${name}`))
					.then((res) => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						should(_cache).have.property(cookie[1]);
						return server.inject({ method: 'GET', url: '/clearKey', headers: { cookie: 'special=' + cookie[1] } })
							.then((res) => {
								res.statusCode.should.be.equal(200);
								should(_cache).not.have.property(cookie[1]);

							});

					}).finally(() => server.stop());

			});
	});

});

describe('redirection', () => {

	it('sends to login page (uri without query)', () => {

		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: 'http://example.com/login', appendNext: true})
			.then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(302);
						res.headers.should.have.property('location', 'http://example.com/login?next=%2F');

					}).finally(() => server.stop());

			});
	});

	it('sends to login page (uri with query)', () => {
		return setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: true
			}).then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(302);
						res.headers.should.have.property('location', 'http://example.com/login?mode=1&next=%2F');

					}).finally(() => server.stop());

			});

	});

	it('skips when redirectTo is set to false', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: false, appendNext: true})
			.then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('skips when route override', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: 'http://example.com/login', appendNext: true})
			.then((server) => {
				server.route({
					method: 'GET',
					path: '/',
					handler: function (request, reply) {

						return reply('never');
					},
					config: {
						plugins: {
							'session': {
								redirectTo: false
							}
						}
					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('skips when redirectOnTry is false in try mode', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectOnTry: false, redirectTo: 'http://example.com/login', appendNext: true})
			.then((server) => {
				server.route({
					method: 'GET',
					path: '/',
					config: {
						auth: { mode: 'try' }
					},
					handler: function (request, reply) {
						return reply(request.auth.isAuthenticated);

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(200);
						res.result.should.be.equal(false);

					}).finally(() => server.stop());

			});

	});


	it('sends to login page and does not append the next query when appendNext is false', () => {
		return setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: false
			}).then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(302);
						res.headers.should.have.property('location', 'http://example.com/login?mode=1');

					}).finally(() => server.stop());

			});

	});

	it('appends the custom query when appendNext is string', () => {
		let next = 'done';
		return setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: next
			}).then((server) => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(302);
						res.headers.should.have.property('location', `http://example.com/login?mode=1&${next}=%2F`);

					}).finally(() => server.stop());

			});
	});

	it('redirect on try', () => {
		return setServer({
				ttl          : 60 * 1000,
				cookie       : 'special',
				redirectTo   : 'http://example.com/login?mode=1',
				redirectOnTry: true
			}).then((server) => {
				server.route({
					method: 'GET', path: '/',
					config: {
						auth: {mode: 'try'}
					},
					handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then((res) => {
						res.statusCode.should.be.equal(302);

					}).finally(() => server.stop());

			});

	});
});