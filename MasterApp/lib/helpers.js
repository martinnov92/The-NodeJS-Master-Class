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
