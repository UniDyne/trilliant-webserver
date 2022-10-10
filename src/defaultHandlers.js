const url = require('url'),
    path = require('path');

function requestHandler(request, response) {
    var uri = url.parse(request.url, true);
    var pathname = decodeURI(uri.pathname);
    var query = uri.query;
    
    response.getMimeType = getMimeType;
    response.setRequest(request);
    request.setResponse(response);
    
    this.emit('requestStart', request, response, pathname);
    
    response.on('finish', () => this.emit('requestEnd', request, response));

    // only implementing GET and POST
    //#! add HEAD
    if(request.method != "GET" && request.method != "POST")
        return response.sendResponseCode(405);
    
    // check for route handler
    for(var i = 0; i < this.routes.length; i++) {
        if(this.routes[i].rx.test(pathname))
            return this.routes[i].handler(request, response, {pathname: pathname, query: query}, this);
    }

    // normalize to prevent directory traversal
    pathname = path.normalize(pathname);
    //console.log(`[Path]: ${pathname}`);
    // check for virtual path
    var vp = pathname.split(path.sep)[1];
    if(this.virtualPaths[vp])
        filename = path.join( this.virtualPaths[vp], pathname.replace(path.sep+vp,'') );
    else filename = path.join( this.webroot, pathname );

    return staticHandler(request, response, filename);
}

/* @deprecated */
function staticHandler(request, response, filename) { response.sendFile(filename); }

/* @deprecated */
function jsonHandler(request, response, data) { response.sendJSON(data); }


module.exports = {
    requestHandler: requestHandler,
    staticHandler: staticHandler,
    jsonHandler: jsonHandler
};
