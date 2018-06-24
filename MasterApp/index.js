/*
* Hlavní soubor pro API
*/

// dependencies
const http = require('http');
// url module pro parsování a práci s url
const url = require('url');

const server = http.createServer(function(req, res) {
    // získat url a zparsovat

    // - 2. parametr - true => parse query string, true říká aby se volal queryString module, 2 v 1
    const parsedUrl = url.parse(req.url, true);

    // získat cestu
    const path = parsedUrl.pathname;

    // odebrat lomítka na začátku a na konci url
    const trimmedPath = path.replace(/^\/+|\/+$/g, '');

    // odeslat odpověď
    res.end('Hello world.\n')

    // zalogovat cestu
    console.log('Requested url', trimmedPath);
});

// port 3000
server.listen(3000, function() {
    console.log('The server is listening on port 3000.');
});

