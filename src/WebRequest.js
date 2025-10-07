const http = require('http');
const {URL} = require('url');

class WebRequest extends http.IncomingMessage {
    setResponse(res) { this.res = res }

    // getter for pre-parsed URL obj
    get uri() {
        if(!this.uri)
            this.uri = new URL(`http://${this.headers['host'] ?? 'localhost'}${this.url}`);
        return this.uri;
    }
}

module.exports = WebRequest;
