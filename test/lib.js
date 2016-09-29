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
				implement(fakeServer, settings);
				func = events.onPreAuth;
				done();
			});
		});

		it('should register session auth functions on request', function (done) {
			var request = { auth: {}};
			func(request, {continue: function () {
				request.auth.should.have.property('session');
				request.auth.session.should.have.keys('set', 'get', 'clear');

				done();
			}});

		});


		describe('session.get', function () {
			var session,
				sid = {fake: 'sid'};
			before(function (done) {
				var request = { state: {sid: sid}, auth: {}};
				func(request, {continue: function () {
					request.auth.should.have.property('session');
					session = request.auth.session;
					done();
				}});

			});

			it('should resolve with Promise/callbacks', function (done) {
				var res = {fake: 'cache'};
				cache.get.yields(null, res, {item: res});
				return session.get()
					.then(function (item) {
						item.should.be.eql(res);
						session.get(function (err, item) {
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


				return session.get()
					.then(function () {
						throw 'Promise Should not be resolved';
					}, function (err) {
						err.cause.should.be.eql(res);
						session.get(function (err, item) {
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