"use strict";
const crypto = require('crypto');
const hoek   = require('hoek');
const joi    = require('joi');
const boom   = require('boom');

const optionsSchema = joi.object({
	cacheId      : joi.string().default('_hapi_session'),
	sidLength    : joi.number().integer().min(10).default(16),
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
	rlClient      : joi.object().keys({
		query: joi.func().arity(2).required(),
		take: joi.func().arity(2).required()
	}).unknown(),
	rlBucket     : joi.string().default('session'),
	rlGetKey     : joi.func().arity(1).default((request) => request.info.remoteAddress),
	rlAddHeaders : joi.boolean().default(true),
	redirectTo   : joi.string().allow('', false, null).default(''),
	secret       : joi.string().min(10).allow(null).default(null),
	hmacAlgo     : joi.string().default('sha1'),
	hmacEncoding : joi.any().valid('hex', 'latin1', 'base64').default('base64'),
	hmacRequest  : joi.array().items(joi.string().regex(/^(info\.remoteAddress|headers\.[^.]+)$/)).allow(null).default(['info.remoteAddress', 'headers.user-agent']),
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
	if (settings.secret) {
		try {
			crypto.createHmac(settings.hmacAlgo, settings.secret);
		} catch (e) {
			hoek.assert(false, `Node install does not seem to support HMAC using algorithm ${settings.hmacAlgo}`);
		}
	}

	if (settings.cache) {
		cache = settings.cache;
	} else {
		cache = server.cache({ segment: settings.cacheId, expiresIn: settings.ttl });
	}

	const rlClient = settings.rlClient;
	const cacheGet  = cache.get.bind(cache);
	const cacheSet  = cache.set.bind(cache);
	const cacheDrop = cache.drop.bind(cache);
	const validateFunc = settings.validateFunc;
	const appendNext = settings.appendNext === true ? 'next' : settings.appendNext;

	const cookieOptions = {
		encoding  : 'none',
		ttl       : settings.sessionCookie ? null : settings.ttl,
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
			getInternalId () {
				return getHmacId(request);
			},
			async getSession () {
				return getSession(request);
			},
			async setSession (session) {
				return setSession(request, h, session);
			},
			async set (credentials) {
				hoek.assert(credentials === null || typeof credentials === 'object', 'Invalid credentials');
				const session = {
					authenticated: !!credentials,
					credentials: credentials
				};
				return setSession(request, h, session);
			},
			async clear () {
				await clearSession(request, h);
				return setSession(request, h, { authenticated: false });
			}
		};
		return h.continue;
	});

	server.ext('onPostAuth', (request, h) => {
		if (request.auth.error && request.auth.error.isBoom && request.auth.error.typeof === boom.tooManyRequests) {
			throw request.auth.error;
		}
		return h.continue;
	});

	const scheme = {
		async authenticate (request, h) {
			try {
				if (rlClient) {
					const key = await settings.rlGetKey(request);
					const limit = await rlClient.query(settings.rlBucket, key);
					if (!limit.conformant) {
						return unauthenticated(request, h, boom.tooManyRequests(settings.message), limit);
					}
				}
				return await validate(request, h);
			} catch (err) {
				let limit;
				if (rlClient) {
					try {
						const key = await settings.rlGetKey(request);
						limit = await rlClient.take(settings.rlBucket, key);
					} catch (rlErr) {
						request.log(['error'], rlErr);
					}
				}
				if (err instanceof AuthError) {
					return unauthenticated(request, h, err, limit);
				}
				request.log(['error'], err);
				return unauthenticated(request, h, new AuthError('Authentication Failed'), limit);
			}
		}
	};

	async function validate (request, h) {
		const hmac = getHmacId(request);
		if (!hmac) {
			await setSession(request, h, { authenticated: false });
			throw new AuthError('Bad Session');
		}
		const session = await cacheGet(hmac);
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

	function getHmacId (request) {
		if (request.auth.session.id !== undefined) {
			return request.auth.session.id;
		}
		const sessionId = getSessionId(request);
		const hmac = sessionId && idToHmac(sessionId, request);
		request.auth.session.id = hmac;
		return hmac;
	}

	function idToHmac (id, request) {
		if (!settings.secret) {
			return id;
		}

		const hmac = crypto.createHmac(settings.hmacAlgo, settings.secret);
		hmac.update(id);
		if (settings.hmacRequest) {
			settings.hmacRequest.forEach((key) => {
				const value = hoek.reach(request, key);
				value && hmac.update(hoek.reach(request, key));
			});
		}
		return hmac.digest(settings.hmacEncoding);
	}

	async function setSession (request, h, session) {
		hoek.assert(session && typeof session === 'object', 'Invalid Session');

		const currID = getHmacId(request);
		if (currID) {
			return cacheSet(currID, session, 0);
		}
		//we don't have a session id so we need to make one
		const sessionId = await genSid();
		h.state(settings.cookie, sessionId);
		request.state[settings.cookie] = sessionId;
		const hmac = idToHmac(sessionId, request);
		request.auth.session.id = hmac;
		return cacheSet(hmac, session, 0);
	}

	async function clearSession (request, h) {
		const id  = getSessionId(request);
		if (id) {
			h.unstate(settings.cookie);
			request.state[settings.cookie] = null;
			const hmac = getHmacId(request);
			if (hmac) {
				request.auth.session.id = undefined;
				return cacheDrop(hmac);
			}
		}
		return null;
	}

	async function getSession (request) {
		const hmac = getHmacId(request);
		if (hmac) {
			return cacheGet(hmac);
		}
		return null;
	}

	function unauthenticated (request, h, err, limit) {
		const routeSettings = request.route.settings.plugins.session;

		let uri = settings.redirectTo;

		err = err.isBoom ? err : boom.boomify(err, {statusCode: 401});

		if (limit && settings.rlAddHeaders) {
			err.output.headers['X-RateLimit-Limit'] = limit.size;
			err.output.headers['X-RateLimit-Remaining'] = limit.remaining;
			err.output.headers['X-RateLimit-Reset'] = limit.ttl;
		}

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