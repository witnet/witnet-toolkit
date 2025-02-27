const cbor = require("cbor")
const { exec } = require("child_process");
const net = require("net")
const os = require("os")
const readline = require('readline')

const colorstrip = (str) => str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, ''
);

const commas = (number) => {
    parts = number.toString().split('.')
    const result = parts.length <= 1
        ? `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${parts[1]}`
    return result
};

const fromNanowits = (x, d) => (parseInt(x) / 10 ** 9).toFixed(d || 2)
const fromWits = (x) => Math.floor(parseFloat(x) * 10 ** 9)

function toFixedTrunc(x, n) {
    const v = (typeof x === 'string' ? x : x.toString()).split('.');
    if (n <= 0) return v[0];
    let f = v[1] || '';
    if (f.length > n) return `${v[0]}.${f.substr(0, n)}`;
    while (f.length < n) f += '0';
    return `${v[0]}.${f}`
};

const whole_wits = (number, digits) => {
    const lookup = [
        { value: 1, symbol: " nWits" },
        { value: 1e3, symbol: " μWits" },
        { value: 1e6, symbol: " mWits" },
        { value: 1e9, symbol: "  Wits" },
        { value: 1e12, symbol: " KWits" },
        { value: 1e15, symbol: " MWits" },
    ];
    const regexp = /\.0+$|(?<=\.[0-9])0+$/;
    const item = lookup.findLast(item => number >= item.value);
    return item ? toFixedTrunc(commas(number / item.value), digits)./*replace(regexp, "")*/concat(item.symbol) : "(no Wits)";
};

const bblue = (str) => `\x1b[1;98;44m${str}\x1b[0;0;0m`
const bcyan = (str) => `\x1b[38;46m${str}\x1b[0;0m`
const bgreen = (str) => `\x1b[30;42m${str}\x1b[0;0m`
const bred = (str) => `\x1b[30;41m${str}\x1b[0;0m`
const bviolet = (str) => `\x1b[30;45m${str}\x1b[0;0m`

const lcyan = (str) => `\x1b[1;96m${str}\x1b[0m`
const lgray = (str) => `\x1b[1;90m${str}\x1b[0m`
const lgreen = (str) => `\x1b[1;92m${str}\x1b[0m`
const lmagenta = (str) => `\x1b[1;95m${str}\x1b[0m`
const lyellow = (str) => `\x1b[1;93m${str}\x1b[0m`
const mblue = (str) => `\x1b[94m${str}\x1b[0m`
const mcyan = (str) => `\x1b[96m${str}\x1b[0m`
const mgreen = (str) => `\x1b[92m${str}\x1b[0m`
const mmagenta = (str) => `\x1b[0;95m${str}\x1b[0m`
const mred = (str) => `\x1b[91m${str}\x1b[0m`
const myellow = (str) => `\x1b[93m${str}\x1b[0m`

const blue = (str) => `\x1b[34m${str}\x1b[0m`
const cyan = (str) => `\x1b[36m${str}\x1b[0m`
const gray = (str) => `\x1b[90m${str}\x1b[0m`
const green = (str) => `\x1b[32m${str}\x1b[0m`
const magenta = (str) => `\x1b[0;35m${str}\x1b[0m`
const normal = (str) => `\x1b[98m${str}\x1b[0m`
const red = (str) => `\x1b[31m${str}\x1b[0m`
const white = (str) => `\x1b[1;98m${str}\x1b[0m`
const yellow = (str) => `\x1b[33m${str}\x1b[0m`

function countLeaves(t, obj) {
    if (!obj) return 0;
    if (obj instanceof t) return 1;
    if (Array.isArray(obj)) return obj.reduce((sum, item) => sum + countLeaves(t, item), 0)
    else return Object.values(obj).reduce((sum, item) => sum + countLeaves(t, item), 0);
}

function deleteExtraFlags(args) {
    return args.filter(arg => !arg.startsWith('--'))
}

function cmd(...command) {
    return new Promise((resolve, reject) => {
        exec(command.join(" "), { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(error)
            }
            if (stderr) {
                reject(stderr)
            }
            resolve(stdout)
        })
    })
};

