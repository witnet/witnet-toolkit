const fs = require("fs")
const helpers = require("../helpers")
const toolkit = require("../../../dist")

const REQUIRE_PATH = process.env.WITNET_TOOLKIT_REQUIRE_PATH || "../../../../witnet"

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    flags: {
        legacy: {
            hint: 'Inherit Radon assets from imported Witnet package',
        },
    },
    router: fs.existsSync('./witnet/assets/index.js') ? {
        assets: {
            hint: "List Radon artficats declared within your project.",
            params: "[ASSET_SUBSTRS ...]",
            options: {
                requests: {
                    hint: "Restrict output to Radon requests",
                },
                retrievals: {
                    hint: "Restrict output to Radon retrievals",
                },
                templates: {
                    hint: "Restrict output to Radon templates",
                },
            },
        },
        check: {
            hint: "Check if all Radon artifacts within your project are properly declared.",
            params: [],
            options: {},
        },
        decode: {
            hint: "Break down details of a Radon artifact.",
            params: ["ASSET_SUFFIX | RAD_HASH | BYTECODE", "[ARGS ...]",],
            options: {
                json: {
                    hint: 'Outputs data in JSON format',
                },
                headline: {
                    hint: 'Settles output report headline',
                    param: ':string'
                },
                indent: {
                    hint: 'Prefixes given number of white spaces for every output line',
                    param: ':number'
                },
            },
        },
        dryrun: {
            hint: "Simulate resolution to a Radon artifact as if solved by the Wit/Oracle.",
            params: ["ASSET_SUFFIX | RAD_HASH | BYTECODE", "[ARGS ...]",],
            options: {
                json: {
                    hint: 'Outputs data in JSON format',
                },
                headline: {
                    hint: 'Settles output report headline',
                    param: ':string'
                },
                indent: {
                    hint: 'Prefixes given number of white spaces for every output line',
                    param: ':number'
                },
                verbose: {
                    hint: 'Outputs detailed dry-run report',
                },
            },
        },
        pull: {
            hint: "Ask the Wit/Oracle to attest and forever store resolution to a Radon artifact.",
            params: [],
            options: {},
        },
    } : {
        init: {
            hint: "Initialize Witnet Radon workspace within your project."
        },
    },
    assets, init, check, decode, dryrun,
};

