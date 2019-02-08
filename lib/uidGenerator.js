'use strict';
const {promisify} = require('util');
const crypto      = require('crypto');
const randomBytesAsync = promisify(crypto.randomBytes);

async function getUid (len, retries, getRandomBytes) {
	try {
		const randomBuffer = await getRandomBytes(len);
		const uid = randomBuffer.toString('base64');
		return uid;
	} catch (err) {
		if (retries === 0) {
			throw new Error(`too many tries: ${err.message}`);
		}
	}

	return getUid(len, --retries, getRandomBytes);
}

function mkUidGenerator (len, retries, getRandomBytes) {
	getRandomBytes = getRandomBytes || randomBytesAsync;
	return () => getUid(len, retries, getRandomBytes);
}

module.exports = mkUidGenerator;