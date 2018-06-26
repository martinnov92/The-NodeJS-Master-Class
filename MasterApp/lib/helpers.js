const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const queryString = require('querystring');

const config = require('../lib/config');

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

// TEMPLATE HELPERS - získat string z template
helpers.getTemplate = function(templateName, data, callback) {
    data = typeof data === 'object' && data !== null ? data : {};
    templateName = (typeof templateName === 'string' && templateName.length > 0) ? templateName : false;

    if (templateName) {
        const templatesDir = path.join(__dirname, '/../templates/');
        fs.readFile(`${templatesDir}${templateName}.html`, 'utf8', (err, str) => {
            if (!err && str && str.length > 0) {
                const finalString = this.interpolate(str, data);
                callback(false, finalString);
            } else {
                callback('Šablona nenalezena.');
            }
        });
    } else {
        callback('Neplatný název šablony.');
    }
};

// přidání hlavičky a patičky ke stringu a spojit do jedné šablony
helpers.addUniversalTemplates = (str, data, callback) => {
    str = typeof str === 'string' && str.length > 0 ? str : false;
    data = typeof data === 'object' && data !== null ? data : {};

    // header
    helpers.getTemplate('_header', data, (err, headerStr) => {
        if (!err && headerStr) {
            helpers.getTemplate('_footer', data, (err, footerStr) => {
                if (!err && headerStr) {
                    const htmlString = headerStr + str + footerStr;
                    callback(false, htmlString);
                } else {
                    callback('Šablona nenalezena.');
                }
            });
        } else {
            callback('Šablona nenalezena.');
        }
    });
};

// získat string a data object a najít/nahradit klíče v textu, string interpolation
helpers.interpolate = (str, data) => {
    str = typeof str === 'string' && str.length > 0 ? str : false;
    data = typeof data === 'object' && data !== null ? data : {};

    // přiřazení template globals do data object s předponou "global"
    for (let keyName in config.templateGlobals) {
        if (config.templateGlobals.hasOwnProperty(keyName)) {
            data['global.' + keyName] = config.templateGlobals[keyName];
        }
    }

    // pro každý klíč v objeku, vložím jejich hodnotu do stringu
    for (let key in data) {
        if (data.hasOwnProperty(key) && typeof data[key] === 'string') {
            const replace = data[key];
            const find = `{${key}}`;
            str = str.replace(find, replace);
        }
    }

    return str;
}

module.exports = helpers;
