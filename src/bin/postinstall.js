#!/usr/bin/env node

const exec = require("child_process").exec
const fs = require("fs")

if (!fs.existsSync(".no-postinstall")) {
    exec(`npx witnet --update --version`)
}
