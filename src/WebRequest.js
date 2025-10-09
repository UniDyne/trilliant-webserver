const http = require('http');

class WebRequest extends http.IncomingMessage {
    #uri;

    setResponse(res) { this.res = res }

    get uri() {
        if(!this.#uri) this.#uri =  new URL(`http://${this.headers['host'] ?? 'localhost'}${this.url}`);
        return this.#uri;
    }
}

module.exports = WebRequest;
