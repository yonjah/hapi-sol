"use strict";
var hoek     = require('hoek'),
	boom     = require('boom'),
	Promise  = require("bluebird"),
	crypt    = require('crypto'),
	defaults = {
		cacheId      : '_hapi_session',
		sidLength    : 36,
		uidRetries   : 5,
		clearInvalid : true,
		ttl          : 1000 * 60 * 60 * 24, // one day
		cookie       : 'sid',
		cache        : null,
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
	uid =  function (len, retries){
		var store = [];
		function get(counter, resolve, reject) {
			var id;
			counter++;
			if (counter > retries) {
				return reject('too many tries');
			}
			try {
				id = crypt.randomBytes(len).toString('base64');
			} catch(e) {
				//not enough entropy retry
				return setTimeout(get.bind(null, counter, resolve, reject), 10);
			}
			if (store.indexOf(id) >= 0) { //retry
				return get(counter, resolve, reject);
			}
			store.push(id);
			return resolve(id);
		}

		return function () {
			return new Promise(get.bind(null, 0));
		};
	};

function promisify (fn, cb) {
	var promise =  new Promise(fn);
	return typeof cb === 'function' ? promise.then(cb.bind(null), cb) : promise;
}

exports.register = function (plugin, options, next) {
	plugin.auth.scheme('session', implementation);
	next();
};


exports.register.attributes = {
	pkg: require('../package.json'),
	name: 'sol'
};

function AuthError(message) {
    this.name = 'AuthError';
    this.message = message;
    this.stack = (new Error()).stack;
}

AuthError.prototype = new Error();

var implementation = function (server, options) {
	var settings,
		cache,
		cacheGet,
		cacheSet,
		cacheDrop,
		cookieOptions,
		getSid,
		scheme;

	function setSession(request, reply, session, cb) {
		hoek.assert(session && typeof session === 'object', 'Invalid Session');

		return promisify(function (resolve, reject) {
			var sessionId = request.state[settings.cookie];
			if (sessionId && typeof sessionId === 'string') {
				return cacheSet(sessionId, session, 0).then(resolve, reject);
			}
			//we don't have a session id so we need to make one
			return getSid().then(function (sessionId) {
				reply.state(settings.cookie, sessionId);
				return cacheSet(sessionId, session, 0).then(resolve, reject);
			}, reject);
		}, cb);
	}

	function clearSession(request, reply, cb) {
		return promisify(function (resolve, reject) {
			var sessionId = request.state[settings.cookie];
			if (sessionId && typeof sessionId === 'string') {
				reply.unstate(settings.cookie);
				request.state[settings.cookie] = null; //invalidate SID
				return cacheDrop(sessionId).then(resolve, reject);
			}
			return resolve();
		}, cb);
	}

	function getSession (request, cb) {
		return promisify(function (resolve, reject) {
			var sessionId = request.state[settings.cookie];
			if (!sessionId) {
				return resolve(); //we don't have a session
			} else {
				return cacheGet(sessionId).spread(resolve).catch(reject);
			}
		}, cb);
	}

	function unauthenticated (request, reply, err, result) {
		var routeSettings = request.route.settings.plugins.session,
			uri = settings.redirectTo;

		err = err && boom.unauthorized(err);
		if (settings.redirectOnTry && request.auth.mode === 'try') {
			return reply(err, result);
		}

		if (routeSettings && routeSettings.redirectTo !== undefined) {
			uri = routeSettings.redirectTo;
		}

		if (!uri) {
			return reply(err, result);
		}

		if (settings.appendNext) {
			if (uri.indexOf('?') !== -1) {
				uri += '&';
			}
			else {
				uri += '?';
			}

			uri += settings.appendNext + '=' + encodeURIComponent(request.url.path);
		}

		return reply('You are being redirected...', result).redirect(uri);
	}

	hoek.assert(options, 'Missing cookie auth strategy options');
	hoek.assert(!options.validateFunc || typeof options.validateFunc === 'function', 'Invalid validateFunc method in figuration');
	hoek.assert(!options.appendNext || options.redirectTo, 'Cannot set appendNext without redirectTo');


	settings = hoek.clone(defaults);
	hoek.merge(settings, options);

	if (settings.cache) {
		cache = settings.cache;
		hoek.assert(typeof cache.set === 'function', 'Cache should have a set method');
		hoek.assert(typeof cache.get === 'function', 'Cache should have a get method');
		hoek.assert(typeof cache.drop === 'function', 'Cache should have a drop method');
	} else {
		cache = server.cache({segment: settings.cacheId, expiresIn: settings.ttl });
	}

	if (!settings.assumePromises || !settings.cache) {
		cacheGet  = Promise.promisify(cache.get.bind(cache));
		cacheSet  = Promise.promisify(cache.set.bind(cache));
		cacheDrop = Promise.promisify(cache.drop.bind(cache));
	} else {
		cacheGet  = cache.get.bind(cache);
		cacheSet  = cache.set.bind(cache);
		cacheDrop = cache.drop.bind(cache);
	}

	if (!settings.assumePromises && settings.validateFunc) {
		settings.validateFunc = Promise.promisify(settings.validateFunc);
	}


	cookieOptions = {
		encoding  : settings.password ? 'iron' : 'none',
		ttl       : settings.ttl,
		password  : settings.password,
		isSecure  : settings.isSecure,
		isHttpOnly: settings.isHttpOnly,
		path      : settings.path
	};

	getSid = uid(settings.sidLength, settings.uidRetries);

	server.state(settings.cookie, cookieOptions);


	server.ext('onPreAuth', function (request, reply) {
		request.auth.session = {
			get: function (cb) {
				getSession(request, cb);
			},
			set: function (credentials, cb) {
				hoek.assert(credentials === null || credentials, 'Invalid credentials');
				return getSession(request).then(function (session){
						session = session || {}; //if we don't have a session will make a new one

						if (!credentials) {
							session.authenticated = false;
						} else {
							session.authenticated = true;
							session.credentials = credentials;
						}
						return session;
					}).then(function (session){
						return setSession(request, reply, session, cb);
					});
			},
			clear: clearSession.bind(this, request, reply)
		};
		return reply.continue();
    });


	if (typeof settings.appendNext === 'boolean') {
		settings.appendNext = settings.appendNext ? 'next' : '';
	}

	scheme = {
		authenticate : function (request, reply) {
			var sessionId = request.state[settings.cookie],
				reject = unauthenticated.bind(this, request, reply);

			if (!sessionId || typeof sessionId !== 'string') {
				return setSession(
						request,
						reply,
						{ authenticated: false }
					).catch(server.log.bind(server, 'error'))
					.finally(reject.bind(this, 'No session'));
			} else {
				return cacheGet(sessionId)
					.spread(function (session, cached) {
						if (!session) {
							return clearSession(request, reply)
								.then(function (){
									throw new AuthError('Bad Session');
								});
						}
						if (!session.authenticated) {
							throw new AuthError('Not authenticated');
						}

						if (!settings.validateFunc) {
							return { credentials: session.credentials };
						}
						return settings
							.validateFunc(session.credentials)
							.spread(function (isValid, credentials) {
								if (!isValid) {
									throw new AuthError('Invalid credentials');
								}
								return credentials;
							}).catch(function (err){
								if (settings.clearInvalid) {
									return clearSession(
											request,
											reply
										).then(function (){
											throw err;
										});
								}
								throw err;
							}).then(function (credentials) {
								if (credentials && session.credentials !== credentials) {
									session.credentials = credentials;
									return setSession(
											request,
											reply,
											session
										).then(function () {
											return { credentials: session.credentials};
										});
								}
								return { credentials: session.credentials};
							});
					}).then(function (data){
						reply.continue(data);
					}).catch(function (err){
						if (!err instanceof AuthError) {
							server.log('error', err);
						}
						reject(err);
					});
			}
		}
	};

	return scheme;
};