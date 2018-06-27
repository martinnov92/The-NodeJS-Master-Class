
/*
* Hlavní soubor pro API
*/

const cli = require('./lib/cli');
const server = require('./lib/server');
const workers = require('./lib/workers');

// declare app
const app = {
    init() {
        // start server
        server.init();

        // start workers
        workers.init();

        // start CLI, ale musí se spustit poslední
        setTimeout(() => {
            cli.init();
        }, 0);
    },
};

// execute init
app.init();

// export app
module.exports = app;

// ! OPENSSL vytvoření certifikátu
// openssl req -newkey rsa:2048 -new -nodes -x509 -days 3650 -keyout key.pem -out cert.pem
