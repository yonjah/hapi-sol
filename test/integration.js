/* globals describe, before, it, beforeEach*/
"use strict";
const {fork}   = require('child_process');
const should   = require('should');
const sol      = require('../');
const hapi     = require('hapi');
const RlClient = require('ralphi-client');


let port = 3000;

describe('Sol Integration', () => {
	const server   = new hapi.Server({ port: ++port });
	const rlClient = new RlClient();
	const options  = { rlClient };
	const rlSize   = 2;
	let ralphi,
		call = false;

	before(async () => {
		const rlReady = new Promise((resolve) => {
			ralphi = fork('node_modules/.bin/ralphi', [`session,${rlSize},1m`], {silent: true});
			ralphi.on('error', (err) => {
				throw new Error(err);
			});
			ralphi.on('close', (code) => {
				if (code > 0) {
					throw new Error(`ralphi server process exited with code ${code}`);
				}
			});
			ralphi.stdout.on('data', () => {
				resolve(true);
			});
			ralphi.stderr.on('data', (err) => {
				throw new Error(err.toString());
			});
		});
		await rlReady;
		await server.register(sol);
		server.auth.strategy('session', 'session', options);
		server.auth.default('session');
		server.route([
			{
				method: 'GET',
				path: '/',
				config: {
					handler: () => {
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

	after(async () => {
		ralphi.kill();
		await server.stop();
	});

	beforeEach(async () => {
		call = false;
		await rlClient.reset('session', '127.0.0.1');
	});

	it('should not give access to route without auth', () => {
		return server.inject({url : '/'})
			.then(function (response) {
				response.statusCode.should.be.eql(401);
				call.should.not.be.ok;
			});
	});

	it('should give access after login', () => {
		return server.inject({url : '/login'})
			.then(function (response) {
				var cookie;
				response.statusCode.should.be.eql(200);
				should(response.headers).have.property('set-cookie');
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

	it('should reject access after logout', () => {
		var cookie;
		return server.inject({url : '/login'})
			.then(function (response) {
				response.statusCode.should.be.eql(200);
				should(response.headers).have.property('set-cookie');
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

	it('should take one token on failed access', async () => {
		const response = await server.inject('/');
		response.statusCode.should.be.eql(401);
		const limit = await rlClient.query('session', '127.0.0.1');
		limit.should.have.property('remaining', rlSize - 1);
	});

	it('should prevent login if rate limit reached', async () => {
		let limit;
		for (let i = 0; i < rlSize ; i += 1) {
			limit = await rlClient.take('session', '127.0.0.1');
		}
		const response = await server.inject('/login');
		response.statusCode.should.be.eql(429);
		should(response.headers).have.property('x-ratelimit-limit', limit.size);
		should(response.headers).have.property('x-ratelimit-remaining', limit.remaining);
		should(response.headers).have.property('x-ratelimit-reset', limit.ttl);
	});
});