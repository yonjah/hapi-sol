"use strict";
const {promisify} = require('util');
const crypto      = require('crypto');
const randomBytesAsync = promisify(crypto.randomBytes);

async function getUid (store, retries, len) {
	try {
		const randomBuffer = await randomBytesAsync(len);
		const uid = randomBuffer.toString('base64');
		if (store.indexOf(uid) === -1) {
			store.push(uid);
			return uid;
		}
	} catch (err) {
		//ignore err we assume it will only fail due to not enough entropy
	}

	if (retries === 0) {
		throw new Error('too many tries');
	}
	return getUid(store, --retries, len);
}

function mkUidGenerator (len, retries) {
	const store = [];

	return () => getUid(store, retries, len);
}

module.exports = mkUidGenerator;