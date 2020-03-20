const fs = require('fs');
const path = require('path');
const pkg = require('./package.json');
const ext = require('./Emmet.novaextension/extension.json');

ext.version = pkg.version;

fs.writeFileSync('./Emmet.novaextension/extension.json', JSON.stringify(ext, null, 2));
console.log('Updated extension version to', pkg.version);
