"use strict";
const Promise = require('bluebird');
const crypto  = require('crypto');

function mkUidGenerator (len, retries) {
	const store = [];

	function getUid (store, retries, len, resolve, reject) {
		crypto.randomBytes(len, (err, randomBuffer) => {
			let uid;
			if (!err) {
				uid = randomBuffer.toString('base64');
				if (store.indexOf(uid) === -1) {
					store.push(uid);
					return resolve(uid);
				}
				//fall-throe to as error if uid already exist (should never happen if enough entropy was chosen)
			}
			if (retries === 0) {
				return reject(new Error('too many tries'));
			}
			return getUid(store, --retries, len, resolve, reject);
		});
	}
	return () => new Promise((resolve, reject) => getUid(store, retries, len, resolve, reject));
}

module.exports = mkUidGenerator;