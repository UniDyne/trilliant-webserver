/*
    Mostly utility functions for reading and writing header strings
    in the correct format.

    Such strings are semicolon delimited sets of key-value pairs
    which are themselves delimited by the equals character. The
    values are URLEncoded.

    Some headers have a "value", which is a value without a key that
    is the first element in the semicolon list.
*/


function decodeHeader(str) {
    const obj = {};

    let e = str.split(';');
    e.forEach((kv,i) => {
        // split on FIRST '=' char
        let [k,v] = kv.split(/=(.+)/);
        if(i==0 && v == undefined)
            return obj.value = k.trim();
        else obj[k.trim()] = decodeURIComponent(v.trim());
    });

    return obj;
}

function encodeHeader(obj, fmt) {
    let list = [];

    if(!fmt) {
        let k = 'value';
        fmt = Object.keys(obj);
        if(obj[k]) {
            fmt.splice(fmt.indexOf(k),1);
            fmt.unshift(k);
        }
    }

    fmt.forEach((k, i) => {
        if(i == 0 && k == 'value')
            return list.push(obj[k]);
        if(obj[k] == undefined) return;
        if(obj[k] == null)
            return list.push(k);
        
        list.push(`${k}=${encodeURIComponent(obj[k])}`);
    });

    return list.join(';');
}

module.exports = {
    encodeHeader,
    decodeHeader
};
