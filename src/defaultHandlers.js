const { cp } = require('fs');
const url = require('url'),
    path = require('path');

const { MIME_TYPES } = require('./constants');

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
    let handler = this.getRouteHandler(pathname);
    if(handler != null) return handler(request, response, {pathname: pathname, query: query}, this);
    
    // normalize to prevent directory traversal
    pathname = path.normalize(pathname);
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

function getMimeType(filename) {
    var ext = path.extname(filename).replace(/^\./,'');
    return MIME_TYPES.hasOwnProperty(ext) ? MIME_TYPES[ext] : "application/octet-stream";
}


module.exports = {
    requestHandler: requestHandler,
    staticHandler: staticHandler,
    jsonHandler: jsonHandler
};
