/*
* Hlavní soubor pro API
*/

// dependencies
const http = require('http');
const url = require('url'); // url module pro parsování a práci s url
const StringDecoder = require('string_decoder').StringDecoder;

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
    req.on('end', function(data) {
        // ukončení zápisu do bufferu
        // decoder.end() => z dokumentace NodeJS, je potřeba to zavolat, protože StringDecoder má svůj vnitřní buffer, ve kterém si drží zbývající input data
        buffer += decoder.end();

        // až po ukončení přenusu dat odešlu odpověď a zaloguji to
        // odeslat odpověď
        res.end('Hello world.\n');

        // zalogovat cestu
        // console.log(`Requested path ${trimmedPath} by ${method} with headers ${JSON.stringify(headers, null, 4)} with query: ${JSON.stringify(queryStringObject, null, 4)}`);
        console.log(`Request received with this payload: `, buffer);
    });
});

// port 3000
server.listen(3000, function() {
    console.log('The server is listening on port 3000.');
});

