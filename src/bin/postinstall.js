#!/usr/bin/env node

const exec = require("child_process").exec
const fs = require("fs")

if (!fs.existsSync(".no-postinstall")) {
    // download proper witnet_toolkit binary, according to arch and os
    exec(`npx witnet --update --version`)
}
