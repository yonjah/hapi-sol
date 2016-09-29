"use strict";
const hoek = require('hoek');

const joi = require('joi');

const boom = require('boom');

const Promise = require('bluebird');

const optionsSchema = joi.object({
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
});

const mkUidGenerator = require('./uidGenerator');

function implementation (server, options) {
	let result,
		settings,
		cache,
		cacheGet,
		cacheSet,
		cacheDrop,
		cookieOptions,
		getSid,
		scheme;

	function getSessionId (request) {
		const sessionId = request.state[settings.cookie];
		if (sessionId && typeof sessionId === 'string') {
			return sessionId;
		}
		return null;
	}

	function setSession (request, reply, session, cb) {
		hoek.assert(session && typeof session === 'object', 'Invalid Session');

		return promisify((resolve, reject) => {
			const sessionId = getSessionId(request);
			if (sessionId) {
				return cacheSet(sessionId, session, 0).then(resolve, reject);
			}
			//we don't have a session id so we need to make one
			return getSid().then(sessionId => {
				reply.state(settings.cookie, sessionId);
				request.state[settings.cookie] = sessionId;
				return cacheSet(sessionId, session, 0).then(resolve, reject);
			}, reject);
		}, cb);
	}

	function clearSession (request, reply, cb) {
		return promisify((resolve, reject) => {
			const sessionId = getSessionId(request);
			if (sessionId) {
				reply.unstate(settings.cookie);
				request.state[settings.cookie] = null;
				return cacheDrop(sessionId).then(resolve, reject);
			}
			return resolve();
		}, cb);
	}

	function getSession (request, cb) {
		return promisify((resolve, reject) => {
			const sessionId = getSessionId(request);
			if (sessionId) {
				return cacheGet(sessionId).spread(resolve).catch(reject);
			}
			return resolve();
		}, cb);
	}

	function unauthenticated (request, reply, err, result) {
		const routeSettings = request.route.settings.plugins.session;

		let uri = settings.redirectTo;

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


	server.ext('onPreAuth', (request, reply) => {
		request.auth.session = {
			getId () {
				return getSessionId(request);
			},
			getSession (cb) {
				return  getSession(request, cb);
			},
			setSession (session, cb) {
				return  setSession(request, reply, session, cb);
			},
			set (credentials, cb) {
				return Promise.try(() => {
					hoek.assert(credentials === null || typeof credentials === 'object', 'Invalid credentials');
					return {
						authenticated: !!credentials,
						credentials: credentials
					};
				}).then(
					session => setSession(request, reply, session, cb),
					cb
				);
			},
			clear (cb) {
				return promisify((resolve, reject) => {
					clearSession(request, reply)
						.then(() => setSession(request, reply, { authenticated: false }))
						.then(resolve, reject);
				}, cb);
			}
		};
		return reply.continue();
	});



	scheme = {
		authenticate (request, reply) {
			const sessionId = getSessionId(request);

			if (!sessionId) {
				return setSession(request, reply, { authenticated: false })
					.catch(err => server.log('error', err))
					.finally(() => unauthenticated(request, reply, new AuthError('Bad Session')));
			} else {
				return cacheGet(sessionId)
					.spread(session => {
						if (!session) {
							return clearSession(request, reply)
								.then(() => setSession(request, reply, { authenticated: false }))
								.catch(err => server.log('error', err))
								.then(() => {
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
							.spread((isValid, credentials) => {
								if (!isValid) {
									throw new AuthError('Invalid credentials');
								}
								return { credentials: credentials || session.credentials, artifacts: session };
							}).catch(err => {
								if (settings.clearInvalid) {
									return clearSession(request, reply)
										.then(() => setSession(request, reply, { authenticated: false }))
										.catch(err => server.log('error', err))
										.then(() => {
											throw err;
										});
								}
								throw err;
							});
					}).then(data => {
						reply.continue(data);
						return null;
					}).catch(err => {
						if (!(err instanceof AuthError)) {
							server.log('error', err);
						}
						unauthenticated(request, reply, err);
						return null;
					});
			}
		}
	};

	return scheme;
}

function promisify (fn, cb) {
	const promise = new Promise(fn);
	return typeof cb === 'function' ? promise.then(cb.bind(null, null), cb) : promise;
}

function register (plugin, options, next) {
	plugin.auth.scheme('session', implementation);
	next();
}

register.attributes = {
	pkg: require('../package.json'),
	name: 'sol'
};

function AuthError (message) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
}

AuthError.prototype = Error.prototype;

exports.register = register;