const fs = require('fs');
const url = require('url'); // url module pro parsování a práci s url
const path = require('path');
const http = require('http');
const util = require('util');
const https = require('https');
const debug = util.debuglog('server'); // TODO: použití NODE_DEBUG=server
const StringDecoder = require('string_decoder').StringDecoder; // string decoder pro práci s Buffer

// moje soubory
const config = require('./config');
const helpers = require('./helpers');
const handlers = require('./handlers');

// server module object
const server = {
    // ! nastavení https serveru, bez poskytnutí klíče a certifikátu nebude https fungovat
    httpsServerOptions: {
        'key': fs.readFileSync(path.join(__dirname, '../../Section 3/Adding HTTPS support/https/key.pem'), 'utf8'),
        'cert': fs.readFileSync(path.join(__dirname, '../../Section 3/Adding HTTPS support/https/cert.pem'), 'utf8'),
    },
};

// logika serveru pro http a https
server.unifiedServer = function(req, res) {
    // získat headers jako object
    const { headers } = req;

    // - 2. parametr - true => parse query string, true říká aby se volal queryString module, 2 v 1
    const parsedUrl = url.parse(req.url, true);

    // získat cestu + odebrat lomítka na začátku a na konci url
    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, '');

    // query string
    const queryStringObject = parsedUrl.query;

    // získat HTTP metodu
    const method = req.method.toLowerCase();

    // získat payload, pokud tam nějaká je
    const decoder = new StringDecoder('utf8');

    // payload data (body na requestu) se do serveru dostávájí kousek po kousku, NodeJS používá tvz. streams => vytvořím si 'buffer'
    let buffer = '';
    req.on('data', (data) => {
        // zapíšu data do bufferu a dekóduji je pomocí NodeJS dekoderu
        buffer += decoder.write(data);
    });

    // ukončení přenusu streamů
    req.on('end', () => {
        // ukončení zápisu do bufferu
        // decoder.end() => z dokumentace NodeJS, je potřeba to zavolat, protože StringDecoder má svůj vnitřní buffer, ve kterém si drží zbývající input data
        buffer += decoder.end();

        // zvolení handleru, který potřebuje tenhle request, pokud neexistuje => vrátit 404
        const chosenHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

        // vytvoření data objectu pro předání do handleru
        const data = {
            method,
            headers,
            trimmedPath,
            queryStringObject,
            payload: helpers.parseJsonToObject(buffer),
        };

        // route request pro daný handler přiřazený v handlers
        chosenHandler(data, function(statusCode = 200, payload = {}, contentType = 'json') {
            // nastavit do headru status code, content type, ukončit přenos a odeslat odpověď
            // content-specific
            let payloadString = '';

            if (contentType === 'json') {
                res.setHeader('Content-Type', 'application/json');
                // convert payload na string
                payloadString = JSON.stringify(payload);
            } else {
                res.setHeader('Content-Type', 'text/html');
                payloadString = typeof payload === 'string' ? payload : '';
            }

            // společná odpověď
            res.writeHead(statusCode);
            res.end(payloadString);

            // zalogovat cestu
            if (statusCode === 200) {
                debug('\x1b[32m%s\x1b[0m', `🖥  Request: ${req.url}.`);
            } else {
                debug('\x1b[31m%s\x1b[0m', `🖥  Request: ${req.url}.`);
            }
        });
    });
};

// router
server.router = {
    // index route
    '': handlers.index,

    // api
    'ping': handlers.ping,
    'api/users': handlers.users,
    'api/tokens': handlers.tokens,
    'api/checks': handlers.checks,

    // static sites

    // uživatel
    'session/create': handlers.sessionCreate,
    'session/deleted': handlers.sessionDeleted,
    'account/create': handlers.accountCreate,
    'account/edit': handlers.accountEdit,
    'account/deleted': handlers.accountDeleted,

    // checks
    'checks/all': handlers.checkList,
    'checks/create': handlers.checksCreate,
    'checks/edit': handlers.checksEdit,
};

// inicializace HTTP a HTTPS serveru
server.httpServer = http.createServer(server.unifiedServer);
server.httpsServer = https.createServer(this.httpsServerOptions, server.unifiedServer);

server.init = function() {
    // start http server
    this.httpServer.listen(config.http, () => {
        console.log('\x1b[36m%s\x1b[0m', `🖥  The server is listening on port ${config.http}.`);
    });

    // start https server
    this.httpsServer.listen(config.https, () => {
        console.log('\x1b[36m%s\x1b[0m', `🖥  The server is listening on port ${config.https}. 🔐`);
    });
};

module.exports = server;
