/*================================
    NINJA
    NINJA is Node JSON API

    This module adds "channels" to the web server that are
    essentially web-addressable function calls.

    Uses events to establish notion of message passing. This
    allows queuing and asynchronicity.
================================*/

const EventEmitter = require("events");
const { MessageEnvelope } = require("trilliant");

/* Define Symbols for out-of-band fields */
const TOKEN = Symbol.for("TOKEN");


function ninjaHandler(request, response, uri) {
    // CORS Handler
    var cors = this.getConfig('cors');
    if(cors && cors.length > 0 && request.headers['origin']) {
        if(cors.includes(request.headers['origin'].replace(/^https?:\/\//,''))) {
            response.setHeader('Access-Control-Allow-Origin', request.headers['origin']);
            response.setHeader('Access-Control-Allow-Methods', "POST, OPTIONS");
            response.setHeader('Access-Control-Allow-Headers', "Content-Type");
        }
    }


    /* handle a token in Auth header */
    let token = null, request_id = null, correlation_id = null;
    if(request.headers['authorization'] && request.headers['authorization'].startsWith('Bearer '))
        token = request.headers['authorization'].replace(/^Bearer /, '').trim();

    // we will echo request and correlation ids in responses
    if(request.headers['x-request-id']) request_id = request.headers['x-request-id'];
    if(request.headers['x-correlation-id']) request_id = request.headers['x-correlation-id'];


    if(request.method == "OPTIONS")
        return response.sendResponseCode(204);


    //## Get the event and validate before processing further.
    let event = this.getConfig('regex').exec(uri.pathname)[1].split('/');

    if(event.length > 2)
        return response.sendResponseCode(500, "Invalid request.");

    // no such channel
    if(!this.getChannel(event[0]))
        return response.sendResponseCode(500, "Invalid request. (47)");

    // if channel only, use doc handler, if allowed
    if(event.length == 1) {
        if(this.getConfig('docs'))
            return docHandler(response, this.getChannel(event[0]));
        else return response.sendResponseCode(500, "Invalid request. (52)");
    }

    // no such event
    if(this.getChannel(event[0]).listenerCount(event[1]) == 0)
        return response.sendResponseCode(500, "Invalid request. (58)");


    if(request.method != "POST")
        return response.sendResponseCode(500);


    //## Now to get the request body and process
    try {

        // TODO: need to detect multi-part post
        // parse only the text/json part
        // handle posted files separately

        // parse the post body as json
        var body = "";
        request.on('data', (chunk) => body += chunk);
        request.on('end', () => {
            var edata = JSON.parse(body), event = this.getConfig('regex').exec(uri.pathname)[1].split('/');

            // if there is a token, need to stuff it in out-of-band field
            if(token != null) edata[TOKEN] = token;

            // do the same if there is a JWT field
            // Yes, JWT takes precedence in this scenario
            // backward compatibility only
            if(Object.hasOwn(edata, 'jwt')) {
                edata[TOKEN] = edata['jwt'];
                delete edata['jwt'];
            }
            
            // NOTE: Ninja methods execute OUTSIDE of the web context. This is by design.
            // The request and response scopes are not accessible from within a Ninja method.
            //return this.getChannel(event[0]).emit(event[1], edata, rdata => jsonHandler(request, response, rdata));

            // EXPERIMENTAL - Response enxoder support
            // Appropriate modules must be installed for
            // types other than JSON
            let encoder = 'sendJSON';
            switch(uri.searchParams.get('format')) {
                case 'toon':
                    encoder = 'sendTOON';
                    break;
                case 'bson':
                    encoder = 'sendBSON';
                    break;
                default:
                    encoder = 'sendJSON';
                    break;
            }
             
            return this.getChannel(event[0]).emit(event[1], edata, rdata => {
                // echo identifiers
                if(request_id) response.setHeader('X-Request-Id', request_id);
                if(correlation_id) response.setHeader('X-Correlation-Id', correlation_id);

                // send data in requested format
                response[encoder](rdata);
            });
        });
    } catch(e) { return response.sendResponseCode(500, e); }
}

function docHandler(response, channel) {
    response.writeHead(200, {"Content-Type": "text"});

    // iterate available methods and doc attributes
    //#!

    response.end();
}


class NinjaExtension {
    #config;
    #channels = {};

    constructor(webserver, config) {
        if(!config.regex)
            config.regex = new RegExp("^/ninja/(.*)$");
        
        if(typeof config.regex === 'string')
            config.regex = new RegExp(config.regex);
        
        this.#config = config;
        
        // augment webserver
        webserver.registerRoute(config.regex, ninjaHandler.bind(this));
        webserver.registerChannel = (channel) => this.registerChannel(channel);
        webserver.getChannel = (id) => this.getChannel(id);
    }

    getConfig(key) { return this.#config[key]; }
    
    registerChannel(channel) {
        this.#channels[channel.id] = channel;
    }

    getChannel(id) {
        return this.#channels[id];
    }
}

class Channel extends EventEmitter {
    constructor(id, events) {
        this.id = id;
        var k = Object.keys(events);
        for(var i = 0, L = k.length; i < L; i++) {
            if(typeof events[k[i]] == "function")
                this.on(k[i], events[k[i]].bind(this));
            else
                this.on(k[i], this[events[k[i]]]);
        }
    }
}


module.exports = {
    WebExtension: NinjaExtension, // required
    Channel
};
