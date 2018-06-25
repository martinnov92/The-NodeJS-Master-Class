/**
 * Vytvoření a exportování konfiguračních proměnných (NODE_ENV)
*/

const environments = {};

// staging (dev, default) environment 
environments.staging = {
    http: 3000,
    https: 3001,
    envName: 'staging',
};

// produkce
environments.production = {
    http: 80,
    https: 443,
    envName: 'production',
};

// které prostředí se použije?
const currentEnv = typeof(process.env.NODE_ENV) === 'string' ? process.env.NODE_ENV.toLowerCase() : '';
const environmentToExport = typeof(environments[currentEnv]) == 'object' ? environments[currentEnv] : environments.staging;

// export prostředí
module.exports = environmentToExport;
