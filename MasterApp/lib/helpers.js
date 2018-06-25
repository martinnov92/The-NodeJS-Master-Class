const https = require('https');
const crypto = require('crypto');
const queryString = require('querystring');

const config = require('../config');

// container
const helpers = {};

// parse json string na object a bez throw errro
helpers.parseJsonToObject = (str) => {
    try {
        const obj = JSON.parse(str);
        return obj;
    } catch (err) {
        return {};
    }
};

// vytvoří string náhodných znaků o požadované délce
helpers.createRandomString = (length) => {
    length = typeof length === 'number' && length > 0 ? length : false;

    if (length) {
        // definovat všechny možné znaky, které mohou být ve stringu
        const possibleCharacters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        let str = '';

        for (let i = 0; i < length; i++) {
            // zíksání náhodného znaku z possibleCharacters
            const randomCharacter = possibleCharacters.charAt(Math.floor(Math.random() * possibleCharacters.length)); // náhodný znak 0 - délka náhodných znaků
            // připojit znak do str
            str += randomCharacter;
        }

        return str;
    } else {
        return false;
    }
};

helpers.hash = (str) => {
    // hashování pomocí SHA256
    if (typeof str === 'string' && str.length > 0) {
        // zaheshuji pomocí sha256, nastavím secret key, updatuji string a změním zpět na string
        const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
        return hash;
    }

    return false;
};

// odesílání SMS pomocí Twilio
helpers.sendTwilioSMS = (phone, msg, callback) => {
    // validate parametry
    phone = typeof phone === 'string' && phone.trim().length === 9 ? phone.trim() : false;
    msg = typeof msg === 'string' && (msg.trim().length > 0 && msg.trim().length <= 160) ? msg : false;

    if (phone && msg) {
        // konfigurace requestu
        const payload = {
            From: config.twilio.fromPhone,
            To: `+420${phone}`,
            Body: msg,
        };

        // stringify
        const stringPayload = queryString.stringify(payload);

        // konfigurace request detailů
        const requestDetails = {
            protocol: 'https:',
            hostname: 'api.twilio.com',
            method: 'POST',
            path: `/2010-04-01/Accounts/${config.twilio.accountSid}/Messages.json`,
            auth: `${config.twilio.accountSid}:${config.twilio.authToken}`,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(stringPayload), // získání délky bytů ze stringPayload
            },
        };

        // vytvoření requestu a odeslat
        const req = https.request(requestDetails, (res) => {
            // získání statusu requestu
            const status = res.statusCode;

            // callback success
            if (status === 200 || status === 201) {
                callback(false);
            }

            callback(`Status code returned was ${status}`);
        });

        // bind to the error event, so it does not get thrown (aby nespadla aplikace)
        req.on('error', callback);

        // přidání payload do requestu
        req.write(stringPayload);

        // end request
        req.end();
    } else {
        callback(400, { 'Error': 'Chybné nebo neúplné údaje.' });
    }
};

module.exports = helpers;
