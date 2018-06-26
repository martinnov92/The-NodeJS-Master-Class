const fs = require('fs');
const path = require('path');
const zlib = require('zlib'); // komprese dat

const logs = {
    baseDir: path.join(__dirname, '/../.logs/'),
};

// přidat string do souboru, nebo pokud soubor neexistuje => vytvořit
logs.append = function(fileName, str, callback) {
    // oep file pro úpravu
    fs.open(`${this.baseDir}${fileName}.log`, 'a', (err, fileDescriptor) => {
        if (!err && fileDescriptor) {
            fs.appendFile(fileDescriptor, str + '\n', (err) => {
                if (!err) {
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                            callback(false);
                        } else {
                            callback('LOG: Chyba při ukládání souboru.');
                        }
                    });
                } else {
                    callback('LOG: Chyba při zápisu logu do souboru.');
                }
            });
        } else {
            callback('LOG: Zápis do logu se nezdařil.');
        }
    });
};

logs.list = function(includeCompressedLogs, callback) {
    fs.readdir(`${this.baseDir}`, (err, data) => {
        if (!err && data && data.length > 0) {
            let trimmedFileNames = [];

            data.forEach((fileName) => {
                // přidat .log soubory
                if (fileName.indexOf('.log') > -1) {
                    trimmedFileNames.push(fileName.replace('.log', ''));
                }

                // přidání kompres. souborů (.gz)
                if ((fileName.indexOf('.gz.b64') > -1) && includeCompressedLogs) {
                    trimmedFileNames.push(fileName.replace('.gz.b64', ''));
                }
            });

            callback(false, trimmedFileNames);
        } else {
            callback(err, data);
        }
    })
};

// komprese souborů do .gz + jako base64 => .gz.b64
logs.compress = function(logId, newFileId, callback) {
    const sourceFile = `${logId}.log`;
    const destinationFile = `${newFileId}.gz.b64`;

    // přečíst zdrojový soubor
    fs.readFile(`${this.baseDir}${sourceFile}`, 'utf8', (err, inputString) => {
        if (!err && inputString) {
            // kompres dat pomocí gzip
            // buffer obsahuje kompres. data
            zlib.gzip(inputString, (err, buffer) => {
                // poslat kompres. data do nového souboru
                fs.open(`${this.baseDir}${destinationFile}`, 'wx', (err, fileDescriptor) => {
                    if (!err && fileDescriptor) {
                        // zapsat do souboru
                        // zakodovat buffer do base64 stringu
                        fs.writeFile(fileDescriptor, buffer.toString('base64'), (err) => {
                            if (!err) {
                                // ukončit práci se souborem
                                fs.close(fileDescriptor, (err) => {
                                    if (!err) {
                                        callback(false);
                                    } else {
                                        callback(err);
                                    }
                                });
                            } else {
                                callback(err);
                            }
                        });
                    } else {
                        callback(err);
                    }
                });
            });
        } else {
            callback(err);
        }
    });
};

// dekomprimovat soubor .gz.b64 do stringu
logs.decompress = function(fileId, callback) {
    const fileName = `${fileId}.gz.b64`;

    fs.readFile(`${this.baseDir}${fileName}`, 'utf8', (err, str) => {
        if (!err && str) {
            // dekompres data
            // vytvořit data z base64
            const inputBuffer = Buffer.from(str, 'base64');
            zlib.unzip(inputBuffer, (err, outputBuffer) => {
                if (!err && outputBuffer) {
                    // callback
                    const str = outputBuffer.toString();
                    callback(false, str);
                } else {
                    callback(err);
                }
            });
        } else {
            callback(err);
        }
    });
};

// truncate a log file
logs.truncate = function(logId, callback) {
    fs.truncate(`${this.baseDir}${logId}.log`, 0, (err) => {
        if (!err) {
            callback(false);
        } else {
            callback(err);
        }
    });
};

module.exports = logs;
