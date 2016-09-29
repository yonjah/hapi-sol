/* globals describe, before, it*/
"use strict";
var Promise      = require('bluebird'),
	should       = require('should'),
	sinon        = require('sinon'),
	sol          = require('../'),
	uidGenerator = require(process.env.COVER === 'SOL' ? '../lib-cov/uidGenerator' : '../lib/uidGenerator');

require('should-sinon');

describe('Sol lib', function () {

	describe('onPreAuth', function () {
		var implement,
			events = {},
			fakePlugin = {
				auth: {
					scheme: function (id, func) {
						implement = func;
					}
				}
			},
			cache = {
				set : sinon.stub(),
				drop: sinon.stub(),
				get : sinon.stub()
			},
			fakeServer = {
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
			}, settings = {
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
			},
			func;

		before(function (done) {
			sol.register(fakePlugin, {}, function () {
				implement(fakeServer, {});
				func = events.onPreAuth;
				done();
			});
		});

		it('should register session auth functions on request', function (done) {
			var request = { auth: {}};
			func(request, {continue: function () {
				request.auth.should.have.property('session');
				request.auth.session.should.have.keys('getId', 'setSession', 'getSession' , 'set', 'clear');

				done();
			}});

		});

		describe('session.getId', function () {
			const events = {};
			const fakePlugin = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				}
			};
			const cache = {
				set : sinon.stub(),
				drop: sinon.stub(),
				get : sinon.stub()
			};
			const fakeServer = {
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

			let implement,
				session;


			before(function (done) {
				sol.register(fakePlugin, {}, function () {
					implement(fakeServer, settings);
					events.onPreAuth(request, {continue: function () {
						request.auth.should.have.property('session');
						session = request.auth.session;
						done();
					}});
				});

			});


			it('should return session id if valid', function () {
				session.getId().should.be.eql(sid);
			});

			it('should return null if session id is not valid', function () {
				request.state.sid = {fake: 'not valid session'};
				should.not.exist(session.getId());
			});

		});

		describe('session.clear', function () {
			const events = {};
			const fakePlugin = {
				auth: {
					scheme (id, func) {
						implement = func;
					}
				}
			};
			const cache = {
				set : sinon.stub().yields(null, true),
				drop: sinon.stub().yields(null, true),
				get : sinon.stub().yields(null, true)
			};
			const fakeServer = {
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
			const reply = {
				unstate: sinon.stub(),
				state: sinon.stub()
			};

			const request = { state: {sid: sid}, auth: {}};

			let implement,
				session;


			before(function (done) {
				sol.register(fakePlugin, {}, function () {
					implement(fakeServer, settings);
					reply.continue = () => {
						request.auth.should.have.property('session');
						session = request.auth.session;
						done();
					};
					events.onPreAuth(request, reply);
				});

			});


			it('should destroy session and replace id', function () {
				cache.drop.yields(null, true);

				return session.clear()
					.then(() => {
						let id = session.getId();
						should.exist(id);
						id.should.not.be.eql(sid);
						reply.unstate.should.be.calledWith(settings.cookie);
						reply.state.should.be.calledWith(settings.cookie, id);
					});
			});

			it('should not drop session if no sid', function () {
				var ses = {fake: 'session'};
				request.state.sid = {fake: 'not valid session'};
				cache.drop.yields(new Error('fake Error'));
				cache.set.yields(null, ses);
				return session.clear()
					.then(res => {
						res.should.be.eql(ses);
					}).should.be.fulfilled();
			});

		});

		describe('session.getSession', function () {
			var implement,
				events = {},
				fakePlugin = {
					auth: {
						scheme (id, func) {
							implement = func;
						}
					}
				},
				cache = {
					set : sinon.stub(),
					drop: sinon.stub(),
					get : sinon.stub()
				},
				fakeServer = {
					cache () {
						return cache;
					},
					state () {},
					ext (eventKey, func) {
						events[eventKey] = func;
					}
				},
				settings = {},
				session,
				sid = Math.random().toString(32).substr(2, 10),
				request = { state: {sid: sid}, auth: {}};

			before(function (done) {
				sol.register(fakePlugin, {}, function () {
					implement(fakeServer, settings);
					events.onPreAuth(request, {continue: function () {
						request.auth.should.have.property('session');
						session = request.auth.session;
						done();
					}});
				});

			});

			it('should be call cache.get with sid and resolve with Promise/callbacks', function (done) {
				var res = {fake: 'cache'};
				cache.get.yields(null, res, {item: res});
				return session.getSession()
					.then(function (item) {
						cache.get.should.be.calledWith(sid);
						item.should.be.eql(res);
						session.getSession(function (err, item) {
							try {
								should.not.exist(err);
								item.should.be.eql(res);
								done();
							} catch (e) {
								done(e);
							}
						});
					}).catch(done);
			});

			it('should reject with Promise/callbacks', function (done) {
				var res = new Error('FAKE ERROR');
				cache.get.yields(res);


				return session.getSession()
					.then(function () {
						throw new Error('Promise Should not be resolved');
					}, function (err) {
						err.cause.should.be.eql(res);
						session.getSession(function (err, item) {
							try {
								err.cause.should.be.eql(res);
								should.not.exist(item);
								done();
							} catch (e) {
								done(e);
							}
						});
					}).catch(done);
			});


			it('should not be called with bad sid', function () {
				var res = new Error('FAKE ERROR');
				cache.get.yields(res);

				request.state.sid = {fake: 'not valid session'};

				return session.getSession()
					.then(function (res) {
						should.not.exist(res);
					});
			});

		});


		describe('session.setSession', function () {
			var implement,
				events = {},
				fakePlugin = {
					auth: {
						scheme (id, func) {
							implement = func;
						}
					}
				},
				cache = {
					set : sinon.stub(),
					drop: sinon.stub(),
					get : sinon.stub()
				},
				fakeServer = {
					cache () {
						return cache;
					},
					state () {},
					ext (eventKey, func) {
						events[eventKey] = func;
					}
				},
				settings = {},
				session,
				sid = Math.random().toString(32).substr(2, 10);

			before(function (done) {
				var request = { state: {sid: sid}, auth: {}};
				sol.register(fakePlugin, {}, function () {
					implement(fakeServer, settings);
					events.onPreAuth(request, {continue: function () {
						request.auth.should.have.property('session');
						session = request.auth.session;
						done();
					}});
				});

			});


			it('should be call cache.set with sid and resolve with Promise/callbacks', function (done) {
				let ses = {fake: 'session'};
				cache.set.yields(null, ses);
				return session.setSession(ses)
					.then(function (item) {
						cache.set.should.be.calledWith(sid, ses);
						item.should.be.eql(ses);
						ses = {fake: 'session2'};
						cache.set.yields(null, ses);
						session.setSession(ses, function (err, item) {
							try {
								should.not.exist(err);
								item.should.be.eql(ses);
								done();
							} catch (e) {
								done(e);
							}
						});
					}).catch(done);
			});

			it('should reject with Promise/callbacks', function (done) {
				const res = new Error('FAKE ERROR');
				let ses = {fake: 'session'};
				cache.set.yields(res);


				return session.setSession(ses)
					.then(function () {
						throw new Error('Promise Should not be resolved');
					}, function (err) {
						err.cause.should.be.eql(res);
						session.setSession(ses, function (err, item) {
							try {
								err.cause.should.be.eql(res);
								should.not.exist(item);
								done();
							} catch (e) {
								done(e);
							}
						});
					}).catch(done);
			});

		});


	});

	describe('uidGenerator', function () {
		it('should return a function that generates uid', function () {
			uidGenerator().should.be.a.Function();
		});

		describe('generator', function () {
			it('should return a promise', function () {
				uidGenerator(1, 0)().should.be.instanceof(Promise);
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

			it('should reject if uid exist and no more tries', function () {
				const generator = uidGenerator(1, 0);
				let uids = 0;
				function recGen () {
					return generator()
						.then(() => {
							uids++;
							if (uids < 256) {
								return recGen();
							}
						});
				}

				return recGen().should.be.rejected();
			});

			it('should never return the same uid', function () {
				const generator = uidGenerator(1, 1000);
				const uids = [];

				function recGen () {
					return generator()
						.then(uid => {
							uids.indexOf(uid).should.be.eql(-1);
							uids.push(uid);
							if (uids.length < 256) {
								return recGen();
							}
						});
				}

				return recGen();
			});
		});
	});

});