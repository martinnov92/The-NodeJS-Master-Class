/**
 * WORKERS
*/

const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const https = require('https');

const _data = require('./data');
const helpers = require('./helpers');

// workers object
const workers = {};

// timer na spuštění worker-procesu, jednou za minutu
workers.loop = function() {
    setInterval(() => {
        this.gatherAllChecks();
    }, 1000 * 60);
};

workers.gatherAllChecks = function() {
    // najít všechny "checks", získat jejich data a poslad do validátoru
    _data.list('checks', (err, checks) => {
        if (!err && checks && checks.length > 0) {
            checks.forEach((check) => {
                // přečíst data
                _data.read('checks', check, (err, originalCheckData) => {
                    if (!err && originalCheckData) {
                        // předat data do validátoru
                        this.validateCheckData(originalCheckData);
                    } else {
                        console.log(`WORKER: Chyba při čtení "${check}.json".`);
                    }
                });
            });
        } else {
            console.log('WORKER: Nenalezeny žádné záznamy ke zpracování.');
        }
    });
};

// kontrola dat
workers.validateCheckData = function(originalCheckData) {
    originalCheckData = typeof (originalCheckData) === 'object' && originalCheckData !== null ? originalCheckData : {};

    originalCheckData.id = typeof(originalCheckData.id) == 'string' && originalCheckData.id.trim().length == 20 ? originalCheckData.id.trim() : false;
    originalCheckData.userPhone = typeof(originalCheckData.phone) == 'string' && originalCheckData.phone.trim().length == 10 ? originalCheckData.phone.trim() : false;
    originalCheckData.protocol = typeof(originalCheckData.protocol) == 'string' && ['http','https'].indexOf(originalCheckData.protocol) > -1 ? originalCheckData.protocol : false;
    originalCheckData.url = typeof(originalCheckData.url) == 'string' && originalCheckData.url.trim().length > 0 ? originalCheckData.url.trim() : false;
    originalCheckData.method = typeof(originalCheckData.method) == 'string' &&  ['post','get','put','delete'].indexOf(originalCheckData.method) > -1 ? originalCheckData.method : false;
    originalCheckData.successCodes = typeof(originalCheckData.successCodes) == 'object' && originalCheckData.successCodes instanceof Array && originalCheckData.successCodes.length > 0 ? originalCheckData.successCodes : false;
    originalCheckData.timeoutSeconds = typeof(originalCheckData.timeoutSeconds) == 'number' && originalCheckData.timeoutSeconds % 1 === 0 && originalCheckData.timeoutSeconds >= 1 && originalCheckData.timeoutSeconds <= 5 ? originalCheckData.timeoutSeconds : false;

    // nastavení hodnot pro poslední kontrolu a stav jestli stránka byla, nebo nebyla dostupná
    originalCheckData.state = typeof(originalCheckData.state) == 'string' && ['up','down'].indexOf(originalCheckData.state) > -1 ? originalCheckData.state : 'down';
    originalCheckData.lastChecked = typeof(originalCheckData.lastChecked) == 'number' && originalCheckData.lastChecked > 0 ? originalCheckData.lastChecked : false;
  
    // If all checks pass, pass the data along to the next step in the process
    if(
        originalCheckData.id &&
        originalCheckData.phone &&
        originalCheckData.protocol &&
        originalCheckData.url &&
        originalCheckData.method &&
        originalCheckData.successCodes &&
        originalCheckData.timeoutSeconds
    ){
        this.performCheck(originalCheckData);
    } else {
        // pokud kontrola selže, přeskočím záznam a zaloguji
        console.log("WORKERS: Kontrola selhala. Jdu na další.");
    }
};

// provedení samotné kontroly
workers.performCheck = function(originalCheckData) {
    // připravit první kontrolu
    const checkOutcome = {
        'error': false,
        'responseCode': false,
    };

    // označit checkOutcome jako neodeslaný
    let outcomeSent = false;

    // parse hostname a path z originálních dat
    const parsedUrl = url.parse(`${originalCheckData.protocol}://${originalCheckData.url}`, true);
    const { hostname, path } = parsedUrl; // nepoužívám "pathname", ale path, protože chci query string

    // vytvořit requestDetails
    const requestDetails = {
        protocol: `${originalCheckData.protocol}:`,
        hostname,
        method: originalCheckData.method.toUpperCase(), // req metoda potřebuje method jako UPPERCASE
        timeout: originalCheckData.timeoutSeconds * 1000,
    };

    // vytvořit HTTP(S) request
    const _moduleToUse = originalCheckData.protocol === 'http' ? http : https; // jaký modul se použije?
    const req = _moduleToUse.request(requestDetails, (res) => {
        // získám status request
        const status = res.statusCode;

        // update checkOutcome a předat data
        checkOutcome.responseCode = status;

        if (!outcomeSent) {
            this.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // bind error, aby nespadla aplikace
    req.on('error', (err) => {
        checkOutcome.error = {
            'error': true,
            'value': err,
        };

        if (!outcomeSent) {
            this.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // bind to timeout event
    req.on('timeout', (err) => {
        checkOutcome.error = {
            'error': true,
            'value': 'timeout',
        };

        if (!outcomeSent) {
            this.procesCheckOutcome(originalCheckData, checkOutcome);
            outcomeSent = true;
        }
    });

    // end request (odeslat request)
    req.end();
};

// ověřit výstup
workers.procesCheckOutcome = function(originalCheckData, checkOutcome) {
    // rozhodnout se, jestli je záznam považován za up/down
    const state = !checkOutcome.error && checkOutcome.responseCode && originalCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

    // rozhodnout, jestli je požadován alert, kontrola jestli už byl zkontrolován a jestli je status jiný než ten minulý
    const alertWarranted = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false;

    // update check data
    const newCheckData = {...originalCheckData};
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    // uložit na disk
    _data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            // pokud je vše v pořádku, odešlu data do další fáze procesu
            if (alertWarranted) {
                this.alertUserToStatusChange(newCheckData);
            } else {
                console.log('WORKERS: Check state se nezměnil. Upozornění neproběhlo.');
            }
        } else {
            console.log('WORKERS: Chyba při ukládání updatu při kontrole.');
        }
    });
};

// metoda pro poslání SMS, pokud se změní stav stránky
workers.alertUserToStatusChange = function(newCheckData) {
    const msg = `Upozornění: Vaše kontrola pro ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} je v současné době ${newCheckData.state}.`;

    // odeslání SMS pomocí pomocné fce
    helpers.sendTwilioSMS(newCheckData.phone, msg, (err) => {
        if (!err) {
            console.log('WORKERS: Zpráva pro uživatele byla odeslána.', msg);
        } else {
            console.log('WORKERS: Zprávu se nepodařilo odeslat.', msg);
        }
    });
};

// init workers
workers.init = function() {
    console.log('\x1b[33m%s\x1b[0m','WORKER IS 🏃‍ ‍‍ 🏃‍ ‍‍ 🏃‍ ‍‍');

    // spusit kontrolu všech checks
    this.gatherAllChecks();

    // spustit cyklus, aby se kontrola prováděla sama
    this.loop();
};

module.exports = workers;
