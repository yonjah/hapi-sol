/* globals describe, before, after, it, beforeEach*/
"use strict";
require('should');
var sol     = require('../'),
	hapi    = require('hapi'),
	Promise = require("bluebird"),
	port    = 3000,
	name    = 'sol',
	id      = 'session';


function replaceInject (server) {
	var inject  = server.inject;
	server.inject = function (options) {
		return new Promise(function (resolve) {
			inject.call(server, options, resolve);
		});
	};
};

describe('Sol Server Auth', function(){
	var call    = false,
		options = {},
		server  = new hapi.Server();

	server.connection({ port: ++port });
	replaceInject(server);

	before(function (done) {
		server.register(sol, function (err) {
			server.auth.strategy('session', 'session', true, options);
			server.route([{
				method: 'GET',
				path: '/',
				config: {
					handler: function (request, reply) {
						call=true;
						reply();
					}
				}
			}]);
			server.start(done);
		});
	});

	it('should not give access to route without auth', function (){
		return server.inject({url : '/'}).then(function () {
			call.should.not.be.ok;
		});
	});

	it('should not give access to route with fake auth', function (){
		return server.inject({url : '/'}).then(function () {
			call.should.not.be.ok;
		});
	});
});