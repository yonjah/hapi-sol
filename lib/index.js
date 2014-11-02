"use strict";
var hoek     = require('hoek'),
	boom     = require('boom'),
	crypt    = require('crypto'),
	defaults = {
		cacheId      : '_hapi_session',
		sidLength    : 36,
		uidRetries   : 5,
		clearInvalid : true,
		ttl          : 1000 * 60 * 60 * 24, // one day
		cookie       : 'sid',
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
		function get(counter, callback) {
			var id;
			counter++;
			if (counter > retries) {
				return callback('too many tries');
			} else {
				try {
					id = crypt.randomBytes(len).toString('base64');
				} catch(e) {
					//not enough entropy retry
					return setTimeout(get.bind(null, counter, callback), 10);
				}
				if (store.indexOf(id) >= 0) { //retry
					return get(counter, callback);
				} else {
					store.push(id);
					return callback(null, id);
				}
			}
		}

		return get.bind(null, 0);
	};

exports.register = function (plugin, options, next) {
	plugin.auth.scheme('session', implementation);
	next();
};


exports.register.attributes = {
	pkg: require('../package.json'),
	name: 'session'
};


var implementation = function (server, options) {
	var settings,
		cache,
		cookieOptions,
		getSid,
		scheme;

	function setNewId (reply, session, callback, err, sessionId) {
		if (err) {
			callback(err);
		} else {
			reply.state(settings.cookie, sessionId);
			cache.set(sessionId, session, 0, callback);
		}
	}

	function setSession(request, reply, session, callback) {
		hoek.assert(session && typeof session === 'object', 'Invalid Session');

		var sessionId = request.state[settings.cookie];
		if (sessionId && typeof sessionId === 'string') {
			return cache.set(sessionId, session, 0, callback);
		} else { //we don't have a session id so we need to make one
			return getSid(setNewId.bind(null, reply, session, callback));
		}
	}

	function clearSession(request, reply, callback) {
		var sessionId = request.state[settings.cookie];
		if (sessionId && typeof sessionId === 'string') {
			reply.unstate(settings.cookie);
			request.state[settings.cookie] = null; //invalidate SID
			return cache.drop(sessionId, callback);
		} else {
			return callback();
		}
	}

	function getSession (request, reply, callback) {
		var sessionId = request.state[settings.cookie];
		if (!sessionId) {
			return callback(null, null); //we don't have a session
		} else {
			return cache.get(sessionId, callback);
		}
	}

	function unauthenticated (request, reply, err, result) {
		var routeSettings = request.route.plugins.session,
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

	cache = server.cache(settings.cacheId, { expiresIn: settings.ttl });

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
			get: function (callback) {
				getSession(request, reply, function (err, session) {
					if (err) {
						return callback(err);
					} else {
						return callback(null, session && session.credentials || null);
					}
				});
			},
			set: function (credentials, callback) {
				hoek.assert(credentials === null || credentials, 'Invalid credentials');
				getSession(request, reply, function (err, session) {
					if (err) {
						return callback(err);
					} else {
						session = session || {}; //if we don't have a session will make a new one

						if (!credentials) {
							session.authenticated = false;
						} else {
							session.authenticated = true;
							session.credentials = credentials;
						}

						return setSession(request, reply, session, callback);
					}
				});

			},
			clear: clearSession.bind(this, request, reply)
		};
		reply();
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
					{ authenticated: false },
					reject.bind(this, 'No session')
				);
			} else {
				return cache.get(sessionId, function (err, session) {
					if (!session) {
						return clearSession(request, reply, reject.bind(this, 'Bad session'));
					} else if (!session.authenticated) {
						return reject('Not authenticated');
					} else if (!settings.validateFunc) {
						return reply(null, { credentials: session.credentials });
					} else {
						return settings.validateFunc(session.credentials, function (err, isValid, credentials) {
							if (err || !isValid) {
								if (settings.clearInvalid) {
									return clearSession(
										request,
										reply,
										reject.bind(
												this,
												'Invalid credentials',
												{ log: (err ? { data: err } : 'Failed validation') }
									));
								} else {
									return reject(
											'Invalid credentials',
											{ log: (err ? { data: err } : 'Failed validation') }
										);
								}
							}

							if (credentials && session.credentials !== credentials) {
								session.credentials = credentials;
								return setSession(
									request,
									reply,
									session,
									function (err) {
										return reply(err, { credentials: credentials});
									}
								);
							} else {
								return reply(err, { credentials: session.credentials});
							}
						});
					}
				});
			}
		}
	};

	return scheme;
};