//const { stringify } = require("querystring");
const { decodeHeader, encodeHeader } = require('../headerUtils');


class Cookie {
    constructor(name, value) {
        this.name = name;
        this.value = value;
    }

    /*
        HttpOnly and Secure are keys without values.
        Anything that is undefined will NOT be included in output.
        BUT anything that is null will be output as key only.

        These can't be true/false since that would prevent actual 
        true/false values. Also, any other key that gets a null
        value should treat it as unset (undefined).
    */

    set Secure(v) { this.Secure = v?null:undefined; }
    get Secure() { return this.Secure == null; }

    set HttpOnly(v) { this.HttpOnly = v?null:undefined; }
    get HttpOnly() { return this.HttpOnly == null; }

    set Expires(v) { 
        if(typeof v === 'object' && v.constructor === Date)
            this.Expires = v.toUTCString();
    }
    
    get Expires() { return new Date(this.Expires); }

    set ["Max-Age"](v) { this["Max-Age"] = (v!=null?v:undefined); }
    set Domain(v) { this.Domain = (v!=null?v:undefined); }
    set Path(v) { this.Path = (v!=null?v:undefined); }
    

    stringify() {
        this[this.name] = this.value;

        // encode as cookie, ensure proper key value order
        return encodeHeader(this, [
            this.name,
            'Expires',
            'Max-Age',
            'Domain',
            'Path',
            'Secure',
            'HttpOnly'
        ]);

        var list = [];

        list.push( this.name + '=' + encodeURIComponent( this.value ) );

        if(this.Expires) list.push( 'Expires=' + this.Expires.toUTCString() );
        if(this.MaxAge) list.push( 'Max-Age=' + this.MaxAge );
        if(this.Domain) list.push( 'Domain=' + encodeURIComponent( this.Domain ) );
        if(this.Path) list.push( 'Path=' + encodeURIComponent( this.Path ) );
        if(this.Secure) list.push( 'Secure' );
        if(this.HttpOnly) list.push( 'HttpOnly' );

        return list.join('; ');
    }
}

class Cookies {
    constructor(request, response) {
        this.request = request;
        this.response = response;
        this.list = {};
        this.pending = [];

        request.Cookies = this;
        response.Cookies = this;

        var rc = request.headers.cookie;
        if(rc) this.list = decodeHeader(rc);

        /*
        rc && rc.split(';').forEach(function(cookie) {
            var parts = cookie.split(/=(.+)/);
            this.list[parts[0].trim()] = decodeURI(parts[1].trim());
        }.bind(this));
        */
    }

    setCookie(name, value) {
        var cookie = new module.exports.Cookie(name, value);
        this.pending.push(cookie);
        return cookie;
    }

    getCookie(name) {
        if(this.pending[name]) return this.pending[name].value;
        else return this.list[name];
    }

    writeCookies() {
        this.pending.forEach((c) => this.response.setHeader('Set-Cookie', c.stringify()));
    }
}

class CookieExtension {
    constructor(webserver, config) {
        // on every request, add cookie functionality
        webserver.on('requestStart', (request, response) => new module.exports.Cookies(request, response));
        webserver.on('headers', (response) => response.Cookies.writeCookies());
    }
}

module.exports = {
    Cookie: Cookie,
    Cookies: Cookies,

    WebExtension: CookieExtension // required
}