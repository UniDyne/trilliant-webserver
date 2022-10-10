/*================================
    SESSIONS
================================*/
const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

const { Cache } = require('trilliant');

class Session {
    constructor(SID) {
        //this.id = genSID();
        if(SID) this.id = SID;
        else this.id = crypto.randomUUID();
        
        Object.defineProperty(this, 'data', {
            writable: false,
            configurable: false,
            value: new Map()
        });

        // alias Map functions
        this.set = this.data.set;
        this.get = this.data.get;
        this.has = this.data.has;
        this.delete = this.data.delete;
        this.clear = this.data.clear;
    }

    isEmpty() {
        return this.data.size == 0;
    }

    // using writeFileSync for now
    store() {
        // store non-empty session to disk
        var outfile = path.join(process.cwd(), 'sessions', `${this.id}.dat`);
        fs.writeFileSync(outfile, JSON.stringify([...this.data]), "utf8");

        return this;
    }
    
    retrieve() {
        // read session from disk
        var infile = path.join(process.cwd(), 'sessions', `${this.id}.dat`);

        var map = JSON.parse(fs.readFileSync(infile));
        map.forEach(entry => this.set.apply(this.data, entry));

        return this;
    }
}


class SessionExtension {
    constructor(webserver, config) {
        this.webserver = webserver;

        webserver.on('requestStart', this.connectSession);
        webserver.on('requestEnd', this.saveSessionState);

        this.SessionCache = new Cache(32); // move to config...

        this.SessionCache.on('deref', (id, entry) => entry.store());

        // move to config
        Object.defineProperty(this, 'COOKIE_NAME', {
            writable: false,
            configurable: false,
            value: '_trilliant'
        });
    }

    connectSession(req, res, path) {
        var sess_id = req.Cookies.getCookie(this.COOKIE_NAME);
        
        // new session
        if(sess_id == undefined) return req.Session = new module.exports.Session();

        
        var sess = this.SessionCache.get(sess_id);
        if(sess == null) {
            sess = new module.exports.Session(sess_id);
            sess.retrieve();
        }

        return req.Session = sess;
    }

    saveSessionState(req) {
        if(req.Session && !req.Session.isEmpty()) {
            req.Cookies.setCookie(this.COOKIE_NAME, req.Session.id); // config cookie name
            this.SessionCache.set(req.Session.id, req.Session);
        }
    }
}

module.exports = {
    WebExtension: SessionExtension, // required
    Session: Session
};
