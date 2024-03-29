const 
    http = require('http'),
    https = require('https'),
    cluster = require('cluster'),
    EventEmitter = require("events");
const fs = require('fs'), path = require('path');

const { DEFAULT_CONFIG, MIME_TYPES } = require('./constants');
const { requestHandler } = require('./defaultHandlers');
const { loadExtensions } = require('./WebExtensions');

const WebRequest = require('./WebRequest');
const WebResponse = require('./WebResponse');



function processConfig(config) {
    let dir = process.cwd();


    if(config.hasOwnProperty('rootpath'))
        config.rootpath = path.join(dir, config.rootpath);
    else config.rootpath = dir;
    
    if(config.hasOwnProperty('virtual_paths')) {
        for(var i = 0; i < config['virtual_paths'].length; i++) {
            //if(!conf['virtual_paths'][i].absolute) conf['virtual_paths'][i].actual = path.join(process.cwd(), conf['virtual_paths'][i].actual);
            this.registerPath(config['virtual_paths'][i].virtual, config['virtual_paths'][i].actual);
        }
    }

    if(config.hasOwnProperty('mimetypes') && typeof config.mimetypes === 'string') try {
        // merge mime type confiuration
        Object.assign(MIME_TYPES, JSON.parse(fs.readFileSync(path.join(dir, config.mimetypes))));
    } catch(e) { console.error(e); }

    // read SSL cert data
    if(config.hasOwnProperty('ssl') && config.secure) try {
        config.ssl.key = fs.readFileSync(path.join(dir, config.ssl.key));
        config.ssl.cert = fs.readFileSync(path.join(dir, config.ssl.cert));
    } catch(e) { console.error('Failed to load SSL certificates.'); console.error(e); }
}




module.exports = class WebServer extends EventEmitter {

    #routes = [];
    #virtualPaths = {};

    #webroot;
    #port;
    #server;
    #proxy;
    //#workers;
    #requestHandler;

    constructor(config) {
        super();

        this.Config = Object.assign({}, DEFAULT_CONFIG, config);

        this.root = this.Config.rootpath;
        this.port = this.Config.port;

        this.#requestHandler = requestHandler.bind(this);

        // load configuration
        processConfig.apply(this, [this.Config]);

        // load extensions...
        if(this.Config.extensions && this.Config.extensions.length > 0)
            loadExtensions.apply(this, [this.Config.extensions]);
    }


    /*
        PATHS & ROUTES
    */

    registerPath(virtpath, actualpath) {
        if(!path.isAbsolute(actualpath)) actualpath = path.join(process.cwd(), actualpath);
        this.#virtualPaths[virtpath] = actualpath;
    }

    unregisterPath(virtpath) { delete this.#virtualPaths[virtpath]; }

    registerRoute(rx, handler) {
        if(typeof rx === 'string') rx = new RegExp(rx);
        this.#routes.push({rx:rx, handler:handler});
    }

    getRouteHandler(pathname) {
        for(var i = 0; i < this.#routes.length; i++) {
            if(this.#routes[i].rx.test(pathname))
                return this.#routes[i].handler;
        }
        return null;
    }

    getVirtualPath(pathname) {
        if(this.#virtualPaths.hasOwnProperty(pathname))
            return this.#virtualPaths[pathname];
        return null;
    }

    /*
        PROPERTIES
    */
    get port() { return this.#port; }

    set port(port) {
        if(!port) port = 10000 + Math.floor(Math.random()*10000);
        this.#port = port;

        if(this.#server) {
            this.stop();
            this.start();
        }

        return this.#port;
    }

    set root(dirpath) { this.#webroot = dirpath; }

    get root() { return this.#webroot; }


    /*
        START STOP
    */

    start() {

        // use subclasses of IncomingMessage and ServerResponse...
        var props = { server: { configurable: false, enumerable: true, writable: false, value: this.#server } };
        var options = {
            IncomingMessage: class req extends WebRequest {
                constructor(...args) {
                    super(...args);
                    Object.defineProperties(this, props);
                }
            },
            ServerResponse: class res extends WebResponse {
                constructor(...args) {
                    super(...args);
                    Object.defineProperties(this, props);
                }
            }
        };

        if(!this.Config.secure || !this.Config.ssl) this.#server = new http.Server(options, this.#requestHandler);
        else {
            options.key = this.Config.ssl.key;
            options.cert = this.Config.ssl.cert;
            
            this.#server = new https.Server(options, this.#requestHandler);
            if(this.Config.useRedirect) this.#proxy = new RedirectProxy(this.#port, this.#server);
        }

        /* DISABLE CLUSTERING
        if(this.Config.cluster && cluster.isMaster)
            return this.startWorkers();
        */

        if(this.#proxy) this.#proxy.start();
        else this.#server.listen(this.#port);
        console.log(`Server listening on port ${this.#port}.`);
    }
    

    stop() {
        if(!this.#server) return;
        this.#server.close();
        this.#server = null;

        console.log(`Server stopped on port ${this.#port}.`);
    }


    /* workers / clustering is experimental... needs refactor */
    /*
    startWorkers() {
        let numCores = require('os').cpus().length;
        console.log(`Starting ${numCores - 1} workers.`);

        this.#workers = [];

        for(let i = 0; i < numCores - 1; i++) {
            this.#workers.push(cluster.fork());

            this.#workers[i].on('message', (mesg) => {
                console.log(mesg); //#! add message handling...
            });
        }

        // process is clustered on a core and process id is assigned
        cluster.on('online', function(worker) {
            console.log(`Worker ${worker.process.pid} is listening.`);
        });

        // if any of the worker process dies then start a new one by simply forking another one
        cluster.on('exit', (worker, code, signal) => {
            console.log('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal);
            console.log('Starting a new worker');
            cluster.fork();
            this.#workers.push(cluster.fork());
            // to receive messages from worker process
            this.#workers[this.#workers.length-1].on('message', (mesg) => {
                console.log(mesg); //#! add message handling...
            });
        });

    }
    */

};
