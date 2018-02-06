"use strict";
const hoek = require('hoek');
const joi = require('joi');
const boom = require('boom');

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
	isSecure     : joi.boolean().default(true),
	isHttpOnly   : joi.boolean().default(true),
	redirectOnTry: joi.boolean().default(false),
	password     : joi.alternatives(joi.string(), joi.object().type(Buffer)),
	redirectTo   : joi.string().allow('', false, null).default(''),
	validateFunc : joi.func(),
	uidGenerator : joi.func(),
	appendNext   : joi.alternatives(joi.string(), joi.boolean()).allow('', false, null).default(false),
	path         : joi.string().default('/')
});

const mkUidGenerator = require('./uidGenerator');

function implementation (server, options) {
	let cache;
	const result = joi.validate(options, optionsSchema);
	hoek.assert(!result.error, result.error);
	const settings = result.value;

	if (settings.cache) {
		cache = settings.cache;
	} else {
		cache = server.cache({ segment: settings.cacheId, expiresIn: settings.ttl });
	}

	const cacheGet  = cache.get.bind(cache);
	const cacheSet  = cache.set.bind(cache);
	const cacheDrop = cache.drop.bind(cache);
	const validateFunc = settings.validateFunc;
	const appendNext = settings.appendNext === true ? 'next' : settings.appendNext;

	const cookieOptions = {
		encoding  : settings.password ? 'iron' : 'none',
		ttl       : settings.sessionCookie ? null : settings.ttl,
		password  : settings.password,
		isSecure  : settings.isSecure,
		isHttpOnly: settings.isHttpOnly,
		path      : settings.path
	};

	const genSid = options.uidGenerator || mkUidGenerator(settings.sidLength, settings.uidRetries);

	server.state(settings.cookie, cookieOptions);


	server.ext('onPreAuth', (request, h) => {
		request.auth.session = {
			getId () {
				return getSessionId(request);
			},
			async getSession () {
				return await getSession(request);
			},
			async setSession (session) {
				return await setSession(request, h, session);
			},
			async set (credentials) {
				hoek.assert(credentials === null || typeof credentials === 'object', 'Invalid credentials');
				const session = {
					authenticated: !!credentials,
					credentials: credentials
				};
				return await setSession(request, h, session);
			},
			async clear () {
				await clearSession(request, h);
				return await setSession(request, h, { authenticated: false });
			}
		};
		return h.continue;
	});

	const scheme = {
		async authenticate (request, h) {
			try {
				return await validate(request, h);
			} catch (err) {
				if (!(err instanceof AuthError)) {
					server.log('error', err);
					return unauthenticated(request, h, new AuthError('Authentication Failed'));
				}
				return unauthenticated(request, h, err);
			}
		}
	};

	async function validate (request, h) {
		const sessionId = getSessionId(request);
		if (!sessionId) {
			await setSession(request, h, { authenticated: false });
			throw new AuthError('Bad Session');
		}
		const session = await cacheGet(sessionId);
		if (!session) {
			await clearSession(request, h);
			await setSession(request, h, { authenticated: false });
			throw new AuthError('Bad Session');
		}
		if (!session.authenticated) {
			throw new AuthError('Not authenticated');
		}

		const [isValid, credentials] = validateFunc ? await validateFunc(request, session.credentials) : [true, undefined];
		if (!isValid) {
			if (settings.clearInvalid) {
				await clearSession(request, h);
				await setSession(request, h, { authenticated: false });
			}
			throw new AuthError('Invalid credentials');
		}

		return h.authenticated({ credentials: credentials || session.credentials, artifacts: session });
	}

	function getSessionId (request) {
		const sessionId = request.state[settings.cookie];
		if (sessionId && typeof sessionId === 'string') {
			return sessionId;
		}
		return null;
	}

	async function setSession (request, h, session) {
		hoek.assert(session && typeof session === 'object', 'Invalid Session');

		const currID = getSessionId(request);
		if (currID) {
			return await cacheSet(currID, session, 0);
		}
		//we don't have a session id so we need to make one
		const sessionId = await genSid();
		h.state(settings.cookie, sessionId);
		request.state[settings.cookie] = sessionId;
		return cacheSet(sessionId, session, 0);
	}

	async function clearSession (request, h) {
		const sessionId = getSessionId(request);
		if (sessionId) {
			h.unstate(settings.cookie);
			request.state[settings.cookie] = null;
			return await cacheDrop(sessionId);
		}
		return null;
	}

	async function getSession (request) {
		const sessionId = getSessionId(request);
		if (sessionId) {
			return await cacheGet(sessionId);
		}
		return null;
	}

	function unauthenticated (request, h, err) {
		const routeSettings = request.route.settings.plugins.session;

		let uri = settings.redirectTo;

		err = boom.boomify(err, {statusCode: 401});

		if (settings.redirectOnTry === false && request.auth.mode === 'try') {
			return h.unauthenticated(err);
		}

		if (routeSettings && routeSettings.redirectTo !== undefined) {
			uri = routeSettings.redirectTo;
		}

		if (!uri) {
			return h.unauthenticated(err);
		}

		if (appendNext) {
			if (uri.indexOf('?') !== -1) {
				uri += '&';
			} else {
				uri += '?';
			}

			uri += appendNext + '=' + encodeURIComponent(request.url.path);
		}

		return h.response('You are being redirected...').takeover().redirect(uri);
	}

	return scheme;
}


function register (server) {
	server.auth.scheme('session', implementation);
}

function AuthError (message) {
	Error.captureStackTrace(this, this.constructor);
	this.name = this.constructor.name;
	this.message = message;
}

AuthError.prototype = Object.create(Error.prototype);

module.exports = {register, name: 'sol'};