#!/usr/bin/env node

const exec = require("node:child_process").execSync;
const fs = require("node:fs");

if (!fs.existsSync(".no-postinstall")) {
	// download proper witnet_toolkit binary, according to arch and os
	exec(`node ./src/bin/index.js --update --version`);
}
