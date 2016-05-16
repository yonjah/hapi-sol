/* globals describe, before, it, beforeEach*/
"use strict";
var should  = require('should'),
	sol     = require('../'),
	hapi    = require('hapi'),
	Promise = require("bluebird"),
	port    = 3000;


function replaceInject (server) {
	var inject  = server.inject;
	server.inject = function (options) {
		return new Promise(function (resolve) {
			inject.call(server, options, resolve);
		});
	};
}

describe('Sol Server Auth', function () {
	var call    = false,
		options = {},
		server  = new hapi.Server();

	server.connection({ port: ++port });
	replaceInject(server);

	before(function (done) {
		server.register(sol, function (/*err*/) {
			server.auth.strategy('session', 'session', true, options);
			server.route([
				{
					method: 'GET',
					path: '/',
					config: {
						handler: function (request, reply) {
							call = true;
							reply();
						}
					}
				}, {
					method: 'GET',
					path: '/login',
					config: {
						handler: function (request, reply) {
							if (!request.auth.credentials) {
								return request.auth.session.set({ fake: 'creds'})
									.then(reply);
							}
							reply();
						},
						auth: {
							strategy: 'session',
							mode    : 'try'
						}
					}
				}, {
					method: 'GET',
					path: '/logout',
					config: {
						handler: function (request, reply) {
							return request.auth.session.clear()
								.then(reply);
						},
						auth: {
							strategy: 'session',
							mode    : 'try'
						}
					}
				}
			]);

			server.start(done);
		});
	});

	beforeEach(function () {
		call = false;
	});

	it('should not give access to route without auth', function () {
		return server.inject({url : '/'})
			.then(function (response) {
				response.statusCode.should.be.eql(401);
				call.should.not.be.ok;
			});
	});

	it('should give access after login', function () {
		return server.inject({url : '/login'})
			.then(function (response) {
				var cookie;
				response.statusCode.should.be.eql(200);
				response.headers.should.have.property('set-cookie');
				response.headers['set-cookie'].should.have.length(1);
				cookie = response.headers['set-cookie'][0].split(';')[0];
				should.exist(cookie);
				return server.inject({
					url : '/',
					headers: {Cookie: cookie + ';'}
				});
			}).then(function (response) {
				response.statusCode.should.be.eql(200);
				call.should.be.ok;
			});
	});


	it('should reject access after logout', function () {
		var cookie;
		return server.inject({url : '/login'})
			.then(function (response) {
				response.statusCode.should.be.eql(200);
				response.headers.should.have.property('set-cookie');
				response.headers['set-cookie'].should.have.length(1);
				cookie = response.headers['set-cookie'][0].split(';')[0];
				should.exist(cookie);
				return server.inject({
					url : '/logout',
					headers: {Cookie: cookie + ';'}
				});
			}).then(function (response) {
				response.statusCode.should.be.eql(200);
				return server.inject({
					url : '/',
					headers: {Cookie: cookie + ';'}
				});
			}).then(function (response) {
				response.statusCode.should.be.eql(401);
				call.should.not.be.ok;
			});
	});
});