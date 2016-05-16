/* globals describe, before, it*/
"use strict";
var should  = require('should'),
	sinon   = require('sinon'),
	sol     = require('../');

describe('Sol lib', function () {
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
			};

	before(function (done) {
		sol.register(fakePlugin, {}, function () {
			implement(fakeServer, settings);
			done();
		});
	});

	describe('onPreAuth', function () {
		var func;
		before(function () {
			func = events.onPreAuth;

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

});