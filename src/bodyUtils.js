const fs = require('fs'),
    path = require('path'),
    os = require('os'),
    crypto = require('crypto');


function bodyStreamBuffer(request, callback) {
    let body = [], len = 0;
    request.on('data', chunk => { body.push(chunk); len += chunk.length; } );
    request.on('end', () => {
        let buff = Buffer.concat(body);
        callback(buff);
    });
}

function bodyStreamFile(filename, request, callback) {
    if(!filename) filename = path.join(os.tmpdir(), 'tmp.' + crypto.randomBytes(16).toString('hex'));

    request.on('end', () => {
        callback(filename);
    });
    let out = fs.createWriteStream(filename);
    out.pipe(request);
}


function parseMultipart(filename, callback) {
    const parsedData = {
        files: [],
        data: null
    };

    let inTmp = fs.openSync(filename, 'r');
    //...
    // split and decode file
    // save file parts
    // return list of files to callback
    // detect JSON blob or form data and callback as data
    //...
    inTmp.close();
    // queue an unlink - don't need callback
    //fs.unlink(filename);

    callback(parsedData);
}

function handleJsonRequest(request, callback) {
    bodyStreamBuffer(request, buff => {
        callback( JSON.parse(buff.toString()) );
    });
}

function handleFileRequest(request, callback) {
    // collect the data from the query string
    let data = {};
    //....

    bodyStreamFile(null, request, fname => {
        data.filename = fname;
        callback(data);
    });

}

function handleMultipartRequest(request, callback) {
    bodyStreamFile(null, request, filename => {
        parseMultipart(filename, callback);
    });
}


module.exports = {
    bodyStreamBuffer,
    bodyStreamFile,
    
    handleJsonRequest,
    handleFileRequest,
    handleMultipartRequest
};


/** STASHING FOR LATER */
/***
const BODY_PARSERS = new Map([
    ["text/json", jsonParser],
    ["multipart/form-data", multipartParser],
    ["application/x-www-form-urlencoded", formParser],
    ["application/octet-stream", binaryParser]
]);

const MAX_BODY_SIZE = 78643200; // 75MB

export function processBody(request, callback) {
    let mimeType = decodeHeader(request.headers['content-type']);

    if(!BODY_PARSERS.has(mimeType.value))
        throw 'Invalid request data.';

    let body = [], len = 0;
    request.on('data', chunk => { body.push(chunk); len += chunk.length; } );
    request.on('end', () => {
        let buff = Buffer.concat(body);
        (BODY_PARSERS.get(mimeType.value))(buff, request, callback);
    });
}

function jsonParser(buff, request, callback) {
    callback(JSON.parse(buff));
}

function formParser(buff, request, callback) {

}

function multipartParser(buff, request, callback) {

}

function binaryParser(buff, request, callback) {
    
}
***/