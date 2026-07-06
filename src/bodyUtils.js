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





function parseMultipart(fileInfo, callback) {
    const parsedData = {
        files: [],
        data: null
    };

    let inTmp = fs.openSync(fileInfo.filename, 'r');

    let bound = Buffer.from('--'+fileData.mimeType['boundary']+'\r\n');

    // we loop through the file, looking for boundary,
    // then we look for the lines that follow as headers
    // followed by '\r\n\r\n'
    // data after that is file data up to \r\n and --boundary

    const kmp = computeKMPTable(bound);

    const windowSize = 2048;
    const buffer = Buffer.alloc(windowSize * 2);
    let bytesRead, offset =0;
    while(true) {
        bytesRead = fs.readSync(inTmp, buffer, 0, windowSize * 2, offset);
        if(bytesRead === 0) break;

        const fullBuffer = Buffer.concat([lastOverlap, buffer.subarray(0, bytesRead)]);

        processBuffer(fullBuffer);



        offset += bytesRead - (bytesRead > 0 ? windowSize : 0);
    }


    //...
    // split and decode file
    // save file parts
    // return list of files to callback
    // detect JSON blob or form data and callback as data
    //...
    fs.closeSync(inTmp);
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
        parseMultipart({
            filename: filename,
            mimeType: decodeHeader(request.headers['content-type'])
        }, callback);
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