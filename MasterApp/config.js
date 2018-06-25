/**
 * Vytvoření a exportování konfiguračních proměnných (NODE_ENV)
*/

const environments = {};

// staging (dev, default) environment 
environments.staging = {
    http: 3000,
    https: 3001,
    maxChecks: 5,
    envName: 'staging',
    fromPhone: '',
    twilio : {
        // DEMO ÚDAJE Z KURZU
        accountSid: 'ACb32d411ad7fe886aac54c665d25e5c5d',
        authToken: '9455e3eb3109edc12e3d8c92768f7a67',
        fromPhone: '+15005550006'
    },
    hashingSecret: 'martinkova skvela aplikace',
};

// produkce
environments.production = {
    http: 80,
    https: 443,
    maxChecks: 5,
    envName: 'production',
    fromPhone: '',
    twilio : {
        // DEMO ÚDAJE Z KURZU
        accountSid: 'ACb32d411ad7fe886aac54c665d25e5c5d',
        authToken: '9455e3eb3109edc12e3d8c92768f7a67',
        fromPhone: '+15005550006'
    },
    hashingSecret: 'martinkova skvela aplikace',
};

// které prostředí se použije?
const currentEnv = typeof(process.env.NODE_ENV) === 'string' ? process.env.NODE_ENV.toLowerCase() : '';
const environmentToExport = typeof(environments[currentEnv]) == 'object' ? environments[currentEnv] : environments.staging;

// export prostředí
module.exports = environmentToExport;