async function execRadonBytecode(bytecode, ...flags) {
    if (!isHexString(bytecode)) {
        throw EvalError("invalid hex string")
    } else {
        const npx = os.type() === "Windows_NT" ? "npx.cmd" : "npx"
        return cmd(npx, "witnet", "radon", "dryrun", bytecode, ...flags)
            .catch((err) => {
                let errorMessage = err.message.split('\n').slice(1).join('\n').trim()
                const errorRegex = /.*^error: (?<message>.*)$.*/gm
                const matched = errorRegex.exec(err.message)
                if (matched) {
                    errorMessage = matched.groups.message
                }
                console.error(errorMessage || err)
            })
    }
}

function extractFromArgs(args, flags) {
    const curated = {}
    if (args && flags) {
        Object.keys(flags).forEach(flag => {
            const flagIndex = args.indexOf(`--${flag}`)
            if (flagIndex >= 0) {
                if (flags[flag].param) {
                    curated[flag] = args[flagIndex]
                    if (!args[flagIndex + 1] || args[flagIndex + 1].startsWith('--')) {
                        throw `Missing required parameter for --${flag}`
                    } else {
                        curated[flag] = args[flagIndex + 1]
                        args.splice(flagIndex, 2)
                    }
                } else {
                    curated[flag] = true
                    args.splice(flagIndex, 1)
                }
            }
        })
    }
    return [args, curated,]
}

function fromHexString(hexString) {
    if (hexString.startsWith("0x")) hexString = hexString.slice(2)
    return Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

function ipIsPrivateOrLocalhost(ip) {
    if (ip.substring(0, 7) === "::ffff:")
        ip = ip.substring(7);

    if (net.isIPv4(ip)) {
        // check localhost
        if (ip === '127.0.0.1')
            return true;

        //         10.0.0.0 - 10.255.255.255        ||   172.16.0.0 - 172.31.255.255                          ||    192.168.0.0 - 192.168.255.255
        return /^(10)\.(.*)\.(.*)\.(.*)$/.test(ip) || /^(172)\.(1[6-9]|2[0-9]|3[0-1])\.(.*)\.(.*)$/.test(ip) || /^(192)\.(168)\.(.*)\.(.*)$/.test(ip)
    }

    // else: ip is IPv6
    const firstWord = ip.split(":").find(el => !!el); //get first not empty word

    // equivalent of 127.0.0.1 in IPv6
    if (ip === "::1")
        return true;

    // The original IPv6 Site Local addresses (fec0::/10) are deprecated. Range: fec0 - feff
    else if (/^fe[c-f][0-f]$/.test(firstWord))
        return true;

    // These days Unique Local Addresses (ULA) are used in place of Site Local.
    // Range: fc00 - fcff
    else if (/^fc[0-f]{2}$/.test(firstWord))
        return true;

    // Range: fd00 - fcff
    else if (/^fd[0-f]{2}$/.test(firstWord))
        return true;

    // Link local addresses (prefixed with fe80) are not routable
    else if (firstWord === "fe80")
        return true;

    // Discard Prefix
    else if (firstWord === "100")
        return true;

    // Any other IP address is not Unique Local Address (ULA)
    return false;
}

function isHexStringOfLength(str, length) {
    return (isHexString(str)
        && (
            (str.startsWith('0x') && str.slice(2).length === length * 2)
            || str.length === length * 2
        )
    ) || isWildcard(str);
}

function isHexString(str) {
    return (
        typeof str === 'string'
        && (
            (str.startsWith("0x") && /^[a-fA-F0-9]+$/i.test(str.slice(2)))
            || /^[a-fA-F0-9]+$/i.test(str)
        )
    ) || isWildcard(str);
}

function toHexString(buffer, prefix0x = false) {
    if (buffer instanceof Uint8Array) buffer = Buffer.from(buffer)
    return (prefix0x ? "0x" : "") + Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2))
        .join('')
        .match(/[a-fA-F0-9]{2}/g)
        .join('')
}

function parseURL(url) {
    try {
        const parsedUrl = new URL(url)
        return [
            parsedUrl.protocol + "//",
            parsedUrl.host,
            parsedUrl.pathname.slice(1),
            parsedUrl.search.slice(1)
        ]
    } catch {
        throw new TypeError(`Invalid URL was provided: ${url}`)
    }
}

