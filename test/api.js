/* globals describe, it*/
"use strict";
const sol  = require('../');
const name = 'sol';
const id   = 'session';
const should = require('should');


describe('Sol Plugin API', function () {
	it('should expose a register function', function () {
		sol.should.have.property('register');
		sol.register.should.be.a.Function;
	});

	it('should have the name `sol`', function () {
		sol.should.have.property('name', name);
	});

	describe('Register function', function () {
		it('should register the Scheme', function () {
			let schemeCall = false;

			sol.register({
				auth: {
					scheme: function (schemeId, func) {
						schemeCall = true;
						schemeId.should.be.eql(id);
						should.exist(func);
						func.should.be.Function();
					}
				}
			});
			schemeCall.should.be.ok();

		});

	});

	describe('Implement function', function () {
		var implement,
			events = {},
			fakeServer = {
				auth: {
					scheme: function (id, func) {
						implement = func;
					}
				},
				cache: function (options) {
					options.segment.should.be.eql(settings.cacheId);
					options.expiresIn.should.be.eql(settings.ttl);
					return {
						set : function () {},
						drop: function () {},
						get : function () {}
					};
				},
				state: function (cookieId, options) {
					cookieId.should.be.eql(settings.cookie);
					options.encoding.should.be.eql('none');
					options.ttl.should.be.eql(settings.ttl);
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
				isSecure     : true,
				isHttpOnly   : true,
				redirectOnTry: true,
				redirectTo   : '',
				validateFunc : undefined,
				appendNext   : '',
				path         : '/'
			};

		sol.register(fakeServer, {}, function () {});

		it('should return a scheme', function () {
			var scheme = implement(fakeServer, settings);
			scheme.should.be.an.Object;
			scheme.authenticate.should.be.a.Function;
		});
	});
});