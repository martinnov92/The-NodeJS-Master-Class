/**
 * Request handlers
*/

const _data = require('./data');
const helpers = require('./helpers');

// definování handlerů pro router
const handlers = {};

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
// TODO: pouze pro přihlášeného uživatele
handlers._users.get = (data, callback) => {
    // kontrola tel. čísla
    // získat číslo z queryString, protože se předává jako parametry URL
    const phone = typeof data.queryStringObject.phone === 'string' && data.queryStringObject.phone.trim().length === 9 ? data.queryStringObject.phone.trim() : false;

    if (phone) {
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
        callback(400, { 'Error': 'Chybějící povinná položka.' });
    }
};

// Users - put
// required data: phone
// optional data: firstName, lastName, password (alespoň jedno musí být poskytnuto)
// TODO: pouze pro přihlášeného uživatele
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
            })
        } else {
            callback(400, { 'Error': 'Chybějící údaje k aktualizaci.' })
        }
    } else {
        callback(400, { 'Error': 'Chybějící povinná položka.' })
    }
};

// Users - delete
// required field: phone
// TODO: pouze pro přihlášeného uživatele
// TODO: smazat ostatní soubory spojené s uživatelem
handlers._users.delete = (data, callback) => {
    // kontrola tel. čísla
    // získat číslo z queryString, protože se předává jako parametry URL
    const phone = typeof data.queryStringObject.phone === 'string' && data.queryStringObject.phone.trim().length === 9 ? data.queryStringObject.phone.trim() : false;

    if (phone) {
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
        callback(400, { 'Error': 'Chybějící povinná položka.' });
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
