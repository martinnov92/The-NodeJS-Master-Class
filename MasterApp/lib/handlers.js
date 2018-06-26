/**
 * Request handlers
*/

const _data = require('./data');
const config = require('./config');
const helpers = require('./helpers');

// definování handlerů pro router
const handlers = {};

/**
 * ! HTML HANDLERS
*/

handlers.index = (data, callback) => {
    // odmítnout všechno co není get
    if (data.method === 'get') {
        // připravit data pro najít/nahradit (string interpolation)
        const templateData = {
            'head.title': 'Hlavní strana',
            'head.description': 'Hlavní strana - popisek',
            'body.class': 'index',
            'body.title': 'Body title',
        };

        // načíst index.html template jako string
        helpers.getTemplate('index', templateData, (err, str) => {
            if (!err && str) {
                // přidat hlavičku a patičku
                helpers.addUniversalTemplates(str, templateData, (err, str) => {
                    if (!err && str) {
                        callback(200, str, 'html');
                    } else {
                        callback(500, undefined, 'html');
                    }
                })
            } else {
                callback(500, undefined, 'html');
            }
        });
    } else {
        callback(405, undefined, 'html');
    }
};

/**
 * ! JSON API
*/
// Users
handlers.users = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._users[data.method](data, callback);
    } else {
        // 405 - method not allowed
        callback(405);
    }
};

// container for the users submethods
handlers._users = {};

