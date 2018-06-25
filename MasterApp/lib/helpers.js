const crypto = require('crypto');
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

module.exports = helpers;
