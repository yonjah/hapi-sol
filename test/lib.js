/* globals describe, before, after, it, beforeEach*/
"use strict";
require('should');
var sol     = require('../'),
	name    = 'sol',
	id      = 'session';

describe('Sol', function(){
	it('should expose a register function', function (){
		sol.register.should.be.a.Function;
	});
	it('should have the name attribute `sol`', function (){
		sol.register.attributes.should.be.ok;
		sol.register.attributes.name.should.be.eql(name);
	});

	describe('Register function', function(){
		var schemeCall = false,
			schemeId   = null,
			schemeFunc = null,
			fakePlugin = {
				auth: {
					scheme: function (id, func){
						schemeCall = true;
						schemeId   = id;
						schemeFunc = func;
					}
				}
			};


		it('should register the Scheme', function (){
			var nextCall = false;
			sol.register(fakePlugin, {}, function(){
				nextCall = true;
			});

			nextCall.should.be.ok;
			schemeCall.should.be.ok;
			schemeId.should.be.eql(id);
			schemeFunc.should.be.a.Function;
		});
	});
	describe('Implement function', function(){
		var implement,
			events = {},
			fakePlugin = {
				auth: {
					scheme: function (id, func){
						implement = func;
					}
				}
			}, fakeServer = {
				cache: function (cacheId, options) {
					cacheId.should.be.eql(settings.cacheId);
					options.expiresIn.should.be.eql(settings.ttl);
					return  {
						set : function (){},
						drop: function (){},
						get : function (){}
					};
				},
				state: function(cookieId, options){
					cookieId.should.be.eql(settings.cookie);
					options.encoding.should.be.eql(settings.password ? 'iron' : 'none');
					options.ttl.should.be.eql(settings.ttl);
					(options.password === settings.password ).should.be.ok;
					options.isSecure.should.be.eql(settings.isSecure);
					options.isHttpOnly.should.be.eql(settings.isHttpOnly);
					options.path.should.be.eql(settings.path);
				},
				ext: function(eventKey, func) {
					func.should.be.a.Function
					events[eventKey] = func;
				}
			}, settings= {
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


		it('should return a scheme', function (){
			sol.register(fakePlugin, {}, function(){});
			var scheme = implement(fakeServer, settings);
			scheme.should.be.an.Object;
			scheme.authenticate.should.be.a.Function;
		});
	});
});