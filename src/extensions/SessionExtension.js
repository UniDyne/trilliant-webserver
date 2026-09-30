/*================================
    SESSIONS
================================*/
const fs = require('fs'),
    path = require('path'),
    crypto = require('crypto');

const { Cache } = require('trilliant');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        //fs.writeFileSync(this.getStoragePath(), JSON.stringify([...this]), "utf8");
        const p = this.getStoragePath();
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify([...this]), "utf-8");

        return this;
    }

    destroy() {
        this.clear();
        // need to remove session on disk, if exists
        let p = this.getStoragePath();
        fs.stat(p, (err, stat) => {
            if(err) return;
            fs.unlink(p, () => {});
        });
    }
    
    retrieve() {
        // read session from disk
        //var infile = path.join(process.cwd(), 'sessions', `${this.id}.dat`);
        
        //var map = JSON.parse(fs.readFileSync(infile));
        //map.forEach(entry => this.set.apply(this, entry));

        try {
            var map = JSON.parse(fs.readFileSync(this.getStoragePath(), 'utf-8'));
            map.forEach(entry => this.set.apply(this, entry));
        } catch(e) {
            this.clear();
        }

        return this;
    }
}


class SessionExtension {
    constructor(webserver, config) {
        this.webserver = webserver;

        webserver.on('requestStart', this.connectSession.bind(this));
        webserver.on('requestEnd', this.saveSessionState.bind(this));

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
        //if(sess_id == undefined) return req.Session = new Session();
        if(sess_id == undefined || !UUID_RE.test(sess_id)) sess_id = undefined;
        if(sess_id == undefined) req.Session = new Session();
        else req.Session = this.loadSession(sess_id);

        req.prependListener('headers', () => {
            if(req.Session && !req.Session.isEmpty()) {
                var cookie = req.Cookies.setCookie(this.COOKIE_NAME, req.Session.id);
                cookie.Path = '/';
                cookie.HttpOnly = true;
                cookie.Secure = true;
            }
        });

        return req.Session;
    }

    loadSession(sess_id) {
        var sess = this.SessionCache.get(sess_id);
        if(sess == null) {
            sess = new Session(sess_id);
            sess.retrieve();
        }

        return sess;
    }

    saveSessionState(req) {
        if(req.Session && !req.Session.isEmpty()) {
            //req.Cookies.setCookie(this.COOKIE_NAME, req.Session.id); // config cookie name
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