function showUsage(cmd, module) {
    showUsageHeadline(cmd)
    if (module?.flags) showUsageFlags(module.flags)
    if (module?.router) showUsageRouter(module.router)
    if (module?.envars) showUsageEnvars(module.envars)
}

function showUsageRouter(router) {
    const cmds = Object.entries(router)
    if (cmds.length > 0) {
        console.info(`\nSUBCOMMANDS:`)
        const maxLength = Math.max(...cmds.map(([cmd]) => cmd.length))
        cmds.forEach(cmd => {
            console.info("  ", `${cmd[0]}${" ".repeat(maxLength - cmd[0].length)}`, "  ", cmd[1].hint)
        })
    }
}

function showUsageError(cmd, subcmd, module, flags = {}, error) {
    showUsageSubcommand(cmd, subcmd, module, error)
    if (error) {
        console.info(`\nERROR:`)
        if (flags?.debug) {
            console.error(error)
        } else {
            console.error(error?.stack?.split('\n')[0] || error)
        }
    }
}

function showUsageEnvars(envars) {
    envars = Object.entries(envars)
    if (envars.length > 0) {
        console.info(`\nENVARS:`)
        const maxWidth = Math.max(...envars.map(([envar]) => envar.length))
        envars.forEach(([envar, hint]) => {
            if (envar.toUpperCase().indexOf("KEY") < 0 && process.env[envar]) {
                console.info("  ", `${yellow(envar.toUpperCase())}${" ".repeat(maxWidth - envar.length)}`, ` => Settled to "${myellow(process.env[envar])}"`)
            } else {
                console.info("  ", `${yellow(envar.toUpperCase())}${" ".repeat(maxWidth - envar.length)}`, ` ${hint}`)
            }
        })
    }
}

function showUsageFlags(flags) {
    flags = Object.entries(flags)
    if (flags.length > 0) {
        console.info(`\nFLAGS:`)
        const maxLength = Math.max(...flags.filter(([,{hint}]) => hint).map(([key, { param }]) => param ? key.length + param.length + 3 : key.length))
        flags.forEach(flag => {
            const str = `${flag[0]}${flag[1].param ? gray(` <${flag[1].param}>`) : ""}`
            if (flag[1].hint) {
                console.info("  ", `--${str}${" ".repeat(maxLength - colorstrip(str).length)}`, "  ", flag[1].hint)
            }
        })
    }
}

function showUsageHeadline(cmd, subcmd, module) {
    console.info("USAGE:")
    if (subcmd) {
        let params = module.router[subcmd]?.params
        const options = module.router[subcmd]?.options
        if (params) {
            const optionalize = (str) => str.endsWith(' ...]') ? `[<${str.slice(1, -5)}> ...]` : (
                str[0] === '[' ? `[<${str.slice(1, -1)}>]` : `<${str}>`
            )
            if (Array.isArray(params)) {
                params = params.map(param => optionalize(param)).join(' ') + " "
            } else {
                params = optionalize(params)
            }
        }
        console.info(`   ${white(`npx witnet ${cmd}`)} [FLAGS] ${white(subcmd)} ${params ? green(params) + " " : ""}${options && Object.keys(options).length > 0 ? "[OPTIONS]" : ""}`)
        if (module?.router[subcmd]?.hint) {
            console.info(`\nDESCRIPTION:`)
            console.info(`   ${module.router[subcmd].hint}`)
        }
    } else {
        console.info(`   ${white(`npx witnet ${cmd}`)} [FLAGS] <SUBCOMMAND> ... [OPTIONS]`)
    }
}

function showUsageOptions(options) {
    options = Object.entries(options)
    if (options.length > 0) {
        console.info(`\nOPTIONS:`)
        const maxLength = options
            .map(option => option[1].param ? option[1].param.length + option[0].length + 3 : option[0].length)
            .reduce((prev, curr) => curr > prev ? curr : prev);
        options.forEach(option => {
            if (option[1].hint) {
                const str = `${option[0]}${option[1].param ? gray(` <${option[1].param}>`) : ""}`
                console.info("  ", `--${str}${" ".repeat(maxLength - colorstrip(str).length)}`, "  ", option[1].hint)
            }
        })
    }
}

function showUsageSubcommand(cmd, subcmd, module) {
    showUsageHeadline(cmd, subcmd, module)
    if (module?.flags) showUsageFlags(module?.flags)
    if (module?.router[subcmd]?.options) showUsageOptions(module.router[subcmd]?.options)
    if (module?.envars) showUsageEnvars(module?.envars)
}

