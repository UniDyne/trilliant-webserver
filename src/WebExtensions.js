/*================================
    WEB EXTENSIONS
================================*/

const path = require('path');

function loadExtensions(extlist) {
    for(var i = 0; i < extlist.length; i++) try {
        if(typeof extlist[i] == "string")
            getExtInstance(this, extlist[i], {});
        else {/* It's an extension / config pair */
            if((extlist[i].enabled !== undefined && extlist[i].enabled === false) || (extlist[i].disabled !== undefined && extlist[i].disabled === true)) continue;
            getExtInstance(this, extlist[i].extension, extlist[i].config);
        }
    } catch(e) {
        console.log(`Error loading extension ${i}.`);
        console.error(e);
    }
}


function getExtInstance(self, extPath, config) {
    // fix for app-relative extension
    if(extPath.substr(0,2) == "./") extPath = path.join(process.cwd(), extPath);

    // if starts with #, use internal extension
    if(extPath.substr(0,1) == "#") extPath = `./extensions/${extPath.substr(1)}`;
    
    
    const {WebExtension} = require(extPath);
    return new WebExtension(self, config);
}


module.exports = {
    loadExtensions: loadExtensions
};
