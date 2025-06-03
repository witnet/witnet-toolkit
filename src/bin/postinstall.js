#!/usr/bin/env node

const exec = require("child_process").execSync
const fs = require("fs")

if (!fs.existsSync(".no-postinstall")) {
    // download proper witnet_toolkit binary, according to arch and os
    exec(`node ./src/bin/toolkit.js --update --version`)
}