function showVersion() {
    console.info(`${mcyan(`Wit/Oracle Toolkit CLI v${require("../../package.json").version}`)}`)
}

function getWildcardsCountFromString(str) {
    let maxArgsIndex = 0
    if (str) {
        let match
        const regexp = /\\\d\\/g
        while ((match = regexp.exec(str)) !== null) {
            let argsIndex = parseInt(match[0][1]) + 1
            if (argsIndex > maxArgsIndex) maxArgsIndex = argsIndex
        }
    }
    return maxArgsIndex
}


function isWildcard(str) {
    return str.length == 3 && /\\\d\\/g.test(str)
}

function replaceWildcards(obj, args) {
    if (args.length > 10) args = args.slice(0, 10);
    if (obj && typeof obj === "string") {
        for (let argIndex = 0; argIndex < args.length; argIndex++) {
            const wildcard = `\\${argIndex}\\`
            obj = obj.replaceAll(wildcard, args[argIndex])
        }
    } else if (obj && Array.isArray(obj)) {
        obj = obj.map(value => typeof value === "string" || Array.isArray(value)
            ? replaceWildcards(value, args)
            : value
        )
    }
    return obj;
}

function spliceWildcard(obj, argIndex, argValue, argsCount) {
    if (obj && typeof obj === "string") {
        const wildcard = `\\${argIndex}\\`
        obj = obj.replaceAll(wildcard, argValue)
        for (let j = argIndex + 1; j < argsCount; j++) {
            obj = obj.replaceAll(`\\${j}\\`, `\\${j - 1}\\`)
        }
    } else if (obj && Array.isArray(obj)) {
        obj = obj.map(value => typeof value === "string" || Array.isArray(value)
            ? spliceWildcard(value, argIndex, argValue, argsCount)
            : value
        )
    }
    return obj;
}

async function toolkitRun(settings, args) {
    const cmd = `${settings.paths.toolkitBinPath} ${args.join(' ')}`
    return new Promise((resolve, reject) => {
        exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (error) {
                reject(error)
            }
            if (stderr) {
                reject(stderr)
            }
            resolve(stdout)
        })
    })
}

function toUpperCamelCase(str) {
    return str.replace(/\b(\w)/g, function (match, capture) {
        return capture.toUpperCase();
    }).replace(/\s+/g, '');
}

function toUtf8Array(str) {
    const utf8 = [];
    for (let i = 0; i < str.length; i++) {
        const charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6),
                0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff) << 10)
                | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >> 18),
                0x80 | ((charcode >> 12) & 0x3f),
                0x80 | ((charcode >> 6) & 0x3f),
                0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
}

function utf8ArrayToStr(array) {
    let out, i, len, c;
    let char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
}

async function prompt(question) {
    const readlineInterface = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    return new Promise((resolve, _) => {
        readlineInterface.question(`${question} `, (response) => {
            readlineInterface.close()
            resolve(response.trim())
        })
    })
}

async function prompter(promise) {
    const loading = (() => {
        const h = ['|', '/', '-', '\\'];
        var i = 0;
        return setInterval(() => {
            i = (i > 3) ? 0 : i
            process.stdout.write(`\b\b${h[i]} `)
            i++;
        }, 50);
    })();
    return promise
        .then(result => {
            clearInterval(loading)
            process.stdout.write('\b\b')
            return result
        })
}

function traceChecklists(checklists) {
    if (checklists && Object.keys(checklists).length > 0) {
        const headlines = ["NODES", ...Object.keys(checklists).map(key => `:${key}`),]
        checklists = Object.values(checklists)
        const urls = Object.keys(checklists[0])
        const records = urls.map(url => {
            const errors = checklists.filter(checklist => checklist[url] instanceof Error).length
            return [
                errors === checklists.length ? red(url) : (errors > 0 ? myellow(url) : mcyan(url)),
                ...checklists.map(checklist => checklist[url] instanceof Error
                    ? red(checklist[url])
                    : (checklist[url] === true ? lcyan("Aye") : cyan("Nay"))
                )
            ]
        });
        traceTable(records, {
            headlines,
            maxColumnWidth: 31,
        })
    }
}

