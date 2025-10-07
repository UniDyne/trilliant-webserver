const http = require('http');
const {URL} = require('url');

class WebRequest extends http.IncomingMessage {
    setResponse(res) { this.res = res }

    // getter for pre-parsed URL obj
    get uri() {
        if(!this._uri)
            this._uri = new URL(`http://${this.headers['host'] ?? 'localhost'}${this.url}`);
        return this._uri;
    }
}

module.exports = WebRequest;
