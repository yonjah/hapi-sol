"use strict";
var hoek           = require('hoek'),
	joi            = require('joi'),
	boom           = require('boom'),
	Promise        = require('bluebird'),
	mkUidGenerator = require('./uidGenerator'),
	optionsSchema  = joi.object({
		cacheId      : joi.string().default('_hapi_session'),
		sidLength    : joi.number().integer().min(1).default(36),
		uidRetries   : joi.number().integer().min(1).default(5),
		clearInvalid : joi.boolean().default(true),
		ttl          : joi.number().integer().min(1).default(1000 * 60 * 60 * 24), // one day
		cookie       : joi.string().default('sid'),
		sessionCookie: joi.boolean().default(false),
		cache        : joi.object().keys({
			set: joi.func().required(),
			get: joi.func().required(),
			drop: joi.func().required()
		}).unknown(),
		assumePromise: joi.boolean().default(false),
		isSecure     : joi.boolean().default(true),
		isHttpOnly   : joi.boolean().default(true),
		redirectOnTry: joi.boolean().default(true),
		password     : joi.alternatives(joi.string(), joi.object().type(Buffer)),
		redirectTo   : joi.string().allow('', false, null).default(''),
		validateFunc : joi.func(),
		appendNext   : joi.alternatives(joi.string(), joi.boolean()).allow('', false, null).default(false),
		path         : joi.string().default('/')
	}),
	implementation;

function promisify (fn, cb) {
	var promise =  new Promise(fn);
	return typeof cb === 'function' ? promise.then(cb.bind(null, null), cb) : promise;
}

exports.register = function (plugin, options, next) {
	plugin.auth.scheme('session', implementation);
	next();
};


exports.register.attributes = {
	pkg: require('../package.json'),
	name: 'sol'
};

function AuthError (message) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
}

AuthError.prototype = Error.prototype;

implementation = function (server, options) {
	var result,
		settings,
		cache,
		cacheGet,
		cacheSet,
		cacheDrop,
		cookieOptions,
		getSid,
		scheme;

	function setSession (request, reply, session, cb) {
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

	function clearSession (request, reply, cb) {
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

		if (err instanceof AuthError) {
			err = boom.unauthorized(err.message);
		} else {
			err = boom.wrap(err);
		}

		if (settings.redirectOnTry === false && request.auth.mode === 'try') {
			return reply(err, null, result);
		}

		if (routeSettings && routeSettings.redirectTo !== undefined) {
			uri = routeSettings.redirectTo;
		}

		if (!uri) {
			return reply(err, null, result);
		}

		if (settings.appendNext) {
			if (uri.indexOf('?') !== -1) {
				uri += '&';
			} else {
				uri += '?';
			}

			uri += settings.appendNext + '=' + encodeURIComponent(request.url.path);
		}

		return reply('You are being redirected...', null, result).redirect(uri);
	}

	result = joi.validate(options || {}, optionsSchema);
	hoek.assert(!result.error, result.error);
	settings = result.value;

	if (settings.cache) {
		cache = settings.cache;
	} else {
		cache = server.cache({ segment: settings.cacheId, expiresIn: settings.ttl });
	}

	cacheGet  = cache.get.bind(cache);
	cacheSet  = cache.set.bind(cache);
	cacheDrop = cache.drop.bind(cache);

	if (!settings.assumePromise || !settings.cache) {
		cacheGet  = Promise.promisify(cacheGet, {multiArgs: true});
		cacheSet  = Promise.promisify(cacheSet);
		cacheDrop = Promise.promisify(cacheDrop);
	}

	if (!settings.assumePromise && settings.validateFunc) {
		settings.validateFunc = Promise.promisify(settings.validateFunc);
	}

	if (typeof settings.appendNext === 'boolean') {
		settings.appendNext = settings.appendNext ? 'next' : '';
	}

	cookieOptions = {
		encoding  : settings.password ? 'iron' : 'none',
		ttl       : settings.sessionCookie ? null : settings.ttl,
		password  : settings.password,
		isSecure  : settings.isSecure,
		isHttpOnly: settings.isHttpOnly,
		path      : settings.path
	};

	getSid = mkUidGenerator(settings.sidLength, settings.uidRetries);

	server.state(settings.cookie, cookieOptions);


	server.ext('onPreAuth', function (request, reply) {
		request.auth.session = {
			get: function (cb) {
				return getSession(request, cb);
			},
			set: function (credentials, cb) {
				return Promise.try(function () {
						hoek.assert(credentials === null || typeof credentials === 'object', 'Invalid credentials');
						return {
							authenticated: !!credentials,
							credentials: credentials
						};

					}).then(function (session) {
						return setSession(request, reply, session, cb);
					},  cb);
			},
			clear: clearSession.bind(this, request, reply)
		};
		return reply.continue();
	});



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
					.finally(reject.bind(this, new AuthError('Bad Session')));
			} else {
				return cacheGet(sessionId)
					.spread(function (session/*, cached*/) {
						if (!session) {
							return clearSession(request, reply)
								.then(function () {
									throw new AuthError('Bad Session');
								});
						}
						if (!session.authenticated) {
							throw new AuthError('Not authenticated');
						}

						if (!settings.validateFunc) {
							return { credentials: session.credentials, artifacts: session };
						}
						return settings
							.validateFunc(request, session.credentials)
							.spread(function (isValid, credentials) {
								if (!isValid) {
									throw new AuthError('Invalid credentials');
								}
								return { credentials: credentials || session.credentials, artifacts: session };
							}).catch(function (err) {
								if (settings.clearInvalid) {
									return clearSession(
											request,
											reply
										).then(function () {
											throw err;
										});
								}
								throw err;
							});
					}).then(function (data) {
						reply.continue(data);
						return null;
					}).catch(function (err) {
						if (!(err instanceof AuthError)) {
							server.log('error', err);
						}
						reject(err);
						return null;
					});
			}
		}
	};

	return scheme;
};