const fs = require('fs'),
    path = require('path'),
    os = require('os'),
    crypto = require('crypto');

const { Writable } = require('stream');

const { decodeHeader } = require('./headerUtils');


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

    let out = fs.createWriteStream(filename);
    out.on('finish', () => callback(filename));
    request.pipe(out);
}



const MULTIPART_DEFAULTS = {
    maxFileSize: 64 * 1024 * 1024, // 64 MB per file
    maxFieldSize: 1024 * 1024, // 1 MB per non-file field
    maxFiles: 16,
    maxFields: 128,
    maxHeaderSize: 16 * 1024, // 16 KB headers per part
    tmpDir: os.tmpdir()
};

// parse states
const S_PREAMBLE = 0, S_HEADERS = 1, S_BODY = 2, S_AFTER = 3, S_DONE = 4;

// Parse `value; k="v"; k2=v2`
// multi-part headers are not URL-encoded
// may include quoted values and contain ; or %
function parseParams(str) {
    const out = {};
    if(!str) return out;
    
    const re = /(?:^|;)\s*([^=;]+?)\s*(?:=\s*(?:"((?:[^"\\]|\\.)*)"|([^;]*)))?\s*(?=;|$)/g;
    let m, first = true;
    while((m = re.exec(str)) !== null) {
        if(m[0] === '') { re.lastIndex++; continue; }
        if(first && m[2] == undefined && m[3] == undefined) out.value = m[1].toLowerCase();
        else out[m[1].toLowerCase()] = m[2] !=== undefined ? m[2].replace(/\\(.)/g, '$1') : (m[3] || '').trim();
        first = false;
    }
    return out;
}

class MultipartParser extends Writable {
    constructor(boundary, options) {
        super();
        this.opt = Object.assign({}, MULTIPART_DEFAULTS, options);
        this.dash = Buffer.from('--' + boundary);          // first boundary
        this.delim = Buffer.from('\r\n--' + boundary);     // later boundaries
        this.buf = Buffer.alloc(0);
        this.state = S_PREAMBLE;
        this.part = null;
        this.result = { files: [], data: {} };
        this.nFields = 0;
    }

    _write(chunk, enc, cb) {
        try {
            this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
            this.#run(cb);
        } catch(e) { this.#abort(e, cb); }
    }

    _final(cb) {
        if(this.state !== S_DONE)
            return this.#abort(new Error('Malformed multipart body: unexpected end of data.'), cb);
        cb();
    }

    _destroy(err, cb) {
        if(err) this.#cleanup();
        cb(err);
    }

    #abort(err, cb) { this.#cleanup(); cb(err); }

    #cleanup() {
        if(this.part && this.part.out) this.part.out.destroy();
        this.part = null;
        this.result.files.forEach(f => fs.unlink(f.path, () => {}));
    }

