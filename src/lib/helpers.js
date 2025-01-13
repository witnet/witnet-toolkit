const { exec } = require("child_process");

const commas = (number) => {
    parts = number.toString().split('.')
    var result = parts.length <= 1
        ? `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
        : `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${parts[1]}`
    return result 
}
const lcyan = (str) => `\x1b[96m${str}\x1b[0m`
const lgray = (str) => `\x1b[1;90m${str}\x1b[0m`
const lgreen = (str) => `\x1b[1;92m${str}\x1b[0m`
const lyellow = (str) => `\x1b[1;93m${str}\x1b[0m`
const mcyan = (str) => `\x1b[96m${str}\x1b[0m`
const mgreen = (str) => `\x1b[92m${str}\x1b[0m`
const myellow = (str) => `\x1b[93m${str}\x1b[0m`
const cyan = (str) => `\x1b[36m${str}\x1b[0m`
const gray = (str) => `\x1b[90m${str}\x1b[0m`
const green = (str) => `\x1b[32m${str}\x1b[0m`
const normal = (str) => `\x1b[98m${str}\x1b[0m`
const red = (str) => `\x1b[31m${str}\x1b[0m`
const white = (str) => `\x1b[1;98m${str}\x1b[0m`
const yellow = (str) => `\x1b[33m${str}\x1b[0m`

module.exports = {
    colors: {
        cyan, gray, green, red, white, yellow, normal,
        lcyan, lgray, lgreen, lyellow,
        mcyan, mgreen, myellow,
    },
    commas,
    countLeaves,
    deleteExtraFlags, extractFromArgs,
    fromHexString, isHexString, isHexStringOfLength, toHexString,
    parseURL, ipIsPrivateOrLocalhost,
    showUsage, showUsageError, showUsageSubcommand,
    toolkitRun,
    toUpperCamelCase,
    toUtf8Array, utf8ArrayToStr,
    prompter, traceHeader, traceTable,
    wildcards: {
        isWildcard,
        getWildcardsCountFromString,
        replaceWildcards,
        spliceWildcard,
    },
}

function countLeaves(t, obj) {
    if (!obj) {
        return 0
    } else if (obj instanceof t) {
        return 1
    } else if (Array.isArray(obj)) {
        return obj.map(function (item) { return countLeaves(t, item) }).reduce(function (a, b) { return a + b }, 0)
    } else {
        return Object.values(obj).map(function (item) { return countLeaves(t, item) }).reduce(function (a, b) { return a + b }, 0)
    }
}

function deleteExtraFlags(args) {
    return args.filter(arg => !arg.startsWith('--'))
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
            (str.starsWith('0x') && str.slice(2).length === length * 2)
            || str.length === length * 2
        )
    );
}

function isHexString(str) {
    return (
        typeof str === 'string'
        && (
            (str.startsWith("0x") && /^[a-fA-F0-9]+$/i.test(str.slice(2)))
            || /^[a-fA-F0-9]+$/i.test(str)
        )
    );
}

function toHexString(buffer) {
    return "0x" + Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2))
        .join('')
        .match(/[a-fA-F0-9]{2}/g)
        .join('')
}

function parseURL(url) {
    if (url && typeof url === 'string' && url.indexOf("://") > -1) {
        const hostIndex = url.indexOf("://") + 3
        const schema = url.slice(0, hostIndex)
        let host = url.slice(hostIndex)
        let path = ""
        let query = ""
        const pathIndex = host.indexOf("/")
        if (pathIndex > -1) {
            path = host.slice(pathIndex + 1)
            host = host.slice(0, pathIndex)
            const queryIndex = path.indexOf("?")
            if (queryIndex > -1) {
                query = path.slice(queryIndex + 1)
                path = path.slice(0, queryIndex)
            }
        }
        return [schema, host, path, query];
    } else {
        throw new TypeError(`Invalid URL was provided: ${url}`)
    }
}

function showUsage(cmd, flags, router) {
    showUsageHeadline(cmd)
    if (flags) showUsageFlags(flags)
    if (router) showUsageRouter(router)
}

function showUsageRouter(router) {
    var cmds = Object.entries(router)
    if (cmds.length > 0) {
        console.info(`\nSUBCOMMANDS:`)
        cmds.forEach(cmd => {
            console.info("  ", `${cmd[0]}${" ".repeat(12 - cmd[0].length)}`, "  ", cmd[1].hint)
        })
    }
}

function showUsageError(cmd, subcmd, flags, params, options, error) {
    showUsageSubcommand(cmd, subcmd, flags, params, options)
    if (error) {
        console.info(`\nERROR:`)
        console.error(error?.stack?.split('\n')[0] || error)
    }
}

function showUsageEnvars() {
    if (!process.env.WITNET_TOOLKIT_MASTER_KEY || !process.env.WITNET_TOOLKIT_PROVIDER_URL) {
        console.info(`\nENVARS:`)
        console.info("  ", `${yellow("WITNET_TOOLKIT_MASTER_KEY")}  `, "  ", "Master key used for spending Wits and signing transactions.")
        console.info("  ", `${yellow("WITNET_TOOLKIT_PROVIDER_URL")}`, "  ", "Settle or change URL to a global Wit/Oracle RPC provider, or private node.")
    }
}

function showUsageFlags(flags) {
    var flags = Object.entries(flags)
    if (flags.length > 0) {
        console.info(`\nFLAGS:`)
        var maxLength = flags
            .map(flag => flag[1].param ? flag[1].param.length + flag[0].length + 3 : flag[0].length)
            .reduce((prev, curr) => curr > prev ? curr : prev);
        flags.forEach(flag => {
            var str = `${flag[0]}${flag[1].param ? ` <${flag[1].param}>` : ""}`
            console.info("  ", `--${str}${" ".repeat(maxLength - str.length)}`, "  ", flag[1].hint)
        })
    }
}

function showUsageHeadline(cmd, subcmd, params, options) {
    console.info("USAGE:")
    if (subcmd) {
        if (params) {
            var optionalize = (str) => str.endsWith(' ...]') ? `[<${str.slice(1, -5)}> ...]` : (
                str[0] === '[' ? `[<${str.slice(1, -1)}>]` : `<${str}>`
            )
            if (Array.isArray(params)) {
                params = params.map(param => optionalize(param)).join(' ') + " "
            } else {
                params = optionalize(params)
            }
        }
        console.info(`    ${white(`npx witnet ${cmd} ${subcmd}`)} [FLAGS] ${params ? green(params) + " " : ""}${options && Object.keys(options).length > 0 ? "[OPTIONS]" : ""}`)
    } else {
        console.info(`    ${white(`npx witnet ${cmd}`)} [FLAGS] <SUBCOMMAND> ... [OPTIONS]`)
    }
}

function showUsageOptions(options) {
    var options = Object.entries(options)
    if (options.length > 0) {
        console.info(`\nOPTIONS:`)
        var maxLength = options
            .map(option => option[1].param ? option[1].param.length + option[0].length + 3 : option[0].length)
            .reduce((prev, curr) => curr > prev ? curr : prev);
        options.forEach(option => {
            if (option[1].hint) {
                var str = `${option[0]}${option[1].param ? ` <${option[1].param}>` : ""}`
                console.info("  ", `--${str}${" ".repeat(maxLength - str.length)}`, "  ", option[1].hint)
            }
        })
    }
}

function showUsageSubcommand(cmd, subcmd, flags, params, options) {
    showUsageHeadline(cmd, subcmd, params, options)
    if (flags) showUsageFlags(flags)
    if (options) showUsageOptions(options)
    showUsageEnvars()
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
        for (var j = argIndex + 1; j < argsCount; j++) {
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
    var utf8 = [];
    for (var i = 0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
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
    var out, i, len, c;
    var char2, char3;

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

async function prompter(promise) {
    var loading = (function() {
        var h = ['|', '/', '-', '\\'];
        var i = 0;
        return setInterval(() => {
            i = (i > 3) ? 0 : i;  
            process.stdout.write(`\b\b${h[i]} `)
            i++;
        }, 50);
    })();
    return promise
        .then(result => { 
            clearInterval(loading); 
            process.stdout.write('\b\b')
            return result
        })
}

function traceHeader(headline, indent = "", color = normal) {
    console.info(`${indent}${color(headline.toUpperCase())}`)
    console.info(`${indent}${"-".repeat(headline.length)}`)
}

function traceTable(records, options) {
    const stringify = (data, humanizers, index) => humanizers && humanizers[index] ? humanizers[index](data).toString() : data?.toString() ?? ""
    const max = (a, b) => a > b ? a : b
    const min = (a, b) => a < b ? a : b
    const reduceMax = (numbers) => numbers.reduce((curr, prev) => prev > curr ? prev : curr, 0)
    if (!options) options = {}
    const numColumns = reduceMax(records.map(record => record?.length || 1))
    const table = transpose(records, numColumns)
    options.widths = options?.widths || table.map((column, index) => {
        var maxWidth = reduceMax(column.map(field => stringify(field, options?.humanizers, index).length))
        if (options?.headlines && options.headlines[index]) {
            maxWidth = max(maxWidth, options.headlines[index].replaceAll(':', '').length)
        }
        return min(maxWidth, 66)
    })
    var headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
    console.info(`┌─${headline.join("─┬─")}─┐`)
    if (options?.headlines) {
        headline = options.widths.map((maxWidth, index) => {
            var caption = options.headlines[index].replaceAll(':', '')
            return `${this.colors.white(caption)}${" ".repeat(maxWidth - caption.length)}`
        })
        console.info(`│ ${headline.join(" │ ")} │`)
        headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
        console.info(`├─${headline.join("─┼─")}─┤`)
    }
    for (var i = 0; i < records.length; i ++) {
        var line = ""
        for (var j = 0; j < numColumns; j ++) {
            var data = table[j][i]
            var color
            if (options?.colors && options.colors[j]) {
              color = options.colors[j]  
            } else {
              color = typeof data === 'string' 
                ? this.colors.green 
                : (Number(data) === data && data % 1 !== 0 // is float number?
                    ? this.colors.yellow 
                    : this.colors.normal
                )
            }
            var data = stringify(data, options?.humanizers, j)
            if (options?.headlines && options.headlines[j][0] === ':') {
                data = `${color(data)}${" ".repeat(options.widths[j] - data.length)}`
            } else {
                data = `${" ".repeat(options.widths[j] - data.length)}${color(data)}`
            }
            line += `│ ${data} `
        }
        console.info(`${line}│`)
    }
    var headline = options.widths.map(maxWidth => "─".repeat(maxWidth))
    console.info(`└─${headline.join("─┴─")}─┘`)
}

function transpose(records, numColumns) {
    const columns = []
    for (var index = 0; index < numColumns; index ++) {
        columns.push(records.map(row => row[index]))
    }
    return columns
}