function init() {
    if (!fs.existsSync("./witnet/assets/")) {
        fs.mkdirSync("./witnet/assets", { recursive: true })
    }
    if (!fs.existsSync(".env_witnet")) {
        fs.cpSync("node_modules/witnet-toolkit/.env_witnet", ".env_witnet")
    }
    if (!fs.existsSync("./witnet/assets/index.js")) {
        fs.cpSync("node_modules/witnet-toolkit/witnet/assets/_index.js", "./witnet/assets/index.js")
    }
    if (!fs.existsSync("./witnet/assets/requests.js")) {
        fs.cpSync("node_modules/witnet-toolkit/witnet/assets/_requests.js", "./witnet/assets/requests.js")
    }
    if (!fs.existsSync("./witnet/assets/retrievals.js")) {
        fs.cpSync("node_modules/witnet-toolkit/witnet/assets/_retrievals.js", "./witnet/assets/retrievals.js")
    }
    if (!fs.existsSync("./witnet/assets/templates.js")) {
        fs.cpSync("node_modules/witnet-toolkit/witnet/assets/_templates.js", "./witnet/assets/templates.js")
    }
    console.info(`Initialized Witnet Radon workspace at folder ${process.cwd()}/witnet/assets`)
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

function assets(flags, args, options) {
    var { requests, templates, retrievals } = loadAssets(flags)
    var selection = {}
    if (options?.requests) {
        selection = { requests }
    }
    if (options?.templates) {
        selection = { ...selection, templates }
    }
    if (options?.retrievals) {
        selection = { ...selection, retrievals }
    }
    if (Object.keys(selection).length === 0) {
        selection = { requests, templates, retrievals }
    }
    helpers.traceHeader("WITNET RADON ASSETS")
    traceWitnetArtifacts(selection, args)
}
/// -------------------------------------------------------------------------------------------------------------------

function check(flags) {
    var { requests, templates, retrievals } = loadAssets(flags)
    var [requests, templates, retrievals] = [
        helpers.countLeaves(toolkit.RadonRequest, requests),
        helpers.countLeaves(toolkit.RadonTemplate, templates),
        helpers.countLeaves(toolkit.RadonDataSource, retrievals),
    ];
    console.info("> Radon retrievals: ", retrievals)
    console.info("> Radon requests:   ", requests)
    console.info("> Radon templates:  ", templates)
    if (requests + templates + retrievals === 0) {
        console.info("-----------------------------")
        console.info("No Radon assets declared yet!")
    } else {
        console.info("--------------------------------------")
        console.info("All Radon assets checked successfully!")
    }
}
/// -------------------------------------------------------------------------------------------------------------------

function decode(flags, args, options) {
    const assets = loadAssets(flags)
    if (args.length === 0) {
        throw "No Radon asset was specified."
    }
    var asset = args[0]
    if (helpers.isHexString(asset)) {
        try {
            var request = toolkit.RadonRequest.from(asset)
            traceWitnetRadonRequest(request, options)

        } catch {
            if ((asset.startsWith('0x') && asset.length === 66) || (!asset.startsWith('0x') && asset.length === 64)) {
                // TODO: assume it's a RAD_HASH, and try to retrieve the BYTECODE from the Witnet network
            }
        }
    } else {
        var args = args.slice(1)
        flattenWitnetArtifacts(assets)
            .filter(craft => craft.key.toLowerCase().endsWith(asset.toLowerCase()))
            .forEach(craft => {
                var artifact = craft.artifact
                var artifactArgs = args
                var prefix = ""
                if (artifact instanceof toolkit.RadonRequest) {
                    prefix = "RadonRequest::"

                } else if (artifact instanceof toolkit.RadonTemplate) {
                    const templateArgs = new Array(artifact.retrieve.length)
                    artifact.retrieve.forEach((retrieval, index) => {
                        templateArgs[index] = artifactArgs.splice(0, retrieval.argsCount)
                        while (templateArgs[index].length < retrieval.argsCount) {
                            templateArgs[index].push(`{:${templateArgs[index].length}}`)
                        }
                    })
                    artifact = artifact.buildRequest(templateArgs)
                    prefix = "RadonTemplate::"

                } else if (artifact instanceof toolkit.RadonDataSource) {
                    if (artifact.argsCount > 0) {
                        const retrievalArgs = artifactArgs.splice(0, artifact.argsCount)
                        while (retrievalArgs.length < artifact.argsCount) {
                            retrievalArgs.push(`{:${retrievalArgs.length}}`)
                        }
                        artifact = artifact.foldArgs(retrievalArgs)
                    }
                    artifact = new toolkit.RadonRequest({ retrieve: artifact })
                    prefix = "RadonRetrieval::"
                }
                if (!options?.headline) {
                    options.headline = `${prefix}${craft.key}`
                }
                traceWitnetRadonRequest(artifact, options)
                console.info()
            })
    }
}
/// -------------------------------------------------------------------------------------------------------------------

async function dryrun(flags, args, options, settings) {
    const assets = loadAssets(flags)
    if (args.length === 0) {
        throw "No Radon asset was specified."
    }
    var asset = args[0]
    if (helpers.isHexString(asset)) {
        try {
            var request = toolkit.RadonRequest.from(asset)
            await traceWitnetRadonRequestDryRun(request, options, settings)

        } catch {
            if ((asset.startsWith('0x') && asset.length === 66) || (!asset.startsWith('0x') && asset.length === 64)) {
                // TODO: assume it's a RAD_HASH, and try to retrieve the BYTECODE from the Witnet network
            }
        }
    } else {
        var args = args.slice(1)
        var crafts = flattenWitnetArtifacts(assets).filter(craft => craft.key.toLowerCase().endsWith(asset.toLowerCase()))
        for (var index in crafts) {
            var artifact = crafts[index].artifact
            var artifactArgs = args
            var prefix = ""
            if (artifact instanceof toolkit.RadonRequest) {
                prefix = "RadonRequest::"

            } else if (artifact instanceof toolkit.RadonTemplate) {
                const templateArgs = new Array(artifact.retrieve.length)
                artifact.retrieve.forEach((retrieval, index) => {
                    templateArgs[index] = artifactArgs.splice(0, retrieval.argsCount)
                    if (templateArgs[index].length < retrieval.argsCount) {
                        throw `Exact number of template args must be provided for retrieval #${index + 1} (${templateArgs[index].length
                        } < ${retrieval.argsCount
                        })`
                    }
                })
                artifact = artifact.buildRequest(templateArgs)
                prefix = "RadonTemplate::"

            } else if (artifact instanceof toolkit.RadonDataSource) {
                if (artifact.argsCount > 0) {
                    const retrievalArgs = artifactArgs.splice(0, artifact.argsCount)
                    if (retrievalArgs.length < artifact.argsCount) {
                        throw `Exact number of retrievals args must be provided (${retrievalArgs.length
                        } < ${retrieval.argsCount
                        })`
                    }
                    artifact = artifact.foldArgs(retrievalArgs)
                }
                artifact = new toolkit.RadonRequest({ retrieve: artifact })
                prefix = "RadonRetrieval::"
            }

            if (!options?.headline) {
                options.headline = `${prefix}${crafts[index].key}`
            }
            await traceWitnetRadonRequestDryRun(artifact, options, settings)
            console.info()
        }
    }
}
/// -------------------------------------------------------------------------------------------------------------------




///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE INTERNAL METHODS ------------------------------------------------------------------------------------

const extractTypeName = (str) => str ? str.split(/(?=[A-Z])/).slice(1).join("") : "Any"
const stringifyFilter = (x, c) => { var color = c || helpers.color.lcyan; return color(`${toolkit.RadonFilters.Opcodes[x.opcode]}(${x.args ? JSON.stringify(x.args) : ""})`) }
const stringifyReducer = (x, c) => { var color = c || helpers.color.lcyan; return color(`${toolkit.RadonReducers.Opcodes[x.opcode]}()`) }

function loadAssets(flags) {
    return flags?.legacy ? require(`${REQUIRE_PATH}/assets`)?.legacy : {
        requests: require(`${REQUIRE_PATH}/assets/requests`),
        templates: require(`${REQUIRE_PATH}/assets/templates`),
        retrievals: require(`${REQUIRE_PATH}/assets/retrievals`),
    };
}

function flattenWitnetArtifacts(tree, headers) {
    if (!headers) headers = []
    const matches = []
    for (const key in tree) {
        if (tree[key] instanceof toolkit.RadonRequest || tree[key] instanceof toolkit.RadonTemplate || tree[key] instanceof toolkit.RadonDataSource) {
            matches.push({
                key,
                artifact: tree[key],
            })
        } else if (typeof tree[key] === "object") {
            matches.push(...flattenWitnetArtifacts(
                tree[key],
                [...headers, key]
            ))
        }
    }
    return matches
};

function traceWitnetArtifacts(assets, args, indent = "") {
    const prefix = `${indent}   `
    Object.keys(assets).forEach((key, index) => {
        const isLast = index === Object.keys(assets).length - 1
        var color = args.find(arg => key.toLowerCase().indexOf(arg.toLowerCase()) >= 0) ? helpers.color.lcyan : helpers.color.cyan
        if (assets[key] instanceof toolkit.RadonRequest) {
            console.info(`${prefix}${color(key)}`);

        } else if (assets[key] instanceof toolkit.RadonTemplate) {

        } else if (assets[key] instanceof toolkit.RadonDataSource) {
            const argsCount = assets[key].argsCount
            console.info(`${prefix}${color(key)} ${argsCount > 0 ? helpers.color.green(`(${argsCount} args)`) : ""}`)

        } else if (typeof assets[key] === 'object') {
            console.info(`${indent}${isLast ? "└─ " : "├─ "}${key}`)
            traceWitnetArtifacts(assets[key], args, !isLast ? `${indent}│  ` : `${indent}   `)
        }
    })
}

function traceWitnetRadonReportHeadline(request, options) {
    const trait = (str) => `${str}${" ".repeat(66 - str.length)}`
    const indent = options?.indent ? " ".repeat(indent) : ""
    const resultDataType = `Result<${extractTypeName(request.retrieve[0]?.script?.outputType.constructor.name)}, RadonError>`
    console.info(`${indent}╔══════════════════════════════════════════════════════════════════════════════╗`)
    console.info(`${indent}║ ${helpers.color.white(options?.headline)}${" ".repeat(77 - options?.headline.length)}║`)
    console.info(`${indent}╠══════════════════════════════════════════════════════════════════════════════╣`)
    console.info(`${indent}║ ${helpers.color.white("RAD hash")}: ${helpers.color.lgreen(request.radHash())}   ║`)
    console.info(`${indent}║ RAD size: ${helpers.color.green(trait(helpers.commas(request.weight()) + " bytes"))} ║`)
    console.info(`${indent}║ RAD type: ${helpers.color.yellow(trait(resultDataType))} ║`)
    // if (!options.verbose) {
    //   console.info(`${indent}║ > Radon operators:  ${white(trait(commas(request.opsCount())))} ║`)
    // }
    // console.info(`${indent}╠════════════════════════════════════════════════════════════════════════════╣`)
    // console.info(`${indent}║ > Times solved:    ${white(trait("{ values:  123, errors:  220 }"))} ║`)
    // console.info(`${indent}║ > Times witnessed: ${white(trait("{ values: 2130, errors: 1326 }"))} ║`)
    // console.info(`${indent}║ > Total fees:      ${white(trait("15,234.123 Wits"))} ║`)
    // console.info(`${indent}║ > Total slash:     ${white(trait("    56.123 Wits"))} ║`)
    // console.info(`${indent}║ > Total burn:      ${white(trait("     0.789 Wits"))} ║`)
    // if (verbose) {
    //   console.info(`${indent}╚══╤═════════════════════════════════════════════════════════════════════════╝`)
    // } else {
    //   console.info(`${indent}╚════════════════════════════════════════════════════════════════════════════╝`)
    // }
}

function traceWitnetRadonRequest(request, options) {
    const indent = options?.indent ? " ".repeat(parseInt(indent)) : ""
    if (options?.json) {
        console.info(JSON.stringify(request.toProtobuf(), null, options?.indent || 0))

    } else {
        if (!options.headline) options.headline = "WITNET DATA REQUEST DISASSEMBLE"
        traceWitnetRadonReportHeadline(request, options)

        console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)
        console.info(`${indent}┌──┴─────────────────┐`)
        console.info(`${indent}│  ${helpers.color.white("RETRIEVE DATA")}     │`) // ├ ┤
        console.info(`${indent}└──┬─┬───────────────┘`)
        request.retrieve.forEach((source, sourceIndex) => {
            var authority = source.authority?.toUpperCase().split('.').slice(-2).join('.') || (source.method === toolkit.RadonRetrieve.Methods.RNG ? "WIT/RNG" : "")
            var corner = sourceIndex === request.retrieve.length - 1 ? "└" : "├"
            var sep = sourceIndex === request.retrieve.length - 1 ? " " : "│"
            console.info(
                `${indent}   │ ${corner}─ ${helpers.color.white("[ ")}${helpers.color.white(`Data source #${sourceIndex + 1}`)
                }  ${" ".repeat(3 - sourceIndex.toString().length)}${helpers.color.lgreen(authority)} ${helpers.color.white("]")}`
            )
            if (source.method !== toolkit.RadonRetrieve.Methods.RNG) {
                console.info(
                    `${indent}   │ ${sep}    > Request:        ${helpers.color.mgreen(toolkit.RadonRetrieve.Methods[source.method].split(/(?=[A-Z])/).join('-').toUpperCase())
                    }`
                )
                console.info(`${indent}   │ ${sep}    > URL query:      ${helpers.color.green(source.url)}`)
                if (source?.headers && source?.headers.length > 0) {
                    console.info(`${indent}   │ ${sep}    > HTTP headers:   ${helpers.color.green(JSON.stringify(source.headers))}`)
                }
                if (source?.body) {
                    console.info(`${indent}   │ ${sep}    > HTTP body:      ${helpers.color.green(source.body)}`)
                }
                if (source?.script) {
                    var steps = source.script.disect()
                    console.info(
                        `${indent}   │ ${sep}    > Radon script:   ${helpers.color.lyellow(`[ `)
                        }${helpers.color.yellow(steps[0][1])}${" ".repeat(12 - steps[0][1].length)
                        }${helpers.color.lyellow(` ]`)
                        } ${helpers.color.mcyan(steps[0][2])}`
                    )
                    steps.slice(1).forEach(step => {
                        console.info(
                            `${indent}   │ ${sep}                      ${helpers.color.lyellow(`[ `)
                            }${helpers.color.yellow(step[1])
                            }${" ".repeat(12 - step[1].length)
                            }${helpers.color.lyellow(` ]`)
                            } ${" ".repeat(2 * step[0])}${helpers.color.mcyan(step[2])
                            }`
                        )
                    })
                    var outputType = source.script.outputType.constructor.name || `RadonAny`
                    console.info(
                        `${indent}   │ ${sep}                      ${helpers.color.lyellow("[ ")
                        }${helpers.color.yellow(outputType)
                        }${" ".repeat(12 - outputType.length)
                        }${helpers.color.lyellow(" ]")
                        }`
                    )
                }
            }
            if (sourceIndex < request.retrieve.length - 1) {
                console.info(`${indent}   │ │`)
            }
        })
        console.info(`${indent}┌──┴──────────────────┐`)
        console.info(`${indent}│  ${helpers.color.white("AGGREGATE SOURCES")}  │`)
        console.info(`${indent}└──┬──────────────────┘`) // ┬
        request.aggregate?.filters.forEach(filter => console.info(`${indent}   │      > Radon filter:   ${stringifyFilter(filter)}`))
        console.info(`${indent}   │      > Radon reducer:  ${stringifyReducer(request.aggregate)}`)
        console.info(`${indent}┌──┴──────────────────┐`)
        console.info(`${indent}│  ${helpers.color.white("WITNESSING TALLY")}   │`)
        console.info(`${indent}└─────────────────────┘`) // ┬
        request.tally?.filters.forEach(filter => console.info(`${indent}          > Radon filter:   ${stringifyFilter(filter)}`))
        console.info(`${indent}          > Radon reducer:  ${stringifyReducer(request.tally)}`)
    }
}

async function traceWitnetRadonRequestDryRun(request, options, settings) {
    var bytecode = request.toBytecode()
    var report = await helpers
        .toolkitRun(settings, ['try-data-request', '--hex', bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode])
        .catch((err) => {
            let errorMessage = err.message.split('\n').slice(1).join('\n').trim()
            const errorRegex = /.*^error: (?<message>.*)$.*/gm
            const matched = errorRegex.exec(err.message)
            if (matched) {
                errorMessage = matched.groups.message
            }
            throw errorMessage || err
        })
    if (!report) {
        throw "No dry-report?"
    } else {
        report = JSON.parse(report)
    }
    var result = report?.aggregate.result
    const resultType = Object.keys(result)[0]
    const resultValue = Object.values(result)[0]
    if (options?.json) {
        if (options?.verbose) {
            console.info(JSON.stringify(report, null, options?.indent))
        } else {
            result[resultType] = resultValue
            console.info(JSON.stringify(result, null, options?.indent))
        }
        return
    }
    if (!options.headline) options.headline = "WITNET DATA REQUEST DRY RUN REPORT"
    traceWitnetRadonReportHeadline(request, options)
    const indent = options?.indent || ""
    console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)
    var execTimeMs = report.retrieve?.map(retrieval =>
        (retrieval?.running_time.secs || 0) + (retrieval?.running_time.nanos || 0) / 1000
    ).reduce(
        (sum, secs) => sum + secs
    )
    var execTimeMs = Math.round(execTimeMs) + " ms"
    var flexbar = "─".repeat(17)
    var flexspc = " ".repeat(flexbar.length + 12)
    console.info(`${indent}┌──┴─────────────────────────────${flexbar}──────┐`)
    console.info(`${indent}│ ${helpers.color.white("Data providers")}     ${flexspc}      │`) // ├ ┤
    console.info(`${indent}├────────────────────────────────${flexbar}──────┤`)
    console.info(`${indent}│ Execution time: ${helpers.color.green(execTimeMs)} ${" ".repeat(flexbar.length + 19 - execTimeMs.length)} │`)
    console.info(`${indent}└──┬─┬───────────────────────────${flexbar}──────┘`)
    request.retrieve.forEach((source, sourceIndex) => {
        var authority = source.authority?.toUpperCase().split('.').slice(-2).join('.') || (source.method === toolkit.RadonRetrieve.Methods.RNG ? "WIT/RNG" : "")
        var corner = sourceIndex === request.retrieve.length - 1 ? "└" : "├"
        var sep = sourceIndex === request.retrieve.length - 1 ? " " : "│"
        var color = report.retrieve[sourceIndex].result?.RadonError
            ? (options?.verbose ? helpers.color.lgray : helpers.color.gray)
            : (options?.verbose ? helpers.color.lgreen : helpers.color.green)
        if (options?.verbose) {
            console.info(
                `${indent}   │ ${corner}─ ${
                    helpers.color.white("[ ")
                }${
                    helpers.color.white(`Data Source #${sourceIndex + 1}`)
                }  ${
                    " ".repeat(3 - sourceIndex.toString().length)
                }${
                    color(authority)
                } ${
                    helpers.color.white("]")
                }`
            )
        } else {
            console.info(`${indent}   │ ${corner}─ [ ${color(authority)} ]`)
        }
        if (source.method !== toolkit.RadonRetrieve.Methods.RNG && options?.verbose) {
            const result = report.retrieve[sourceIndex].result
            const resultType = Object.keys(result)[0]
            const resultValue = JSON.stringify(Object.values(result)[0])
            console.info(
                `${indent}   │ ${sep}    > Request:        ${
                    helpers.color.mgreen(toolkit.RadonRetrieve.Methods[source.method].split(/(?=[A-Z])/).join('-').toUpperCase())
                }`
            )
            console.info(`${indent}   │ ${sep}    > URL query:      ${helpers.color.green(source.url)}`)
            if (source?.headers && source?.headers.length > 0) {
                console.info(`${indent}   │ ${sep}    > HTTP headers:   ${helpers.color.green(JSON.stringify(source.headers))}`)
            }
            if (source?.body) {
                console.info(`${indent}   │ ${sep}    > HTTP body:      ${helpers.color.green(source.body)}`)
            }
            const printData = (headline, data, color) => {
                var type = Object.keys(data)[0]
                var data = typeof data[type] === 'object' || Array.isArray(data[type]) ? JSON.stringify(data[type]) : data[type]
                var lines = data.match(/.{1,96}/g).slice(0, 256)
                if (lines.length === 256) lines[255] += "..."
                var typeColor = (type === "RadonError") ? helpers.color.red : helpers.color.yellow
                var lineColor = (type === "RadonError") ? helpers.color.gray : color
                console.info(
                    `${indent}   │ ${sep}    > ${headline}${" ".repeat(15 - headline.length)} \x1b[1;m${typeColor(`[ `)}\x1b[0m${typeColor(type)}${" ".repeat(12 - type.length)}\x1b[1;m${typeColor(` ]`)}\x1b[0m ${lineColor(lines[0])}`)
                lines.slice(1).forEach(line => {
                    console.info(`${indent}   │ ${sep}                                       ${lineColor(line)}`)
                })
            }
            if (report?.retrieve[sourceIndex]?.partial_results) {
                printData("HTTP response:", report?.retrieve[sourceIndex]?.partial_results[0], helpers.color.cyan)
            }
            printData("Radon result:", report?.retrieve[sourceIndex]?.result, helpers.color.mcyan)
        }
        if (options?.verbose && sourceIndex < request.retrieve.length - 1) {
            console.info(`${indent}   │ │`)
        }
    })
    var flexbar = "─".repeat(24);
    var flexspc = " ".repeat(36);
    console.info(`${indent}┌──┴───────────────────────────${flexbar}─┐`)
    console.info(`${indent}│ ${helpers.color.white("Aggregated result")}${flexspc} │`) // ├ ┤
    console.info(`${indent}├──────────────────────────────${flexbar}─┤`)
    if (options?.verbose) {
        var partial_index = 0
        var partial_results = report.aggregate?.partial_results
        request.aggregate?.filters.forEach(filter => {
            var color = (partial_results && partial_results[partial_index]?.RadonArray) ? helpers.color.mcyan : helpers.color.gray
            var items = (partial_results && partial_results[partial_index]?.RadonArray) ? ` over ${partial_results[partial_index]?.RadonArray.length} sources` : ""
            partial_index += 1
            var filter = stringifyFilter(filter, color)
            console.info(
                `${indent}│ Radon filter:   ${filter}${
                    helpers.color.cyan(items)
                }${
                    " ".repeat(flexbar.length + 22 - filter.length - items.length)
                } │`
            )
        })
        var color = (partial_results && partial_results[partial_index]?.RadonArray) ? helpers.color.mcyan : helpers.color.gray
        var items = (partial_results && partial_results[partial_index]?.RadonArray) ? ` over ${partial_results[partial_index]?.RadonArray.length} sources` : ""
        var reducer = stringifyReducer(request.aggregate, color)
        console.info(
            `${indent}│ Radon reducer:  ${reducer}${
                helpers.color.cyan(items)}${" ".repeat(flexbar.length + 22 - reducer.length - items.length)
            } │`
        )
    }
    console.info(`${indent}│ Result size:    ${helpers.color.cyan("xxx bytes")}${" ".repeat(flexbar.length + 13 - 9)} │`)
    console.info(`${indent}└────┬─────────────────────────${flexbar}─┘`)
    var printMapItem = (indent, width, key, value, indent2 = "") => {
        if (key) var key = `${indent2}"${key}": `
        else var key = `${indent2}`
        var type = extractTypeName(Object.keys(value)[0])
        var value = Object.values(value)[0]
        if (["Map", "Array",].includes(type)) {
            if (key.length > width - 12) {
                console.info(
                    `${indent}        ${
                        helpers.color.myellow(`[ ${type}${" ".repeat(7 - type.length)} ]`)
                    } ${
                        " ".repeat(width - 15)}${helpers.color.green("...")
                    }`
                )
            } else {
                console.info(
                    `${indent}        ${
                        helpers.color.myellow(`[ ${type}${" ".repeat(7 - type.length)} ]`)
                    } ${
                        helpers.color.green(key)
                    }${
                        " ".repeat(width - 12 - key.length)
                    }`
                )
            }
            Object.entries(value).forEach(([key, value]) => printMapItem(indent, width, type === "Map" ? key : null, value, indent2 + " "))
        } else {
            if (key.length > width - 12) {
                console.info(`${indent}        ${helpers.color.yellow(type)} ${" ".repeat(width - 15)}${helpers.color.green("...")}`)
            } else {
                if (["String", "Error",].includes(type)) {
                    value = JSON.stringify(value)
                }
                type = `[ ${type}${" ".repeat(7 - type.length)} ]`
                var result = key + value
                var spaces = width - 12 - result.length
                if (result.length > width - 15) {
                    value = value.slice(0, width - 15 - key.length) + "..."
                    spaces = 0
                }
                console.info(`${indent}        ${helpers.color.yellow(type)} ${helpers.color.green(key)}${helpers.color.mcyan(value)}`)
            }
        }
    }
    var printResult = (indent, width, resultType, resultValue) => {
        resultType = extractTypeName(resultType)
        resultValue = typeof resultValue === 'object' || Array.isArray(resultValue) ? JSON.stringify(resultValue) : resultValue
        if (["Map", "Array",].includes(resultType)) {
            console.info(`${indent}     └─ ${helpers.color.lyellow(`[ ${resultType}${" ".repeat(7 - resultType.length)} ]`)}`)
            var obj = JSON.parse(resultValue)
            Object.entries(obj).forEach(([key, value]) => printMapItem(indent, width, resultType === "Map" ? key : null, value))
        } else {
            if (resultType === "Bytes") {
                resultValue = JSON.parse(resultValue).map(char => ('00' + char.toString(16)).slice(-2)).join("")
            }
            var color = resultType.indexOf("Error") > -1 ? helpers.color.gray : helpers.color.lcyan
            var typeText = resultType.indexOf("Error") > -1 ? `\x1b[1;98;41m  Error  \x1b[0m` : helpers.color.lyellow(`[ ${resultType} ]`)
            var lines = resultValue.match(/.{1,96}/g).slice(0, 256)
            console.info(`${indent}     └─ ${typeText} ${color(lines[0])}`)
            lines.slice(1).forEach(line => {
                console.info(`${indent}             ${" ".repeat(resultType.length)}${color(line)}`)
            })
        }
    }
    printResult(indent, 134, resultType, resultValue)
}
