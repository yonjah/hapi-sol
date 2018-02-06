/* globals describe, before, it, beforeEach*/
"use strict";
const should = require('should');
const sol    = require('../');
const hapi   = require('hapi');

let port = 3000;

describe('Sol Server Auth', function () {
	const options = {};
	const server  = new hapi.Server({ port: ++port });

	let call    = false;

	before(async function () {
		await server.register(sol);
		server.auth.strategy('session', 'session', options);
		server.auth.default('session');
		server.route([
			{
				method: 'GET',
				path: '/',
				config: {
					handler: function () {
						call = true;
						return null;
					}
				}
			}, {
				method: 'GET',
				path: '/login',
				config: {
					handler: async function (request) {
						if (!request.auth.credentials) {
							await request.auth.session.set({ fake: 'creds'});
						}
						return null;
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
					handler: async function (request) {
						await request.auth.session.clear();
						return null;
					},
					auth: {
						strategy: 'session',
						mode    : 'try'
					}
				}
			}
		]);
		await server.start();
	});

	after(async function () {
		await server.stop();
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