function traceHeader(headline, color = normal, indent = "",) {
    console.info(`${indent}┌─${"─".repeat(headline.length)}─┐`)
    console.info(`${indent}│ ${color(headline)} │`)
    console.info(`${indent}└─${"─".repeat(headline.length)}─┘`)
}

function traceTable(records, options) {
    const stringify = (data, humanizers, index) => humanizers && humanizers[index] ? humanizers[index](data).toString() : data?.toString() ?? ""
    const max = (a, b) => a > b ? a : b
    const reduceMax = (numbers) => numbers.reduce((curr, prev) => prev > curr ? prev : curr, 0)
    if (!options) options = {}
    const indent = options?.indent || ""
    const numColumns = reduceMax(records.map(record => record?.length || 1))
    const maxColumnWidth = options?.maxColumnWidth || 80
    const table = transpose(records, numColumns)
    options.widths = options?.widths || table.map((column, index) => {
        let maxWidth = reduceMax(column.map(field => colorstrip(stringify(field, options?.humanizers, index)).length))
        if (options?.headlines && options.headlines[index]) {
            maxWidth = max(maxWidth, colorstrip(options.headlines[index].replaceAll(':', '')).length)
        }
        return Math.min(maxWidth, maxColumnWidth)
    })
    let headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
    console.info(`${indent}┌─${headline.join("─┬─")}─┐`)
    if (options?.headlines) {
        headline = options.widths.map((maxWidth, index) => {
            const caption = options.headlines[index].replaceAll(':', '')
            const captionLength = colorstrip(caption).length
            return `${white(caption)}${" ".repeat(maxWidth - captionLength)}`
        })
        console.info(`${indent}│ ${headline.join(" │ ")} │`)
        headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
        console.info(`${indent}├─${headline.join("─┼─")}─┤`)
    }
    for (let i = 0; i < records.length; i++) {
        let line = ""
        for (let j = 0; j < numColumns; j++) {
            let data = table[j][i]
            let color
            if (options?.colors && options.colors[j]) {
                color = options.colors[j]
            } else {
                color = typeof data === 'string'
                    ? green
                    : (Number(data) === data && data % 1 !== 0 // is float number?
                        ? yellow
                        : (x) => x
                    )
            }
            data = stringify(data, options?.humanizers, j)
            if (colorstrip(data).length > maxColumnWidth) {
                while (colorstrip(data).length > maxColumnWidth - 3) {
                    data = data.slice(0, -1)
                }
                data += "..."
            }
            let dataLength = colorstrip(data).length
            if (options?.headlines && options.headlines[j][0] === ':') {
                data = `${color(data)}${" ".repeat(options.widths[j] - dataLength)}`
            } else {
                data = `${" ".repeat(options.widths[j] - dataLength)}${color(data)}`
            }
            line += `│ ${data} `
        }
        console.info(`${indent}${line}│`)
    }
    headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
    console.info(`${indent}└─${headline.join("─┴─")}─┘`)
}

function transpose(records, numColumns) {
    const columns = []
    for (let index = 0; index < numColumns; index++) {
        columns.push(records.map(row => row[index]))
    }
    return columns
}

function txJsonReplacer(key, value) {
    switch (key) {
        case 'bytes':
        case 'der':
            return toHexString(value, true)
        case 'tx':
            return JSON.stringify(value, txJsonReplacer)
        default:
            return value
    }
}

function traceTransactionOnCheckpoint(receipt) {
    if (receipt?.confirmations) {
        console.info(` > Checkpoint:  ${commas(receipt.blockEpoch + receipt.confirmations)}`)
    }
}

function traceTransactionOnStatusChange(receipt) {
    if (
        receipt.status === "mined" && receipt?.blockHash
            || (receipt.status === "confirmed" && !receipt?.confirmations)
    ) {
        console.info(` > Block hash:  ${gray(receipt?.blockHash)}`) 
        console.info(` > Block miner: ${mcyan(receipt?.blockMiner)}`) 
        console.info(` > Block epoch: ${white(commas(receipt?.blockEpoch))}`)
    }
    const captions = {
        "pending": "Awaiting relay...",
        "confirmed": receipt?.confirmations ? "Transaction confirmed." : "Transaction mined.",
        "finalized": "Transaction finalized.",
        "relayed": "Awaiting inclusion...",
        "mined": "Awaiting confirmations...",
    }
    const caption = captions[receipt.status]
    if (caption) console.info(` > ${captions[receipt.status]}`)
}

