const url = require('url'),
    path = require('path');

function requestHandler(request, response) {
    /*
    var uri = url.parse(request.url, true);
    var pathname = decodeURI(uri.pathname);
    var query = uri.query;
    */
    var uri = request.uri;
    
    response.setRequest(request);
    request.setResponse(response);
    
    this.emit('requestStart', request, response, uri.pathname);
    
    response.on('finish', () => this.emit('requestEnd', request, response));

    // check for route handler
    let handler = this.getRouteHandler(uri.pathname);
    if(handler != null) return handler(request, response, uri, this);
    
    // only implementing GET and POST
    //#! add HEAD
    if(request.method != "GET" && request.method != "POST")
        return response.sendResponseCode(405);
    
    // normalize to prevent directory traversal
    let pathname = path.normalize(uri.pathname);
    //console.log(`[Path]: ${pathname}`);
    
    
    // check for virtual path
    let dirname = pathname.split(path.sep)[1];
    let vp = this.getVirtualPath(dirname);
    if(vp != null) filename = path.join(vp, pathname.replace(path.sep + dirname,''));
    else filename = path.join(this.root, pathname);

    return staticHandler(request, response, filename);
}

/* @deprecated */
function staticHandler(request, response, filename) { response.sendFile(filename); }

/* @deprecated */
function jsonHandler(request, response, data) { response.sendJSON(data); }


module.exports = {
    requestHandler,
    staticHandler,
    jsonHandler
};
