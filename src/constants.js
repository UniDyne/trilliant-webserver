module.exports.DEFAULT_CONFIG = {
    port: 10000 + Math.floor(Math.random()*10000),
    rootpath: ".",
    cacheAge: 900,
    extensions: [],
    secure: false
};

module.exports.MIME_TYPES = {
    css: "text/css",
    gif: "image/gif",
    htm: "text/html",
    html: "text/html",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    js: "text/javascript",
    json: "application/json",
    pdf: "application/pdf",
    png: "image/png",
    svg: "image/svg+xml",
    txt: "text/plain",
    xml: "text/xml"
};

module.exports.HTTP_MESSAGES = {
    301: "Moved Permanently",
    302: "Found",
    303: "See Other",
    304: "Not Modified",
    307: "Temporary Redirect",
    308: "Permanent Redirect",
    400: "Bad Request",
    401: "Unauthorized",
    403: "Forbidden",
    404: "Not Found",
    405: "Method Not Allowed",
    410: "Gone",
    412: "Precondition Failed",
    416: "Requested Range Not Satisfiable",
    500: "Internal Server Error",
    501: "Not Implemented",
    503: "Service Unavailable"
};
