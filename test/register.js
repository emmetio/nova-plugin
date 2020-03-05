const conf = require('./tsconfig.json');
require('ts-node').register({
    compilerOptions: conf.compilerOptions
});
