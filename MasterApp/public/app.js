// frontend

const app = {};

app.config = {
    'sessionToken': false,
};

// AJAX client pro RESTful API
app.client = {};

// interface
app.client.request = function(headers, path, method, queryStringObject, payload, callback) {
    // nastavení defaultních hodnot
    headers = typeof(headers) === 'object' && headers !== null ? headers : {};
    path = typeof(path) === 'string' ? path : '/';
    method = typeof(method) === 'string' && ['POST','GET','PUT','DELETE'].indexOf(method.toUpperCase()) > -1 ? method.toUpperCase() : 'GET';
    queryStringObject = typeof(queryStringObject) == 'object' && queryStringObject !== null ? queryStringObject : {};
    payload = typeof(payload) === 'object' && payload !== null ? payload : {};
    callback = typeof(callback) == 'function' ? callback : false;

    // pro každý poslaný query string parametr, přidat do path
    let requestUrl = `${path}?`;
    let counter = 0;
    for (let queryKey in queryStringObject) {
        if (queryStringObject.hasOwnProperty(queryKey)) {
            counter++;

            // pokud alespoň jeden query string parametr byl již přidán, připojím další parametr "&"
            if (counter > 1) {
                requestUrl += '&';
            }

            // přidat key values
            requestUrl += `${queryKey}=${queryStringObject[queryKey]}`;
        }
    }

    // vytvořit html request jako JSON
    const xhr = new XMLHttpRequest();
    xhr.open(method, requestUrl, true);
    xhr.setRequestHeader('Content-Type', 'application/json');

    // přidat každou další header položku
    for (let headerKey in headers) {
        if (headers.hasOwnProperty(headerKey)) {
            xhr.setRequestHeader(headerKey, headers[headerKey]);
        }
    }

    // existuje session token?
    if (app.config.sessionToken) {
        xhr.setRequestHeader('token', app.config.sessionToken.id);
    }

    // přijatý výsledek request
    xhr.onreadystatechange = function() {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            const statusCode = xhr.status;
            const response = xhr.responseText;

            // if callback
            if (callback) {
                try {
                    const parsedResponse = JSON.parse(response);
                    callback(statusCode, parsedResponse);
                } catch (err) {
                    callback(statusCode, false);
                }
            }
        }
    }

    // poslat payload jako JSON
    const payloadString = JSON.stringify(payload);
    xhr.send(payloadString);
};
