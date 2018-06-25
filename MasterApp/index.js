/*
* Hlavní soubor pro API
*/

// dependencies
const http = require('http');
const url = require('url'); // url module pro parsování a práci s url
const StringDecoder = require('string_decoder').StringDecoder; // string decoder pro práci s Buffer
const config = require('./config');

const server = http.createServer(function(req, res) {
    // získat url a zparsovat

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
    const method = req.method.toLocaleLowerCase();

    // získat payload, pokud tam nějaká je
    const decoder = new StringDecoder('utf8');

    // payload data (body na requestu) se do serveru dostávájí kousek po kousku, NodeJS používá tvz. streams => vytvořím si 'buffer'
    let buffer = '';
    req.on('data', function(data) {
        // zapíšu data do bufferu a dekóduji je pomocí NodeJS dekoderu
        buffer += decoder.write(data);
    });

    // ukončení přenusu streamů
    req.on('end', function() {
        // ukončení zápisu do bufferu
        // decoder.end() => z dokumentace NodeJS, je potřeba to zavolat, protože StringDecoder má svůj vnitřní buffer, ve kterém si drží zbývající input data
        buffer += decoder.end();

        // zvolení handleru, který potřebuje tenhle request, pokud neexistuje => vrátit 404
        const chosenHandler = typeof(router[trimmedPath]) !== 'undefined' ? router[trimmedPath] : handlers.notFound;

        // vytvoření data objectu pro předání do handleru
        const data = {
            method,
            headers,
            trimmedPath,
            payload: buffer,
            queryStringObject,
        };

        // route request pro daný handler přiřazený v handlers
        chosenHandler(data, function(statusCode = 200, payload = {}) {
            // convert payload na string
            const payloadString = JSON.stringify(payload);

            // nastavit do headru status code, content type, ukončit přenos a odeslat odpověď
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(statusCode);
            res.end(payloadString);

            // zalogovat cestu
            // console.log(`Requested path ${trimmedPath} by ${method} with headers ${JSON.stringify(headers, null, 4)} with query: ${JSON.stringify(queryStringObject, null, 4)}`);
            console.log(`Returning this response: ${statusCode} (status code), ${payloadString}`);
        });
    });
});

// port 3000
server.listen(config.port, function() {
    console.log(`The server is listening on port ${config.port}. Env name: ${config.envName}`);
});

// definování handlerů pro router
const handlers = {};

handlers.sample = function(data, callback) {
    // callback http status code a payload (paylod === object)
    callback(406, { 'name': 'sample handler' });
};

// NOT FOUND 404 handlers
handlers.notFound = function(data, callback) {
    callback(404);
};

// router
const router = {
    'sample': handlers.sample,
};