function traceTransactionReceipt(receipt) {
    const captions = {
        "DataRequests": ` > DR TX hash:  `,
        "ValueTransfer": ` > VTT hash:    `,
    }
    console.info(`${captions[receipt.type] || ` > TX hash:     `}${white(receipt.hash)}`)
    if (receipt?.droHash) console.info(` > DRO hash:    ${green(receipt.droHash)}`)
    if (receipt?.radHash) console.info(` > RAD hash:    ${mgreen(receipt.radHash)}`)
    if (receipt?.droSLA)  console.info(` > SLA params:  ${JSON.stringify(receipt.droSLA)}`)
    if (receipt?.withdrawer) {
        if (receipt?.validator) {
            console.info(` > Validator:   ${mcyan(receipt.validator)}`)
        }
        console.info(` > Withdrawer:  ${mmagenta(receipt.withdrawer)}`)
    } else {
        console.info(` > Account/s:   ${mmagenta(receipt.from)}`)
    }
    if (receipt?.recipients) {
        console.info(` > Recipient/s: ${
            mmagenta(receipt.recipients.map(([pkh,]) => pkh).filter((pkh, index, array) => index === array.indexOf(pkh)))
        }`)
    }
    console.info(` > Fees:        ${yellow(whole_wits(receipt.fees, 2))}`)
    console.info(` > Value:       ${myellow(whole_wits(receipt.value, 2))}`)
    console.info(` > Weight:      ${mgreen(commas(receipt.weight))}`) 
}

async function traceTransaction(transmitter, options) {
    const color = options?.color || ((x) => `\x1b[30;45m${x}\x1b[0m`)
    let receipt = await transmitter.signTransaction(options, options?.strategy)
    if (options?.dryrun || options?.verbose) {
        console.info(
            `\n${gray(JSON.stringify(receipt.tx, txJsonReplacer))}`
        )
    }
    if (options?.headline) {
        console.info(`\n ${color(`  ${options.headline}  `)}\n`)
    }
    traceTransactionReceipt(receipt)
    if (!options?.dryrun) {
        try {
            if (options?.confirmations !== undefined) {
                receipt = await transmitter.waitTransaction({ 
                    confirmations: options?.confirmations,
                    onCheckpoint: traceTransactionOnCheckpoint,
                    onStatusChange: traceTransactionOnStatusChange,
                })
            } else {
                receipt = await transmitter.sendTransaction(options, options?.strategy)
            }
        } catch (err) {
            if (err?.inFlight && err.inFlight) {
                console.info(`\n${gray(JSON.stringify(err.inFligt?.message, txJsonReplacer))}`)
            }
            throw err
        }
        if (options?.verbose) {
            console.info(`\n${yellow(JSON.stringify(receipt, txJsonReplacer))}`)
        }
    } else {
        console.info(`\n${mred(` ^^^ DRY-RUN ^^^ `)}`)
    }
    return receipt
}

module.exports = {
    colors: {
        bblue, bcyan, bgreen, bred, bviolet,
        cyan, gray, green, magenta, red, white, yellow, normal,
        lcyan, lgray, lgreen, lmagenta, lyellow,
        mcyan, mgreen, mmagenta, mred, myellow,
    },
    colorstrip, commas, whole_wits, toFixedTrunc, 
    fromNanowits, fromWits,
    countLeaves,
    execRadonBytecode,
    deleteExtraFlags, extractFromArgs,
    fromHexString, isHexString, isHexStringOfLength, toHexString,
    parseURL, ipIsPrivateOrLocalhost,
    showUsage, showUsageError, showUsageSubcommand, showVersion,
    toolkitRun,
    toUpperCamelCase, toUtf8Array, utf8ArrayToStr,
    prompt, prompter,
    traceChecklists, traceHeader, traceTable, 
    traceTransaction, traceTransactionOnStatusChange, traceTransactionOnCheckpoint, traceTransactionReceipt, 
    isWildcard, getWildcardsCountFromString, replaceWildcards, spliceWildcard,
    txJsonReplacer, 
}
