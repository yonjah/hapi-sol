'use strict';
const crypto       = require('crypto');
const Promise      = require('bluebird');
const should       = require('should');
const sinon        = require('sinon');
const sol          = require('../');
const uidGenerator = require(process.env.COVER === 'SOL' ? '../lib-cov/uidGenerator' : '../lib/uidGenerator');

require('should-sinon');

describe('Sol lib', function () {

	describe('onPreAuth', function () {
		let implement;
		const events = {};
		const cache = {
			set : sinon.stub(),
			drop: sinon.stub(),
			get : sinon.stub()
		};
		const settings = {
			cacheId      : '_hapi_session',
			sidLength    : 36,
			uidRetries   : 5,
			clearInvalid : true,
			ttl          : 1000 * 60 * 60 * 24, // one day
			cookie       : 'sid',
			assumePromise: false,
			isSecure     : true,
			isHttpOnly   : true,
			redirectOnTry: true,
			password     : undefined,
			redirectTo   : '',
			validateFunc : undefined,
			appendNext   : '',
			path         : '/'
		};
		const h = {
			continue: Symbol('continue')
		};
		const fakeServer = {
			auth: {
				scheme: function (id, func) {
					implement = func;
				}
			},
			cache: function (options) {
				options.segment.should.be.eql(settings.cacheId);
				options.expiresIn.should.be.eql(settings.ttl);
				return cache;
			},
			state: function (cookieId, options) {
				cookieId.should.be.eql(settings.cookie);
				options.encoding.should.be.eql(settings.password ? 'iron' : 'none');
				options.ttl.should.be.eql(settings.ttl);
				(options.password === settings.password).should.be.ok;
				options.isSecure.should.be.eql(settings.isSecure);
				options.isHttpOnly.should.be.eql(settings.isHttpOnly);
				options.path.should.be.eql(settings.path);
			},
			ext: function (eventKey, func) {
				func.should.be.a.Function;
				events[eventKey] = func;
			}
		};

		sol.register(fakeServer, {});
		implement(fakeServer, {});
		const func = events.onPreAuth;

		it('should register session auth functions on request', async function () {
			var request = { auth: {}};
			const res = await func(request, h);
			res.should.be.equal(h.continue);
			request.auth.should.have.property('session');
			request.auth.session.should.have.keys('getId', 'setSession', 'getSession' , 'set', 'clear');
		});

		describe('session.getId', function () {
			let implement;

			const events = {};
			const cache = {
				set : sinon.stub(),
				drop: sinon.stub(),
				get : sinon.stub()
			};
			const fakeServer = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				},
				cache () {
					return cache;
				},
				state () {},
				ext (eventKey, func) {
					events[eventKey] = func;
				}
			};
			const settings = {};
			const sid = Math.random().toString(32).substr(2, 10);

			const request = { state: {sid: sid}, auth: {}};

			sol.register(fakeServer, {});
			implement(fakeServer, settings);
			events.onPreAuth(request, {});
			request.auth.should.have.property('session');
			const session = request.auth.session;


			it('should return session id if valid', function () {
				session.getId().should.be.eql(sid);
			});

			it('should return null if session id is not valid', function () {
				request.state.sid = {fake: 'not valid session'};
				should.not.exist(session.getId());
			});

		});

		describe('session.getInternalId', function () {
			let implement;
			const cache = {
				set : sinon.stub(),
				drop: sinon.stub(),
				get : sinon.stub()
			};
			const events = {};
			const fakeServer = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				},
				cache () {
					return cache;
				},
				state () {},
				ext (eventKey, func) {
					events[eventKey] = func;
				}
			};

			describe('with secret',  () => {
				const hmacAlgo = 'sha1';
				const secret   = 'secretDoNotTell!';
				const settings = { hmacAlgo, secret, hmacRequest: null };
				const sid = Math.random().toString(32).substr(2, 10);
				const request = { state: {sid: sid}, auth: {}};
				sol.register(fakeServer, {});
				implement(fakeServer, settings);
				events.onPreAuth(request, {});
				request.auth.should.have.property('session');
				const session = request.auth.session;
				beforeEach(() => {
					session.id = undefined;
				});

				it('should return HMAC session id if valid', function () {
					session.getInternalId().should.be.eql(crypto.createHmac(hmacAlgo, secret)
								.update(sid)
								.digest('base64'));
				});

				it('should return null if session id is not valid', function () {
					request.state.sid = {fake: 'not valid session'};
					should.not.exist(session.getInternalId());
				});
			});

			describe('without secret', () => {
				const settings = {};
				const sid = Math.random().toString(32).substr(2, 10);
				const request = { state: {sid: sid}, auth: {}};
				sol.register(fakeServer, {});
				implement(fakeServer, settings);
				events.onPreAuth(request, {});
				request.auth.should.have.property('session');
				const session = request.auth.session;
				beforeEach(() => {
					session.id = undefined;
				});

				it('should return public session id if valid', function () {
					session.getInternalId().should.be.eql(sid);
				});

				it('should return null if session id is not valid', function () {
					request.state.sid = {fake: 'not valid session'};
					should.not.exist(session.getInternalId());
				});
			});
		});

		describe('session.clear', function () {
			let implement;
			const events = {};
			const cache = {
				set : sinon.stub().resolves(true),
				drop: sinon.stub().resolves(true),
				get : sinon.stub().resolves(true)
			};
			const fakeServer = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				},
				cache () {
					return cache;
				},
				state () {},
				ext (eventKey, func) {
					events[eventKey] = func;
				}
			};
			const settings = { cookie: 'sid' };
			const sid = Math.random().toString(32).substr(2, 10);
			const h = {
				unstate: sinon.stub(),
				state: sinon.stub()
			};

			const request = { state: {sid: sid}, auth: {}};

			sol.register(fakeServer, {});
			implement(fakeServer, settings);

			events.onPreAuth(request, h);
			request.auth.should.have.property('session');
			const session = request.auth.session;

			it('should destroy session and replace id', async function () {
				cache.drop.resolves(true);

				await session.clear();
				let id = session.getId();
				should.exist(id);
				id.should.not.be.eql(sid);
				h.unstate.should.be.calledWith(settings.cookie);
				h.state.should.be.calledWith(settings.cookie, id);
			});

			it('should not drop session if no sid', async function () {
				var ses = {fake: 'session'};
				request.state.sid = {fake: 'not valid session'};
				cache.drop.rejects(new Error('fake Error'));
				cache.set.resolves(ses);
				const res = await session.clear();
				res.should.be.eql(ses);
			});

		});

		describe('session.getSession', function () {
			let implement;
			const events = {};
			const cache = {
				set : sinon.stub().resolves(true),
				drop: sinon.stub().resolves(true),
				get : sinon.stub().resolves(true)
			};
			const fakeServer = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				},
				cache () {
					return cache;
				},
				state () {},
				ext (eventKey, func) {
					events[eventKey] = func;
				}
			};
			const settings = { cookie: 'sid' };
			const sid = Math.random().toString(32).substr(2, 10);
			const h = {
				unstate: sinon.stub(),
				state: sinon.stub()
			};

			const request = { state: {sid: sid}, auth: {}};

			sol.register(fakeServer, {});
			implement(fakeServer, settings);

			events.onPreAuth(request, h);
			request.auth.should.have.property('session');
			const session = request.auth.session;

			beforeEach(() => {
				session.id = undefined;
			});

			it('should be call cache.get with sid and resolve with Promise', async function () {
				const res = {fake: 'cache'};
				cache.get.resolves(res);
				const item = await session.getSession();
				cache.get.should.be.calledWith(sid);
				item.should.be.eql(res);
			});

			it('should reject with Promise', async function () {
				const res = new Error('FAKE ERROR');
				cache.get.rejects(res);

				try {
					await session.getSession();
					throw new Error('Promise Should not be resolved');
				} catch (err) {
					err.should.be.eql(res);
				}
			});


			it('should not be called with bad sid', async function () {
				const err = new Error('FAKE ERROR');
				cache.get.rejects(err);

				request.state.sid = {fake: 'not valid session'};

				const res = await session.getSession();
				should.not.exist(res);
			});

		});


		describe('session.setSession', function () {
			let implement;
			const events = {};
			const cache = {
				set : sinon.stub().resolves(true),
				drop: sinon.stub().resolves(true),
				get : sinon.stub().resolves(true)
			};
			const fakeServer = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				},
				cache () {
					return cache;
				},
				state () {},
				ext (eventKey, func) {
					events[eventKey] = func;
				}
			};
			const settings = { cookie: 'sid' };
			const sid = Math.random().toString(32).substr(2, 10);
			const h = {
				unstate: sinon.stub(),
				state: sinon.stub()
			};

			const request = { state: {sid: sid}, auth: {}};

			sol.register(fakeServer, {});
			implement(fakeServer, settings);

			events.onPreAuth(request, h);
			request.auth.should.have.property('session');
			const session = request.auth.session;


			it('should be call cache.set with sid and resolve with Promise', async function () {
				let ses = {fake: 'session'};
				cache.set.resolves(ses);
				const item = await session.setSession(ses);
				cache.set.should.be.calledWith(sid, ses);
				item.should.be.eql(ses);
			});

			it('should reject with Promise', async function () {
				const res = new Error('FAKE ERROR');
				let ses = {fake: 'session'};
				cache.set.rejects(res);

				try {
					await session.setSession(ses);
					throw new Error('Promise Should not be resolved');
				} catch (err) {
					err.should.be.eql(res);
				}
			});

		});


	});

	describe('uidGenerator', function () {
		it('should return a function that generates uid', function () {
			uidGenerator().should.be.a.Function();
		});

		describe('generator', function () {
			it('should return a promise', function () {
				uidGenerator(1, 0)().should.be.instanceof(global.Promise);
			});

			it('should fulfill with the right len uid', function () {
				return Promise.all([
						uidGenerator(1, 0)(),
						uidGenerator(3, 0)(),
						uidGenerator(6, 0)()
					]).spread((uid1, uid2, uid3) =>  {
						uid1.should.have.length(4);
						uid1.substr(2, 2).should.be.eql('==');
						uid2.should.have.length(4);
						uid3.should.have.length(8);
					});
			});

			it('should reject if getRandomBytes fail and no more retries', function () {
				const error = new Error('no way');
				const getRandomBytes = sinon.stub().rejects(error);
				return uidGenerator(10, 0, getRandomBytes)()
					.should.be.rejectedWith(`too many tries: ${error.message}`);
			});

			it('should continue trying as long as retries are available', function () {
				const error = new Error('no way');
				const getRandomBytes = sinon.stub().rejects(error);
				return uidGenerator(10, 1, getRandomBytes)()
					.should.be.rejectedWith(`too many tries: ${error.message}`)
					.then(() => {
						getRandomBytes.should.have.been.calledTwice();
					});
			});

			it('should pass correct len to getRandomBytes', function () {
				const len = Math.ceil(Math.random() * 20);
				const getRandomBytes = sinon.stub().resolves(Buffer.alloc(len, 'a'));
				return uidGenerator(len, 1, getRandomBytes)()
					.then(() => {
						getRandomBytes.should.have.been.calledWith(len);
					});
			});
		});
	});

});