    // consume as much of this.buf as possible, then call cb (async if a file write is pending)
    #run(cb) {
        while(true) {
            if(this.state === S_PREAMBLE) {
                // the very first boundary has no leading CRLF
                let i = this.buf.indexOf(this.dash);
                if(i < 0) {
                    this.buf = this.buf.subarray(Math.max(0, this.buf.length - this.dash.length));
                    return cb();
                }
                this.buf = this.buf.subarray(i + this.dash.length);
                this.state = S_AFTER;
            }
            else if(this.state === S_AFTER) {
                if(this.buf.length < 2) return cb();
                if(this.buf[0] === 0x2d && this.buf[1] === 0x2d) { // '--' closes the body
                    this.state = S_DONE;
                    this.buf = Buffer.alloc(0);
                    return cb();
                }
                // transport padding is not supported; expect CRLF
                if(this.buf[0] !== 0x0d || this.buf[1] !== 0x0a)
                    throw new Error('Malformed multipart body: bad boundary.');
                this.buf = this.buf.subarray(2);
                this.state = S_HEADERS;
            }
            else if(this.state === S_HEADERS) {
                let i = this.buf.indexOf('\r\n\r\n');
                if(i < 0) {
                    if(this.buf.length > this.opt.maxHeaderSize)
                        throw new Error('Multipart part headers too large.');
                    return cb();
                }
                if(i > this.opt.maxHeaderSize) throw new Error('Multipart part headers too large.');
                this.#startPart(this.buf.subarray(0, i).toString('utf8'));
                this.buf = this.buf.subarray(i + 4);
                this.state = S_BODY;
            }
            else if(this.state === S_BODY) {
                let i = this.buf.indexOf(this.delim);
                if(i >= 0) {
                    let data = this.buf.subarray(0, i);
                    this.buf = this.buf.subarray(i + this.delim.length);
                    return this.#partData(data, () => {
                        this.#endPart(err => {
                            if(err) return this.#abort(err, cb);
                            this.state = S_AFTER;
                            try { this.#run(cb); } catch(e) { this.#abort(e, cb); }
                        });
                    }, cb);
                }
                // no delimiter yet: everything except a possible partial delimiter is data
                let keep = this.delim.length - 1;
                if(this.buf.length <= keep) return cb();
                let data = this.buf.subarray(0, this.buf.length - keep);
                this.buf = this.buf.subarray(this.buf.length - keep);
                return this.#partData(data, () => {
                    try { this.#run(cb); } catch(e) { this.#abort(e, cb); }
                }, cb);
            }
            else { // S_DONE: ignore the epilogue
                this.buf = Buffer.alloc(0);
                return cb();
            }
        }
    }

    #startPart(headerText) {
        const headers = {};
        headerText.split('\r\n').forEach(line => {
            let k = line.indexOf(':');
            if(k > 0) headers[line.slice(0, k).trim().toLowerCase()] = line.slice(k + 1).trim();
        });

        // content-disposition is "form-data; name="x"; filename="y""
        const disp = parseParams(headers['content-disposition']);
        if(!disp || disp.value !== 'form-data' || disp.name === undefined)
            throw new Error('Malformed multipart body: bad Content-Disposition.');

        const part = { field: disp.name, size: 0 };
        if(disp.filename !== undefined) {
            if(this.result.files.length >= this.opt.maxFiles)
                throw new Error('Too many files in multipart body.');
            // never trust a client path; keep only the last segment
            part.filename = path.basename(disp.filename.replace(/\\/g, '/'));
            part.mimeType = headers['content-type'] || 'application/octet-stream';
            part.path = path.join(this.opt.tmpDir, 'tmp.' + crypto.randomBytes(16).toString('hex'));
            part.out = fs.createWriteStream(part.path);
            part.out.on('error', e => this.destroy(e));
            this.result.files.push(part); // tracked immediately so cleanup can remove it
        } else {
            if(++this.nFields > this.opt.maxFields)
                throw new Error('Too many fields in multipart body.');
            part.chunks = [];
        }
        this.part = part;
    }

    #partData(data, next, cb) {
        const part = this.part;
        part.size += data.length;
        if(part.out) {
            if(part.size > this.opt.maxFileSize) throw new Error('Uploaded file too large.');
            if(data.length === 0) return next();
            // copy: data is a view into a buffer we may not own
            return part.out.write(Buffer.from(data), err => err ? this.#abort(err, cb) : next());
        }
        if(part.size > this.opt.maxFieldSize) throw new Error('Form field too large.');
        part.chunks.push(Buffer.from(data));
        next();
    }

    #endPart(done) {
        const part = this.part;
        this.part = null;
        if(!part.out) {
            const v = Buffer.concat(part.chunks).toString('utf8');
            const d = this.result.data;
            // repeated field names become arrays
            if(!Object.hasOwn(d, part.field)) d[part.field] = v;
            else if(Array.isArray(d[part.field])) d[part.field].push(v);
            else d[part.field] = [d[part.field], v];
            return done();
        }
        part.out.end(done);
        delete part.out;
    }
}


/**
 * Parse a multipart body from a readable stream.
 * callback(parsed) on success, or callback(null, error) on failure
 * (all temp files are removed on failure).
 */
function parseMultipart(source, boundary, options, callback) {
    if(typeof options === 'function') { callback = options; options = {}; }

    const parser = new MultipartParser(boundary, options);
    let finished = false;
    const done = (res, err) => { if(!finished) { finished = true; callback(res, err); } };

    parser.on('error', err => { source.unpipe(parser); done(null, err); });
    parser.on('finish', () => done(parser.result));
    source.on('error', err => parser.destroy(err));
    source.on('aborted', () => parser.destroy(new Error('Request aborted.')));
    source.pipe(parser);
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

function handleMultipartRequest(request, callback, options) {
    const type = parseParams(request.headers['content-type']);
    if(!type || type.value !== 'multipart/form-data' || !type.boundary)
        return callback(null, new Error('Expected multipart/form-data with a boundary.'));

    parseMultipart(request, type.boundary, options, callback);
}


module.exports = {
    bodyStreamBuffer,
    bodyStreamFile,

    handleJsonRequest,
    handleFileRequest,
    handleMultipartRequest,
    parseMultipart
};
