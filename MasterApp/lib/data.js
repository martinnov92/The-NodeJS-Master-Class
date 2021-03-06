/*
* Knihovna pro ukládání a načítání dat
*/

const fs = require('fs');
const path = require('path'); // normalize paths to different paths
const helpers = require('./helpers');

// container pro modul
const lib = {};
lib.baseDir = path.join(__dirname, '/../.data/');

// zápis do soubour
lib.create = function(dir, file, data, callback) {
    // otevřít soubor pro zápis
    fs.open(`${lib.baseDir}${dir}/${file}.json`, 'wx', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            // convert data to string
            const stringData = JSON.stringify(data, null, 4);

            // zapsat data do souboru a uzavřít (close)
            fs.writeFile(fileDescriptor, stringData, (err) => {
                if (!err) {
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false);
                        } else {
                            callback('Chyba při ukládání souboru.');
                        }
                    });
                } else {
                    callback('Chyba při zápis do nového souboru.');
                }
            });
        } else {
            callback('Error: nelze vytvořit nový soubor, možná již existuje.');
        }
    });
};

// čtení dat ze souboru
lib.read = function(dir, file, callback) {
    fs.readFile(`${lib.baseDir}${dir}/${file}.json`, 'utf8', (err, data) => {
        if (!err && data) {
            const parsedData = helpers.parseJsonToObject(data);
            callback(false, parsedData);
        } else {
            callback(err, data);
        }
    });
};

// update souboru
lib.update = function(dir, file, data, callback) {
    // open file pro zápis
    // r+ - writing + error pokud soubor neexistuje
    fs.open(`${lib.baseDir}${dir}/${file}.json`, 'r+', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            const stringData = JSON.stringify(data);

            // truncate the file
            fs.ftruncate(fileDescriptor, (err) => {
                if (!err) {
                    // zapsat do souboru
                    fs.writeFile(fileDescriptor, stringData, (err) => {
                        if (!err) {
                            fs.close(fileDescriptor, (err) => {
                                if (!err) {
                                    callback(false);
                                } else {
                                    callback('Chyba při ukončování zápisu do souboru.');
                                }
                            })
                        } else {
                            callback('Chyba při zápisu do existujícího souboru.');
                        }
                    });
                } else {
                    callback('Chyba při updatu souboru')
                }
            });
        } else {
            callback('Soubor není možné upravit. Možná ještě neexistuje.');
        }
    })
};

// smazání souboru
lib.delete = function(dir, file, callback) {
    // unlink file -> smazání souboru z disku
    fs.unlink(`${lib.baseDir}${dir}/${file}.json`, (err) => {
        if (!err) {
            callback(false);
        } else  {
            callback('Chyba při mazání souboru.');
        }
    });
};

// seznam všech položek a adresářů
lib.list = function(dir, callback) {
    fs.readdir(`${this.baseDir}/${dir}`, (err, data) => {
        if (!err && data && data.length > 0) {
            const trimmedFileNames = [];

            data.forEach((fileName) => {
                trimmedFileNames.push(fileName.replace('.json', ''));
            });

            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    });
};

// export
module.exports = lib;
