"use strict";
var should      = require('should'),
	sinon       = require('sinon'),
	sol         = require('../'),
	hapi        = require('hapi'),
	hoek        = require('hoek'),
	Promise     = require("bluebird"),
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
		server.register(sol, err => {
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

	it('passes with no plugin options', () => setServer());

	it('fails if cacheId is not a string', () =>
		setServer({ validateFunc: 387498 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})
	);

	it('fails if sidLength is not a positive integer', () =>
		setServer({ sidLength: 'not a number' })
			.then(() => {
					throw new Error('should not fullfill');

				},
				() => setServer({ sidLength: 1.5 })
			).then(() => {
					throw new Error('should not fullfill');

				},
				() => setServer({ sidLength: -1 })
			).then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if uidRetries is not a positive integer', () =>
		setServer({ uidRetries: 'not a number' })
			.then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ uidRetries: 1.5 })
			).then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ uidRetries: -1 })
			).then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if clearInvalid is not a boolean', () =>
		setServer({ clearInvalid: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if ttl is not a positive integer', () =>
		setServer({ ttl: 'not a number' })
			.then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ ttl: 1.5 })
			).then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ ttl: -1 })
			).then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if cookie is not a string', () =>
		setServer({ cookie: 1234 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if cache is not an object with set,get and drop methods', () =>
		setServer({ cache: 'not an object' })
			.then(() => {
					throw new Error('should not fullfill');

				},
				() => setServer({ cache: { } })
			).then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ cache: {set: () => {}, get: () => {}} })
			).then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ cache: {set: () => {}, drop: () => {}} })
			).then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ cache: {get: () => {}, drop: () => {}} })
			).then(() => {
					throw new Error('should not fullfill');

				},
				() => {})
	);

	it('fails if assumePromise is not a boolean', () =>
		setServer({ assumePromise: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if isSecure is not a boolean', () =>
		setServer({ isSecure: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if isHttpOnly is not a boolean', () =>
		setServer({ isHttpOnly: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if redirectOnTry is not a boolean', () =>
		setServer({ redirectOnTry: 'not a boolean' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if password is not a string or buffer', () =>
		setServer({ password: 2432 })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {})

	);

	it('fails if redirectTo is not a string or empty value', () =>
		setServer({ redirectTo: 12354 })
			.then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ redirectTo: true })
			).then(() => {
					throw new Error('should not fullfill');

				},
				() => {}
			)

	);

	it('fails if validateFunc is not a func', () => {
		return setServer({ validateFunc: 'not a function' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {});

	});

	it('fails if appendNext is not a string boolean or empty value', () =>
		setServer({ appendNext: 12354 })
			.then(() => {
					throw new Error('should not fullfill');

				}, () => setServer({ appendNext: {} })
			).then(() => {
					throw new Error('should not fullfill');

				},
				() => {}
			)

	);

	it('fails if path is not a string', () =>
		setServer({ path: 12234 })
			.then(() => {
					throw new Error('should not fullfill');

				},
				() => {}
			)

	);


	it('authenticates a request', () => {
		let user = { fake: 'user'},
			resource = {fake: 'resource'};
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then(server => {
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
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
						res.statusCode.should.be.equal(200);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('sets session id on initial request', () => {
		let resource = {fake: 'resource'};
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then(server => {
				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject('/resource'))
					.then(response => {
						let header, cookie;
						response.statusCode.should.be.equal(401);
						response.result.message.should.be.eql('Bad Session');
						header = response.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(response => {
						response.statusCode.should.be.equal(401);
						response.result.message.should.be.eql('Not authenticated');

					}).finally(() => server.stop());

			});
	});

	it('ends a session', () => {
		let user = { fake: 'user'},
			cookie;
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then(server => {
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
					.then(res => {
						let header;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
						let id,
							header;
						res.statusCode.should.be.equal(200);
						res.result.should.be.equal('logged-out');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						id = header[0].match(cookieRegex)[1];
						should.exist(id);
						id.should.be.ok();
						id.should.not.be.eql(cookie[1]);
						return server.inject({ method: 'GET', url: '/logout', headers: { cookie: 'special=' + cookie[1] } });
					}).then(res => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('clear session on invalid id', () => setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true})
			.then(server => {
				const id = '123456';
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('ok');
					}
				});


				return server.start()
					.then(() => server.inject({url: '/',  headers: { cookie: `special=${id}` }}))
					.then(res => {
						let cookie,
							header;
						should.exist(res);
						res.statusCode.should.be.equal(401);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						should.exist(cookie[1]);
						cookie[1].should.be.ok();
						cookie[1].should.not.be.eql(id);
					}).finally(() => server.stop());

			})

	);

	it('uses validateFunc to validate and replace credentials', () => {
		let user         = { fake: 'user' },
			resource     = { fake: 'resource' },
			creds        = { fake: 'creds', user: user },
			newCreds     = { fake: 'new creds', user: user },
			validateFunc = sinon.stub().yieldsOn(creds, null, true, newCreds);

		return setServer({ ttl: 60 * 1000, cookie: 'special', validateFunc: validateFunc})
			.then(server => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: function (request, reply) {
							user.name = request.params.user;
							request.auth.session.set(creds)
								.then(() => reply(user.name));

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request, reply) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.be.eql(newCreds);

						return reply(resource);
					}
				});

				return server.start()
					.then(() => server.inject('/login/valid'))
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
						res.statusCode.should.be.equal(200);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

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
			.then(server => {
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
					.then(response => {
						let header;
						should.exist(response);
						response.result.should.be.equal('invalid');
						header = response.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(response => {
						let id,
							header;
						response.statusCode.should.be.equal(401);
						response.result.message.should.be.eql('Invalid credentials');
						header = response.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						id = header[0].match(cookieRegex)[1];
						should.exist(id);
						id.should.be.ok();
						id.should.not.be.eql(cookie[1]);
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
			.then(server => {
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
					.then(res => {
						let header;
						should.exist(res);
						res.result.should.be.equal('invalid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
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
			.then(server => {
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
					.then(res => {
						let header;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
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
			.then(server => {
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
					.then(res => {
						let header;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(res => {
						res.statusCode.should.be.equal(401);
					}).finally(() => server.stop());

			});

	});

	it('authenticates a request (session cookie)', () => {
		let name     = 'steve',
			user     = { fake: 'user'};

		return setServer({ cookie: 'special', sessionCookie: true})
			.then(server => {
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
					.then(res => {
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
			.then(server => {
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
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						header[0].should.match(new RegExp(`Path=${path}`));
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: `${path}/resource`, headers: { cookie: 'special=' + cookie[1] } });
					}).then(res => {
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
			.then(server => {
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
					.then(res => {
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
			.then(server => {
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
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal(name);
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						should(_cache).have.property(cookie[1]);
						return server.inject({ method: 'GET', url: '/clearKey', headers: { cookie: 'special=' + cookie[1] } })
							.then(res => {
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
			.then(server => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
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
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						res.statusCode.should.be.equal(302);
						res.headers.should.have.property('location', 'http://example.com/login?mode=1&next=%2F');

					}).finally(() => server.stop());

			});

	});

	it('skips when redirectTo is set to false', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: false, appendNext: true})
			.then(server => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('skips when route override', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: 'http://example.com/login', appendNext: true})
			.then(server => {
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
					.then(res => {
						res.statusCode.should.be.equal(401);

					}).finally(() => server.stop());

			});

	});

	it('skips when redirectOnTry is false in try mode', () => {
		return setServer({ ttl: 60 * 1000, cookie: 'special', redirectOnTry: false, redirectTo: 'http://example.com/login', appendNext: true})
			.then(server => {
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
					.then(res => {
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
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
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
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: function (request, reply) {
						reply('never');

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
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
			}).then(server => {
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
					.then(res => {
						res.statusCode.should.be.equal(302);

					}).finally(() => server.stop());

			});

	});
});