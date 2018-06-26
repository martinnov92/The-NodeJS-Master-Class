/**
 * WORKERS
*/

const fs = require('fs');
const url = require('url');
const path = require('path');
const http = require('http');
const util = require('util');
const https = require('https');
const debug = util.debuglog('workers');

const _data = require('./data');
const _logs = require('./logs');
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
                        debug(`WORKER: Chyba při čtení "${check}.json".`);
                    }
                });
            });
        } else {
            debug('WORKER: Nenalezeny žádné záznamy ke zpracování.');
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
        debug('\x1b[33m%s\x1b[0m', '👾 Kontrola selhala. Jdu na další.');
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
        // debug(requestDetails.hostname,status);
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
    const timeOfCheck = Date.now();
    newCheckData.state = state;
    newCheckData.lastChecked = timeOfCheck;

    this.log(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

    // uložit na disk
    _data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            // pokud je vše v pořádku, odešlu data do další fáze procesu
            if (alertWarranted) {
                this.alertUserToStatusChange(newCheckData);
            } else {
                debug('\x1b[33m%s\x1b[0m', '👾 Check state se nezměnil. Upozornění neproběhlo.');
            }
        } else {
            debug('\x1b[33m%s\x1b[0m', '👾 Chyba při ukládání updatu při kontrole.');
        }
    });
};

// metoda pro poslání SMS, pokud se změní stav stránky
workers.alertUserToStatusChange = function(newCheckData) {
    const msg = `Upozornění: Vaše kontrola pro ${newCheckData.method.toUpperCase()} ${newCheckData.protocol}://${newCheckData.url} je v současné době ${newCheckData.state}.`;

    // odeslání SMS pomocí pomocné fce
    helpers.sendTwilioSMS(newCheckData.phone, msg, (err) => {
        if (!err) {
            debug('\x1b[33m%s\x1b[0m', '👾 Zpráva pro uživatele byla odeslána.', msg);
        } else {
            debug('\x1b[33m%s\x1b[0m', '👾 Zprávu se nepodařilo odeslat.', msg);
        }
    });
};

//
workers.log = function(originalCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
    const logData = {
        state: state,
        time: timeOfCheck,
        outcome: checkOutcome,
        alert: alertWarranted,
        check: originalCheckData,
    };

    const stringLogData = JSON.stringify(logData, null, 4);

    // název logu
    const logFileName = originalCheckData.id;

    // append (zapsat) log do souboru
    _logs.append(logFileName, stringLogData, (err) => {
        if (!err) {
            debug('\x1b[33m%s\x1b[0m', '👾 Log uložen.');
        } else {
            debug('\x1b[33m%s\x1b[0m', '👾 Chyba při ukládání do logo.');
        }
    })
};

// komprese logů
workers.rotateLogs = function() {
    // seznam všechn nezmenšených logů
    _logs.list(false, (err, logs) => {
        if (!err && logs && logs.length > 0) {
            logs.forEach((log) => {
                // kompress data do jiného souboru
                const logId = log.replace('.log', '');
                const newFileId = `${logId}-${Date.now()}`;

                _logs.compress(logId, newFileId, (err) => {
                    if (!err) {
                        // truncate the log, vyčistit původní soubor
                        _logs.truncate(logId, (err) => {
                            if (!err) {
                                debug('\x1b[33m%s\x1b[0m', '👾 Log soubor vyprázdněn.');
                            } else {
                                debug('\x1b[33m%s\x1b[0m', '👾 Chyba při čištění logu.');
                            }
                        });
                    } else {
                        debug('\x1b[33m%s\x1b[0m', '👾 Chyba při kompresi souboru.');
                    }
                });
            });
        } else {
            debug('\x1b[33m%s\x1b[0m', '👾 Neexistují logy ke kompresi.');
        }
    });
};

// časovač na spuštění rotateLogs jednou za den
workers.logRotationLoop = function() {
    setInterval(() => {
        this.rotateLogs();
    }, 1000 * 60 * 60 * 24); // jednou za den
};

// init workers
workers.init = function() {
    console.log('\x1b[33m%s\x1b[0m','👾 WORKER IS 🏃‍');

    // spusit kontrolu všech checks
    this.gatherAllChecks();

    // spustit cyklus, aby se kontrola prováděla sama
    this.loop();

    // spustit kompresi logů
    this.rotateLogs();

    // komprese logů jednou za 24 hod.
    this.logRotationLoop();
};

module.exports = workers;
