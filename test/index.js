"use strict";
const crypto  = require('crypto');
const should  = require('should');
const sinon   = require('sinon');
const hapi    = require('hapi');
const hoek    = require('hoek');
const Promise = require('bluebird');
const sol     = require('../');

const cookieRegex = /(?:[^()<>@,;:\\"/[\]?={}\x7F]+)\s*=\s*(?:([^",;\\\x7F]*))/;


async function setServer (options) {
	var server = new hapi.Server();
	const start = server.start;
	server.start = () => Promise.try(() => start.apply(server));
	await server.register(sol);
	server.auth.strategy('default', 'session', options);
	server.auth.default('default');
	return server;
}

function testResponse (code, response) {
	try {
		response.statusCode.should.eql(code);
	} catch (e) {
		let err = new Error(e);
		if (response.request.response._error) {
			throw response.request.response._error;
		} else {
			err.message += ' ' + JSON.stringify(response.result);
		}
		throw err;
	}
}

function addRoutes (server, user, resource) {
	addLoginRoute(server, user);
	addResourceRoute(server, user, resource);
}

function addLoginRoute (server, user) {
	server.route({
		method: 'GET', path: '/login/{user}',
		config: {
			auth: { mode: 'try' },
			handler: async function (request) {
				user.name = request.params.user;
				await request.auth.session.set({ user: user });
				return user.name;

			}
		}
	});
}