// Users - post
// required data: firstName, lastName, phone, password, tosAgreement
// optional data: none
handlers._users.post = (data, callback) => {
    // zkontrolovat, jestli jsou vyplněná povinná pole
    const firstName = (typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0) ? data.payload.firstName.trim() : false;
    const lastName = (typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0) ? data.payload.lastName.trim() : false;
    const password = (typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;
    const phone = (typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length === 9) ? data.payload.phone.trim() : false;
    const tosAgreement = (typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement === true) ? true : false;

    if (firstName && lastName && phone && password && tosAgreement) {
        // zkontrolovat, jestli uživatel již existuje
        // uživatele ukládám podle tel. čísla
        _data.read('users', phone, (err, data) => {
            if (err) {
                // hash password
                const hashedPassword = helpers.hash(password);

                if (hashedPassword) {
                    // vytvoření user objectu
                    const userObject = {
                        firstName,
                        lastName,
                        phone,
                        password: hashedPassword,
                        tosAgreement: true,
                    };
    
                    // uložit uživatele na disk
                    _data.create('users', phone, userObject, (err) => {
                        if (!err) {
                            callback(200);
                        } else {
                            callback(500, { 'Error': 'Chyba při zápisu uživatele na disk.' });
                        }
                    });
                } else {
                    callback(500, { 'Error': 'Chyba při hashování hesla.' });
                }
            } else {
                callback(400, { 'Error': 'Uživatel již existuje.'})
            }
        });
    } else {
        callback(400, { 'Error': 'Prosím, vyplňte povinná pole.' });
    }
};

// Users - get
// required data: phone
// optional data: none
handlers._users.get = (data, callback) => {
    // kontrola tel. čísla
    // získat číslo z queryString, protože se předává jako parametry URL
    const phone = typeof data.queryStringObject.phone === 'string' && data.queryStringObject.phone.trim().length === 9 ? data.queryStringObject.phone.trim() : false;

    if (phone) {
        // získat token z hlavičky request
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;

        handlers._tokens.verifyToken(token, phone, (valid) => {
            if (valid) {
                // vyhledat uživatele
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        // odebrat hashedPassword z user object před zobrazením uživateli
                        delete data.password;
                        callback(200, data);
                    } else {
                        callback(404, { 'Error': 'Uživatel nenalezen.' });
                    }
                });
            } else {
                callback(403, { 'Error': 'Chybějící token v headers, nebo token není platný.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Users - put
// required data: phone
// optional data: firstName, lastName, password (alespoň jedno musí být poskytnuto)
handlers._users.put = (data, callback) => {
    // kontrola povinnýcho položek
    const phone = ((typeof data.payload.phone === 'string') && (data.payload.phone.trim().length === 9)) ? data.payload.phone.trim() : false;

    // kontrola volitelných položek
    const firstName = (typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0) ? data.payload.firstName.trim() : false;
    const lastName = (typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0) ? data.payload.lastName.trim() : false;
    const password = (typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;

    if (phone) {
        // error pokud nic neaktualizuji
        if (firstName || lastName || password) {
            // získat token z hlavičky request
            const token = typeof data.headers.token === 'string' ? data.headers.token : false;

            handlers._tokens.verifyToken(token, phone, (valid) => {
                if (valid) {
                    _data.read('users', phone, (err, userData) => {
                        if (!err && userData) {
                            // updatovat položky, které se změnili
                            if (firstName) {
                                userData.firstName = firstName;
                            }
        
                            if (lastName) {
                                userData.lastName = lastName;
                            }
        
                            if (password) {
                                userData.password = helpers.hash(password);
                            }
        
                            // uložit aktulizovaného uživatele
                            _data.update('users', phone, userData, (err) => {
                                if (!err) {
                                    callback(200);
                                } else {
                                    console.log(err);
                                    callback(500, { 'Error': 'Uživatel nemůže být aktulizován.' });
                                }
                            })
                        } else {
                            callback(400, { 'Error': 'Uživatel neexistuje.' });
                        }
                    });
                } else {
                    callback(403, { 'Error': 'Chybějící token v headers, nebo token není platný.' });
                }
            });
        } else {
            callback(400, { 'Error': 'Chybějící údaje k aktualizaci.' });
        }
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' })
    }
};

// Users - delete
// required field: phone
// TODO: smazat ostatní soubory spojené s uživatelem
handlers._users.delete = (data, callback) => {
    // kontrola tel. čísla
    // získat číslo z queryString, protože se předává jako parametry URL
    const phone = typeof data.queryStringObject.phone === 'string' && data.queryStringObject.phone.trim().length === 9 ? data.queryStringObject.phone.trim() : false;

    if (phone) {
        // získat token z hlavičky request
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;

        handlers._tokens.verifyToken(token, phone, (valid) => {
            if (valid) {
                // vyhledat uživatele
                _data.read('users', phone, (err, data) => {
                    if (!err && data) {
                        _data.delete('users', phone, (err) => {
                            if (!err) {
                                callback(200);
                            } else {
                                console.log(err);
                                callback(500, { 'Error': 'Při mazání nastala chyba.' });
                            }
                        });
                    } else {
                        callback(404, { 'Error': 'Uživatel nenalezen.' });
                    }
                });
            } else {
                callback(403, { 'Error': 'Chybějící token v headers, nebo token není platný.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Tokens
handlers.tokens = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];
    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._tokens[data.method](data, callback);
    } else {
        // 405 - method not allowed
        callback(405);
    }
};

handlers._tokens = {};

// Tokens - post
// required data: phone, password
// optional data: none
handlers._tokens.post = (data, callback) => {
    const password = (typeof data.payload.password === 'string' && data.payload.password.trim().length > 0) ? data.payload.password.trim() : false;
    const phone = (typeof data.payload.phone === 'string' && data.payload.phone.trim().length === 9) ? data.payload.phone.trim() : false;

    if (phone && password) {
        // najít uživatele
        _data.read('users', phone, (err, userData) => {
            if (!err && userData) {
                // zkontrolovat hesla
                const hashedPassword = helpers.hash(password);

                if (userData.password === hashedPassword) {
                    // pokud se hesla shodují, vytvořím token, nastavím expiraci na +1 hodinu
                    const tokenId = helpers.createRandomString(20);
                    const expires = Date.now() + (1000 * 60 * 60);

                    if (tokenId) {
                        // uložím token na disk
                        const tokenObject = {
                            phone,
                            expires,
                            id: tokenId,
                        };
    
                        _data.create('tokens', tokenId, tokenObject, (err) => {
                            if (!err) {
                                callback(200, tokenObject);
                            } else {
                                console.log(err);
                                callback(500, { 'Error': 'Chyba při ukládání tokenu.' });
                            }
                        });
                    } else {
                        callback(500, { 'Error': 'Chyba při ukládání tokenu.' });
                    }
                } else {
                    callback(400, { 'Error': 'Hesla se neshodují.' });
                }
            } else {
                callback(400, { 'Error': 'Uživatel nenalezen.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinné položky.' });
    }
};

// Tokens - get
// required data: id
// optional data: none
handlers._tokens.get = (data, callback) => {
    // zkontrolovat, jestli je ID validní
    const id = typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;

    if (id) {
        // vyhledat uživatele
        _data.read('tokens', id, (err, data) => {
            if (!err && data) {
                callback(200, data);
            } else {
                callback(404, { 'Error': 'Token nenalezen.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Tokens - put
// required fields: id, extend (pro delší platnost tokenu)
// optional data: none
handlers._tokens.put = (data, callback) => {
    const id = ((typeof data.payload.id === 'string') && (data.payload.id.trim().length === 20)) ? data.payload.id.trim() : false;
    const extend = ((typeof data.payload.extend === 'boolean') && (data.payload.extend === true)) ? true : false;

    if (id && extend) {
        // vyhledat token
        _data.read('tokens', id, (err, tokenData) => {
            if (!err && tokenData) {
                // kontrola jestli token má validné platnost
                if (tokenData.expires > Date.now()) {
                    // nastavit novou expiraci
                    tokenData.expires = Date.now() + (1000 * 60 * 60);

                    // uložit změny
                    _data.update('tokens', id, tokenData, (err) => {
                        if (!err) {
                            callback(200, tokenData);
                        } else {
                            console.log(err);
                            callback(500, { 'Error': 'Chyba při aktualizaci tokenu.' });
                        }
                    });
                } else {
                    callback(400, { 'Error': 'Platnost tokenu vypršela a nemůže být prodloužena.' });
                }
            } else {
                callback(400, { 'Error': 'Token nenalezen.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinné údaje.' });
    }
};

// Tokens - delete
// required data: id
// optional data: none
handlers._tokens.delete = (data, callback) => {
    const id = typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;

    if (id) {
        // vyhledat uživatele
        _data.read('tokens', id, (err, data) => {
            if (!err && data) {
                _data.delete('tokens', id, (err) => {
                    if (!err) {
                        callback(200);
                    } else {
                        console.log(err);
                        callback(500, { 'Error': 'Při mazání nastala chyba.' });
                    }
                });
            } else {
                callback(404, { 'Error': 'Token nenalezen.' });
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// ověření uživatele (platnost + uživatel)
handlers._tokens.verifyToken = (id, phone, callback) => {
    // vyhledání tokenu
    _data.read('tokens', id, (err, tokenData) => {
        if (!err && tokenData) {
            // kontrola platnosti tokenu a jestli nevypršel
            if ((tokenData.phone === phone) && (tokenData.expires > Date.now())) {
                callback(true);
            } else {
                callback(false);
            }
        } else {
            callback(false);
        }
    });
};

// Checks
handlers.checks = (data, callback) => {
    const acceptableMethods = ['post', 'get', 'put', 'delete'];

    if (acceptableMethods.indexOf(data.method) > -1) {
        handlers._checks[data.method](data, callback);
    } else {
        // 405 - method not allowed
        callback(405);
    }
}

handlers._checks = {};

// Checks - post
// required data: protocol, url, method, successCodes, timeoutSeconds
// optional data: none
handlers._checks.post = (data, callback) => {
    // validate inputs
    const url = ((typeof data.payload.url === 'string') && (data.payload.url.trim().length > 0)) ? data.payload.url.trim() : false;
    const protocol = ((typeof data.payload.protocol === 'string') && (['https', 'http'].indexOf(data.payload.protocol) > -1)) ? data.payload.protocol : false;
    const method = ((typeof data.payload.method === 'string') && (['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1)) ? data.payload.method : false;
    const successCodes = ((typeof data.payload.successCodes === 'object') && (data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0)) ? data.payload.successCodes : false;
    const timeoutSeconds = ((typeof data.payload.timeoutSeconds === 'number') && (data.payload.timeoutSeconds % 1 === 0) && (data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5)) ? data.payload.timeoutSeconds : false;

    if (protocol && url && method && successCodes && timeoutSeconds) {
        // získání tokenu z hlavičky
        const token = typeof data.headers.token === 'string' ? data.headers.token : false;

        // získání uživatele z tokenu
        _data.read('tokens', token, (err, tokenData) => {
            if (!err && tokenData) {
                const userPhone = tokenData.phone;

                // získání uživatele
                _data.read('users', userPhone, (err, userData) => {
                    if (!err && userData) {
                        // zkontrolovat jestli už uživatel má uloženy nějaké checks
                        const userChecks = (typeof userData.checks === 'object' && userData.checks instanceof Array) ? userData.checks : []; 

                        // zkontrolovat množství checks
                        if (userChecks.length < config.maxChecks) {
                            // vytvoření náhodného id pro check
                            const checkId = helpers.createRandomString(20);

                            // vytvořit check object a přidat uživatelův telefon
                            const checkObject = {
                                id: checkId,
                                url,
                                protocol,
                                method,
                                timeoutSeconds,
                                successCodes,
                                phone: userPhone,
                            };

                            // uložit checks na disk
                            _data.create('checks', checkId, checkObject, (err) => {
                                if (!err) {
                                    // uložit checkId na uživatelův účet
                                    userData.checks = userChecks;
                                    userData.checks.push(checkId);

                                    // uložit nová data
                                    _data.update('users', userPhone, userData, (err) => {
                                        if (!err) {
                                            // vrátit data o novém záznamu
                                            callback(200, checkObject);  
                                        } else {
                                            console.log(err);
                                            callback(500, { 'Error': 'Nebylo možné vytvořit záznam.' });
                                        }
                                    });
                                } else {
                                    console.log(err);
                                    callback(500, { 'Error': 'Nebylo možné vytvořit záznam.' });
                                }
                            })
                        } else {
                            // má víc než config.maxcheckes záznamů, není možné pokračovat
                            callback(400, { 'Error': `Uživatel má uložen maximální počet záznamů (${config.maxChecks}).` });
                        }
                    } else {
                        // 403 - unauthorized
                        callback(403);
                    }
                });
            } else {
                callback(403);
            }
        });
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Checks - get
// required data: id
// optional data: none
handlers._checks.get = (data, callback) => {
    const id = typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;

    if (id) {
        // vyhledat záznam
        _data.read('checks', id, (err, checksData) => {
            if (!err && checksData) {
                // získat token z hlavičky request
                const token = typeof data.headers.token === 'string' ? data.headers.token : false;

                handlers._tokens.verifyToken(token, checksData.phone, (valid) => {
                    if (valid) {
                        // pokud je token validní -> vrátit záznam
                        callback(200, checksData);
                    } else {
                        callback(403, { 'Error': 'Chybějící token v headers, nebo token není platný.' });
                    }
                });
            } else {
                callback(404);
            }
        })
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Checks - put
// required data: id
// optional data: protocol, url, method, successCodes, timeoutSeconds
handlers._checks.put = (data, callback) => {
    const id = typeof data.queryStringObject.id === 'string' && data.queryStringObject.id.trim().length === 20 ? data.queryStringObject.id.trim() : false;

    // Check for optional fields
    const protocol = typeof(data.payload.protocol) == 'string' && ['https','http'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
    const url = typeof(data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
    const method = typeof(data.payload.method) == 'string' && ['post','get','put','delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
    const successCodes = typeof(data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
    const timeoutSeconds = typeof(data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 === 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

    if(id){
        // Error if nothing is sent to update
        if(protocol || url || method || successCodes || timeoutSeconds){
            // Lookup the check
            _data.read('checks', id, (err,checkData) => {
                if(!err && checkData){
                    // Get the token that sent the request
                    const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                    // Verify that the given token is valid and belongs to the user who created the check
                    handlers._tokens.verifyToken(token, checkData.phone, (tokenIsValid) => {
                        if(tokenIsValid){
                            // Update check data where necessary
                            if(protocol) {
                                checkData.protocol = protocol;
                            }

                            if(url) {
                                checkData.url = url;
                            }

                            if(method) {
                                checkData.method = method;
                            }

                            if(successCodes) {
                                checkData.successCodes = successCodes;
                            }

                            if(timeoutSeconds) {
                                checkData.timeoutSeconds = timeoutSeconds;
                            }

                            // Store the new updates
                            _data.update('checks', id, checkData, (err) => {
                                if(!err) {
                                    callback(200, checkData);
                                } else {
                                    callback(500, {'Error' : 'Záznam není možné aktualizovat.'});
                                }
                            });
                        } else {
                            callback(403);
                        }
                    });
                } else {
                    callback(400, {'Error' : 'Záznam neexistuje.'});
                }
            });
        } else {
            callback(400, {'Error' : 'Chybějící položky k aktualizaci.'});
        }
    } else {
        callback(400, {'Error' : 'Chybějící povinná položka.'});
    }
};

// Checks - delete
// Required data: id
// Optional data: none
handlers._checks.delete = (data, callback) => {
    // Check that id is valid
    const id = typeof(data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;

    if(id){
        // Lookup the check
        _data.read('checks', id, (err, checkData) => {
            if(!err && checkData){
                // Get the token that sent the request
                const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
                // Verify that the given token is valid and belongs to the user who created the check
                handlers._tokens.verifyToken(token, checkData.phone, (valid) => {
                    if(valid){
                        // Delete the check data
                        _data.delete('checks', id, (err) => {
                            if(!err){
                                // Lookup the user's object to get all their checks
                                _data.read('users', checkData.phone, (err, userData) => {
                                    if(!err){
                                        const userChecks = typeof(userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                                        // Remove the deleted check from their list of checks
                                        const checkPosition = userChecks.indexOf(id);
                                        if(checkPosition > -1){
                                            // Re-save the user's data
                                            userChecks.splice(checkPosition,1);
                                            userData.checks = userChecks;

                                            _data.update('users', checkData.phone, userData, (err) => {
                                                if(!err){
                                                    callback(200);
                                                } else {
                                                    callback(500,{'Error' : 'Could not update the user.'});
                                                }
                                            });
                                        } else {
                                            callback(500,{"Error" : "Could not find the check on the user's object, so could not remove it."});
                                        }
                                    } else {
                                        callback(500,{"Error" : "Could not find the user who created the check, so could not remove the check from the list of checks on their user object."});
                                    }
                                });
                            } else {
                                callback(500,{"Error" : "Could not delete the check data."})
                            }
                        });
                    } else {
                        callback(403);
                    }
                });
            } else {
                callback(400,{"Error" : "The check ID specified could not be found"});
            }
        });
    } else {
        callback(400,{"Error" : "Missing valid id"});
    }
};

// route na pingnutí aplikace, která ověří že aplikace funguje, nebo nefunguje
// callback http status code a payload (paylod === object)
handlers.ping = (data, callback) => {
    // 200 - OK
    callback(200);
};

// NOT FOUND 404 handlers
handlers.notFound = (data, callback) => {
    callback(404);
};

module.exports = handlers;
