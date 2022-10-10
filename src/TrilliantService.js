const 
    fs = require("fs"),
    path = require("path");

const {ServiceWrapper} = require('trilliant');

const WebServer = require('./WebServer');

module.exports = class TrilliantService extends ServiceWrapper {
    constructor(app, config) {
        super(app, config);

        if(typeof config === "string")
            config = JSON.parse(fs.readFileSync(path.join(app.Env.appPath, config), "utf8"));

        this.WebServer = new WebServer(config);
    }

    start() { this.WebServer.start(); }
    stop() { this.WebServer.stop(); }

    register(plug, data) {
        if(data.channel && typeof data.channel === "string") {
            plug.id = data.channel;
            this.WebServer.registerChannel(plug);
            console.log(`Register channel ${data.channel}`);
        }

        if(data.path && typeof data.path ==="string")
            this.WebServer.registerPath(data.path, path.join(plug.homeDir, data.path));
        if(data.path && typeof data.path === "object")
            this.WebServer.registerPath(data.path.name, path.join(plug.homeDir, data.path.path));
        if(data.routes) {
            var k = Object.keys(data.routes);
            for(var i = 0, L = k.length; i < L; i++) {
                this.WebServer.registerRoute(k[i], data.routes[k[i]].bind(plug));
            }
        }
    }
};