function addResourceRoute (server, user, resource) {
	server.route({
		method: 'GET',
		path: '/resource',
		handler: function (request) {
			should.exist(request.auth.credentials);
			request.auth.credentials.should.have.property('user', user);

			return resource;
		}
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

	it('fails if validateFunc is not a func', () => setServer({ validateFunc: 'not a function' })
			.then(() => {
				throw new Error('should not fullfill');

			}, () => {}));

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
				addRoutes(server, user, resource);

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
						testResponse(200, res);
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
					method: 'GET', path: '/resource', handler: function () {
						return resource;
					}
				});

				return server.start()
					.then(() => server.inject('/resource'))
					.then(response => {
						let header, cookie;
						testResponse(401, response);
						response.result.message.should.be.eql('Bad Session');
						header = response.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'special=' + cookie[1] } });

					}).then(response => {
						testResponse(401, response);
						response.result.message.should.be.eql('Not authenticated');

					}).finally(() => server.stop());

			});
	});

	it('should work with encrypted cookies encrypts session cookie', () => {
		const user = { fake: 'user'};
		const resource = {fake: 'resource'};
		const sidLength = 10;
		return setServer({ ttl: 60 * 1000, sidLength, cookie: 'encrypted', password: 'test' + Array(32).join('a')})
			.then(server => {
				addRoutes(server, user, resource);


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
						cookie[1].should.startWith('Fe');
						cookie[1].length.should.be.above(sidLength * 4);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: 'encrypted=' + cookie[1] } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('should work with secret to create local HMAC of seesion id', () => {
		const user = { fake: 'user'};
		const resource = {fake: 'resource'};
		const sidLength = 12;
		const cache  = {
			_cache : [],
			async set (key, value/*, ttl*/) {
				this._cache[key] = value;
				return true;
			},
			async get (key) {
				return this._cache[key];
			},
			async drop (key) {
				delete this._cache[key];
				return true;
			}
		};
		const hmacAlgo = 'sha1';
		const secret   = 'secret';
		return setServer({ ttl: 60 * 1000, sidLength, secret, cache, hmacAlgo})
			.then(server => {
				addRoutes(server, user, resource);


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
						cookie[1].length.should.be.eql(Math.ceil(sidLength / 3 * 4));
						cache._cache.should.not.containEql(cookie[1]);
						cache._cache.should.not.containEql(res.request.auth.session.id);
						res.request.auth.session.id.should.be.eql(
							crypto.createHmac(hmacAlgo, secret)
								.update(cookie[1])
								.update(res.request.info.remoteAddress)
								.update(res.request.headers['user-agent'])
								.digest('base64')
						);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: `sid=${cookie[1]}` } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('should create HMAC with custom hmacAlgo and hmacRequest', () => {
		const user = { fake: 'user'};
		const resource = {fake: 'resource'};
		const sidLength = 12;
		const cache  = {
			_cache : [],
			async set (key, value/*, ttl*/) {
				this._cache[key] = value;
				return true;
			},
			async get (key) {
				return this._cache[key];
			},
			async drop (key) {
				delete this._cache[key];
				return true;
			}
		};
		const hmacAlgo = 'sha256';
		const secret   = 'secret';
		return setServer({ ttl: 60 * 1000, sidLength, secret, cache, hmacAlgo, hmacRequest: ['headers.host']})
			.then(server => {
				addRoutes(server, user, resource);

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
						cookie[1].length.should.be.eql(Math.ceil(sidLength / 3 * 4));
						cache._cache.should.not.containEql(cookie[1]);
						cache._cache.should.not.containEql(res.request.auth.session.id);
						res.request.auth.session.id.should.be.eql(
							crypto.createHmac(hmacAlgo, secret)
								.update(cookie[1])
								.update(res.request.headers.host)
								.digest('base64')
						);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: `sid=${cookie[1]}` } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('should create HMAC with nonexisting  and custom headers', () => {
		const user = { fake: 'user'};
		const resource = {fake: 'resource'};
		const sidLength = 12;
		const cache  = {
			_cache : [],
			async set (key, value/*, ttl*/) {
				this._cache[key] = value;
				return true;
			},
			async get (key) {
				return this._cache[key];
			},
			async drop (key) {
				delete this._cache[key];
				return true;
			}
		};
		const hmacAlgo = 'sha1';
		const secret   = 'secret';
		return setServer({ ttl: 60 * 1000, sidLength, secret, cache, hmacAlgo, hmacRequest: ['headers.nonexisting', 'headers.x-custom']})
			.then(server => {
				addRoutes(server, user, resource);

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
						cookie[1].length.should.be.eql(Math.ceil(sidLength / 3 * 4));
						cache._cache.should.not.containEql(cookie[1]);
						cache._cache.should.not.containEql(res.request.auth.session.id);
						res.request.auth.session.id.should.be.eql(
							crypto.createHmac(hmacAlgo, secret)
								.update(cookie[1])
								.digest('base64')
						);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: `sid=${cookie[1]}` } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					})
					.then(() => server.inject({ method: 'GET', url: '/login/valid', headers: { nonexisting: '' } }))
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						cookie[1].length.should.be.eql(Math.ceil(sidLength / 3 * 4));
						cache._cache.should.not.containEql(cookie[1]);
						cache._cache.should.not.containEql(res.request.auth.session.id);
						res.request.auth.session.id.should.be.eql(
							crypto.createHmac(hmacAlgo, secret)
								.update(cookie[1])
								.digest('base64')
						);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: `sid=${cookie[1]}` } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					})
					.then(() => server.inject({ method: 'GET', url: '/login/valid', headers: { 'X-custom': `custom-${Math.random()}` } }))
					.then(res => {
						let header, cookie;
						should.exist(res);
						res.result.should.be.equal('valid');
						header = res.headers['set-cookie'];
						header.length.should.be.equal(1);
						header[0].should.match(/Max-Age=60/);
						cookie = header[0].match(cookieRegex);
						cookie[1].length.should.be.eql(Math.ceil(sidLength / 3 * 4));
						cache._cache.should.not.containEql(cookie[1]);
						cache._cache.should.not.containEql(res.request.auth.session.id);
						res.request.auth.session.id.should.be.eql(
							crypto.createHmac(hmacAlgo, secret)
								.update(cookie[1])
								.update(res.request.headers['x-custom'])
								.digest('base64')
						);
						return server.inject({ method: 'GET', url: '/resource', headers: { cookie: `sid=${cookie[1]}`, 'X-custom': res.request.headers['x-custom'] } });
					}).then(res => {
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('should fail start if hmacAlgo is not supported', () => {
		const hmacAlgo = 'no-such-algo';
		const secret   = 'secret';
		return setServer({ secret, hmacAlgo })
			.should.be.rejectedWith(`Node install does not seem to support HMAC using algorithm ${hmacAlgo}`);
	});

	it('ends a session', () => {
		let user = { fake: 'user'},
			cookie;
		return setServer({ ttl: 60 * 1000, cookie: 'special'})
			.then(server => {
				addLoginRoute(server, user);

				server.route({
					method: 'GET', path: '/logout', handler: async function (request) {
						await request.auth.session.clear();
						return 'logged-out';
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
						testResponse(200, res);
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
						testResponse(401, res);

					}).finally(() => server.stop());

			});

	});

	it('clear session on invalid id', () => setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true})
			.then(server => {
				const id = '123456';
				server.route({
					method: 'GET', path: '/', handler: () => 'ok'
				});


				return server.start()
					.then(() => server.inject({url: '/',  headers: { cookie: `special=${id}` }}))
					.then(res => {
						let cookie,
							header;
						should.exist(res);
						testResponse(401, res);
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
			validateFunc = sinon.stub()
				.resolves([false])
				.withArgs(creds).resolves([true, newCreds]);

		return setServer({ ttl: 60 * 1000, cookie: 'special', validateFunc: validateFunc})
			.then(server => {
				server.route({
					method: 'GET', path: '/login/{user}',
					config: {
						auth: { mode: 'try' },
						handler: async function (request) {
							user.name = request.params.user;
							await request.auth.session.set(creds);
							return user.name;

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.be.eql(newCreds);
						return resource;
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
						testResponse(200, res);
						should.not.exist(res.headers['set-cookie']);
						res.result.should.be.equal(resource);

					}).finally(() => server.stop());

			});
	});

	it('fails a request with invalid session', () => {
		let user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		function validateFunc (request, session) {
			const override = hoek.clone(session);
			override.something = 'new';
			return [session.user === 'valid', override];
		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: true, validateFunc: validateFunc})
			.then(server => {
				addRoutes(server, user, resource);

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
						testResponse(401, response);
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

		function validateFunc (request, session) {
			const override = hoek.clone(session);
			override.something = 'new';

			return [session.user === 'valid', override];
		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', clearInvalid: false, validateFunc: validateFunc})
			.then(server => {
				addRoutes(server, user, resource);

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
						testResponse(401, res);
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
						handler: async function (request) {
							await request.auth.session.set({ user: hoek.merge({name: request.params.user}, user)});
							return request.params.user;

						}
					}
				});

				server.route({
					method: 'GET', path: '/resource', handler: function (request) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user');
						request.auth.credentials.user.should.have.property('name', name);
						return resource;
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
						testResponse(200, res);
						res.result.should.be.equal(resource);
					}).finally(() => server.stop());

			});

	});

	it('errors in validation function', () => {
		let name = 'steve',
			user = { fake: 'user'},
			resource = { fake: 'resource'},
			cookie;

		function validateFunc (/*request, session*/) {
			throw new Error('boom');

		}

		return setServer({ ttl: 60 * 1000, cookie: 'special', validateFunc: validateFunc})
			.then(server => {
				addRoutes(server, user, resource);

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
						testResponse(401, res);
					}).finally(() => server.stop());

			});

	});

	it('authenticates a request (session cookie)', () => {
		let name     = 'steve',
			user     = { fake: 'user'};

		return setServer({ cookie: 'special', sessionCookie: true})
			.then(server => {
				addLoginRoute(server, user);

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
						handler: async function (request) {
							user.name = request.params.user;
							await request.auth.session.set({ user: user });
							return user.name;

						}
					}
				});

				server.route({
					method: 'GET', path: `${path}/resource`, handler: function (request) {
						should.exist(request.auth.credentials);
						request.auth.credentials.should.have.property('user', user);

						return resource;
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
						testResponse(200, res);
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
						handler: async function (request) {
							try {
								await request.auth.session.set(undefined);
								return 'ok';
							} catch (e) {
								return e.message || 'ok';
							}

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
				set: function (key, value/*, ttl*/) {
					_cache[key] = value;
					return true;
				},
				get: function (key) {
					return _cache[key];
				},
				drop: function (key) {
					delete _cache[key];
					return true;
				}
			};

		return setServer({ ttl: 60 * 1000, cookie: 'special', cache: cache})
			.then(server => {
				addLoginRoute(server, user);

				server.route({
					method: 'GET', path: '/clearKey', handler: async function (request) {
						await request.auth.session.clear();
						return null;
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
								testResponse(200, res);
								should(_cache).not.have.property(cookie[1]);

							});

					}).finally(() => server.stop());

			});
	});

});

describe('redirection', () => {

	it('sends to login page (uri without query)', () => setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: 'http://example.com/login', appendNext: true})
			.then(server => {
				server.route({
					method: 'GET', path: '/', handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(302, res);
						res.headers.should.have.property('location', 'http://example.com/login?next=%2F');

					}).finally(() => server.stop());

			}));

	it('sends to login page (uri with query)', () => setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: true
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(302, res);
						res.headers.should.have.property('location', 'http://example.com/login?mode=1&next=%2F');

					}).finally(() => server.stop());

			}));

	it('skips when redirectTo is set to false', () => setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: false, appendNext: true})
			.then(server => {
				server.route({
					method: 'GET', path: '/', handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(401, res);

					}).finally(() => server.stop());

			}));

	it('skips when route override', () => setServer({ ttl: 60 * 1000, cookie: 'special', redirectTo: 'http://example.com/login', appendNext: true})
			.then(server => {
				server.route({
					method: 'GET',
					path: '/',
					handler: () => 'never',
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
						testResponse(401, res);

					}).finally(() => server.stop());

			}));

	it('skips when redirectOnTry is false in try mode', () => setServer({ ttl: 60 * 1000, cookie: 'special', redirectOnTry: false, redirectTo: 'http://example.com/login', appendNext: true})
			.then(server => {
				server.route({
					method: 'GET',
					path: '/',
					config: {
						auth: { mode: 'try' }
					},
					handler: function (request) {
						return request.auth.isAuthenticated;

					}
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(200, res);
						res.result.should.be.equal(false);

					}).finally(() => server.stop());

			}));


	it('sends to login page and does not append the next query when appendNext is false', () => setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: false
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(302, res);
						res.headers.should.have.property('location', 'http://example.com/login?mode=1');

					}).finally(() => server.stop());

			}));

	it('appends the custom query when appendNext is string', () => {
		let next = 'done';
		return setServer({
				ttl       : 60 * 1000,
				cookie    : 'special',
				redirectTo: 'http://example.com/login?mode=1',
				appendNext: next
			}).then(server => {
				server.route({
					method: 'GET', path: '/', handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(302, res);
						res.headers.should.have.property('location', `http://example.com/login?mode=1&${next}=%2F`);

					}).finally(() => server.stop());

			});
	});

	it('redirect on try', () => setServer({
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
					handler: () => 'never'
				});


				return server.start()
					.then(() => server.inject('/'))
					.then(res => {
						testResponse(302, res);

					}).finally(() => server.stop());

			}));
});