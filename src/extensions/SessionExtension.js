/*================================
    SESSIONS
================================*/
const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

const { Cache } = require('trilliant');

class Session extends Map {
    constructor(SID) {
        super();

        if(SID) this.id = SID;
        else this.id = crypto.randomUUID();
    }

    isEmpty() { return this.size == 0; }

    getStoragePath() {
        return path.join(process.cwd(), 'sessions', `${this.id}.dat`);
    }

    // using writeFileSync for now
    store() {
        if(this.size == 0)
            return this.destroy();
        
        // store non-empty session to disk
        fs.writeFileSync(this.getStoragePath(), JSON.stringify([...this]), "utf8");

        return this;
    }

    destroy() {
        this.clear();
        // need to remove session on disk, if exists
        let p = this.getStoragePath();
        fs.stat(p, (err, stat) => {
            if(err) return;
            fs.unlink(p);
        });
    }
    
    retrieve() {
        // read session from disk
        var infile = path.join(process.cwd(), 'sessions', `${this.id}.dat`);

        var map = JSON.parse(fs.readFileSync(infile));
        map.forEach(entry => this.set.apply(this, entry));

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
            value: 'session'
        });
    }

    connectSession(req, res, path) {
        var sess_id = req.Cookies.getCookie(this.COOKIE_NAME);
        
        // new session
        if(sess_id == undefined) return req.Session = new Session();

        
        var sess = this.SessionCache.get(sess_id);
        if(sess == null) {
            sess = new Session(sess_id);
            sess.retrieve();
        }

        return req.Session = sess;
    }

    saveSessionState(req) {
        if(req.Session && !req.Session.isEmpty()) {
            req.Cookies.setCookie(this.COOKIE_NAME, req.Session.id); // config cookie name
            this.SessionCache.set(req.Session.id, req.Session);
        }
        // if the session is empty... need to remove from Cache if present...
        // this is to handle destroyed sessions
    }
}

module.exports = {
    WebExtension: SessionExtension, // required
    Session: Session
};
