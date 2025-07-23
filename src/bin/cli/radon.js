const fs = require("fs")
const inquirer = require("inquirer")
const merge = require("lodash.merge")
const path = require("path")

const helpers = require("../helpers")
const { Witnet } = require("../../../dist/src")

const WITNET_ASSETS_PATH = process.env.WITNET_SDK_RADON_ASSETS_PATH || "../../../../../witnet/assets"

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

const isModuleInitialized = fs.existsSync("./witnet/assets/index.js")

module.exports = {
  flags: {
    module: {
      hint: "Package where to fetch Radon assets from (supersedes --legacy).",
      param: "NPM_PACKAGE",
    },
  },
  router: isModuleInitialized
    ? {
      assets: {
        hint: "List available Witnet Radon assets.",
        params: "[RADON_ASSETS ...]",
        options: {
          legacy: {
            hint: "List only those declared in witnet/assets folder.",
          },
          filter: {
            hint: "Restrict output to name-matching assets.",
          },
        },
      },
      check: {
        hint: "Check correctness of Witnet Radon artifacts declared in witnet/assets folder.",
        params: [],
        options: {},
      },
      decode: {
        hint: "Break down specs of one or more Radon assets.",
        params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET"],
        options: {
          json: {
            hint: "Outputs data in JSON format.",
          },
          headline: {
            hint: "Settles output report headline.",
            param: ":string",
          },
          indent: {
            hint: "Prefixes given number of white spaces for every output line.",
            param: ":number",
          },
        },
      },
      "dry-run": {
        hint: "Simulate resolution of one or more Radon assets, as if solved by the Wit/Oracle.",
        params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET"],
        options: {
          default: {
            hint: "Use default sample parameters on parametrized Radon assets.",
          },
          json: {
            hint: "Outputs data in JSON format.",
          },
          headline: {
            hint: "Settles output report headline.",
            param: ":string",
          },
          indent: {
            hint: "Prefixes given number of white spaces for every output line.",
            param: ":number",
          },
          verbose: {
            hint: "Outputs detailed dry-run report.",
          },
        },
      },
    }
    : {
      assets: {
        hint: "List available Witnet Radon assets.",
        params: "[RADON_ASSETS ...]",
        options: {
          filter: {
            hint: "Restrict output to name-matching assets.",
          },
        },
      },
      decode: {
        hint: "Break down specs of one or more Radon assets.",
        params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET"],
        options: {
          json: {
            hint: "Outputs data in JSON format.",
          },
          headline: {
            hint: "Settles output report headline.",
            param: ":string",
          },
          indent: {
            hint: "Prefixes given number of white spaces for every output line.",
            param: ":number",
          },
        },
      },
      "dry-run": {
        hint: "Simulate resolution of one or more Radon assets, as if solved by the Wit/Oracle.",
        params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET"],
        options: {
          json: {
            hint: "Outputs data in JSON format.",
          },
          headline: {
            hint: "Settles output report headline.",
            param: ":string",
          },
          indent: {
            hint: "Prefixes given number of white spaces for every output line.",
            param: ":number",
          },
          verbose: {
            hint: "Outputs detailed dry-run report.",
          },
        },
      },
      init: {
        hint: "Initialize a Witnet Radon workspace in this project.",
      },
    },
  subcommands: {
    assets, init, check, decode, "dry-run": dryrun,
  },
  loadAssets,
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function init () {
  if (!fs.existsSync("./witnet/assets/")) {
    fs.mkdirSync("./witnet/assets", { recursive: true })
  }
  if (!fs.existsSync(".env_witnet")) {
    fs.cpSync("node_modules/@witnet/sdk/.env_witnet", ".env_witnet")
  }
  if (!fs.existsSync("./witnet/assets/index.js")) {
    fs.cpSync("node_modules/@witnet/sdk/witnet/assets/_index.js", "./witnet/assets/index.js")
  }
  if (!fs.existsSync("./witnet/assets/requests.js")) {
    fs.cpSync("node_modules/@witnet/sdk/witnet/assets/_requests.js", "./witnet/assets/requests.js")
  }
  if (!fs.existsSync("./witnet/assets/sources.js")) {
    fs.cpSync("node_modules/@witnet/sdk/witnet/assets/_sources.js", "./witnet/assets/sources.js")
  }
  if (!fs.existsSync("./witnet/assets/templates.js")) {
    fs.cpSync("node_modules/@witnet/sdk/witnet/assets/_templates.js", "./witnet/assets/templates.js")
  }
  console.info(`Initialized Witnet Radon workspace at folder ${process.cwd()}/witnet/assets`)
}

async function assets (options = {}, [...patterns]) {
  helpers.traceHeader(
    `${options?.module ? options.module.toUpperCase() : path.basename(process.cwd()).toUpperCase()} RADON ASSETS`,
    helpers.colors.white
  )
  const assets = clearEmptyBranches(loadAssets(options), patterns, options?.filter)
  if (assets && Object.keys(assets).length > 0) {
    traceWitnetArtifacts(assets, patterns, "  ", options?.filter)
  } else {
    console.info("> No custom Radon assets declared just yet.")
  }
}
/// -------------------------------------------------------------------------------------------------------------------

async function check (options = {}) {
  if (!isModuleInitialized) {
    throw new Error(`No Witnet Radon workspace has been initialized. Please, run ${white("npx witnet radon init")} if willing to declare your own Radon assets.`)
  }
  try {
    const assets = loadAssets({ ...options, legacy: true })
    const [
      modals,
      requests,
      sources,
      templates,
    ] = [
      helpers.countLeaves(Witnet.Radon.RadonModal, assets),
      helpers.countLeaves(Witnet.Radon.RadonRequest, assets),
      helpers.countLeaves(Witnet.Radon.RadonRetrieval, assets?.sources),
      helpers.countLeaves(Witnet.Radon.RadonTemplate, assets),
    ]
    if (modals > 0) console.info("> Radon modals:   ", modals)
    if (sources > 0) console.info("> Radon sources:  ", sources)
    if (requests > 0) console.info("> Radon requests: ", requests)
    if (templates > 0) console.info("> Radon templates:", templates)

    if (modals + sources + requests + templates === 0) {
      console.info("-----------------------------")
      console.info("No Radon assets declared yet!")
    } else {
      console.info("--------------------------------------")
      console.info("All Radon assets checked successfully!")
    }
  } catch (e) {
    console.error("Radon assets verification failed:")
    console.info("----------------------------------")
    console.info(e)
  }
}
/// -------------------------------------------------------------------------------------------------------------------

async function decode (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No Radon asset was specified")
  }
  const asset = args[0]
  if (helpers.isHexString(asset)) {
    try {
      const request = Witnet.Radon.RadonRequest.fromBytecode(asset)
      traceWitnetRadonRequest(request, options)
    } catch (err) {
      console.error(err)
      if ((asset.startsWith("0x") && asset.length === 66) || (!asset.startsWith("0x") && asset.length === 64)) {
        // TODO: assume it's a DR_TX_HASH
        // TODO: assume it's a RAD_HASH
      }
    }
  } else {
    args = args.slice(1)

    const assets = loadAssets(options)
    const headline = options?.headline
    const crafts = flattenRadonArtifacts(assets).filter(craft => craft.key.toLowerCase().indexOf(asset.toLowerCase()) >= 0)
    if (crafts.length === 0) {
      throw Error(`No matched found for pattern "${asset}"`)
    }
    for (let { artifact, key } of crafts) {
      let prefix = ""
      if (artifact instanceof Witnet.Radon.RadonRequest) {
        prefix = "RadonRequest::"
      } else if (artifact instanceof Witnet.Radon.RadonModal) {
        artifact.providers = ["https://dummy"]
        const modalArgs = []
        let argIndex = 0
        while (modalArgs.length < artifact.argsCount) {
          modalArgs.push(`{:${++argIndex}}`)
        }
        artifact = artifact.buildRadonRequest(modalArgs)
        prefix = "RadonModal::"
      } else if (artifact instanceof Witnet.Radon.RadonTemplate) {
        const templateArgs = artifact.sources.map(({ argsCount }) =>
          Array.from({ length: argsCount }, (_, i) => `{:${i}}`)
        )
        artifact = artifact.buildRadonRequest(templateArgs)
        prefix = "RadonTemplate::"
      } else if (artifact instanceof Witnet.Radon.RadonRetrieval) {
        if (artifact.argsCount > 0) {
          const retrievalArgs = Array.from(
            { length: artifact.argsCount },
            (_, i) => `{:${i + 1}}`
          )
          artifact = artifact.foldArgs(retrievalArgs)
        }
        artifact = new Witnet.Radon.RadonRequest({ sources: artifact })
        prefix = "RadonRetrieval::"
      }
      if (!headline) {
        options.headline = `${prefix}${key}`
      }
      traceWitnetRadonRequest(artifact, options)
      if (options?.verbose && key !== crafts[crafts.length - 1].key) {
        console.info(`${options?.indent || ""}${"─".repeat(150)}`)
      }
      console.info()
    }
  }
}
/// -------------------------------------------------------------------------------------------------------------------

async function dryrun (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No Radon asset was specified")
  }
  const asset = args[0]
  if (helpers.isHexString(asset)) {
    try {
      const request = Witnet.Radon.RadonRequest.fromBytecode(asset)
      await traceWitnetRadonRequestDryRun(request, options)
    } catch {
      if ((asset.startsWith("0x") && asset.length === 66) || (!asset.startsWith("0x") && asset.length === 64)) {
        // TODO: assume it's a RAD_HASH, and try to retrieve the BYTECODE from the Witnet network
      }
    }
  } else {
    args = args.slice(1)
    const assets = loadAssets(options)
    const headline = options?.headline
    const crafts = flattenRadonArtifacts(assets).filter(craft => craft.key.toLowerCase().indexOf(asset.toLowerCase()) >= 0)
    if (crafts.length === 0) {
      throw Error(`No matched found for pattern "${asset}"`)
    }
    for (let { artifact, key } of crafts) {
      let prefix = ""
      if (artifact instanceof Witnet.Radon.RadonRequest) {
        prefix = "RadonRequest::"
      } else {
        if (!artifact?.samples) {
          console.error(`${artifact.constructor.name}::${key}: cannot dry-run if no sample parameters are declared.\n`)
          continue
        }
        let artifactArgs = []
        if (options?.default) {
          artifactArgs = Object.values(artifact.samples)[0]
        } else {
          const prompt = inquirer.createPromptModule()
          const sample = await prompt([{
            choices: Object.keys(artifact.samples),
            message: `${artifact.constructor.name}::${key} args:`,
            name: "key",
            type: "list",
          }])
          artifactArgs = artifact.samples[sample.key]
        }
        if (artifact instanceof Witnet.Radon.RadonModal) {
          artifact.providers = artifactArgs.shift().split(";")
          artifact = artifact.buildRadonRequest(artifactArgs)
          prefix = "RadonModal::"
        } else if (artifact instanceof Witnet.Radon.RadonTemplate) {
          artifact = artifact.buildRadonRequest(artifactArgs)
          prefix = "RadonTemplate::"
        } else if (artifact instanceof Witnet.Radon.RadonRetrieval) {
          artifact = new Witnet.Radon.RadonRequest({ sources: artifact.foldArgs(artifactArgs) })
          prefix = "RadonRetrieval::"
        }
      }
      if (!headline) {
        options.headline = `${prefix}${key}`
      }
      await traceWitnetRadonRequestDryRun(artifact, options)
      if (options?.verbose && key !== crafts[crafts.length - 1].key) {
        console.info(`${options?.indent || ""}${"─".repeat(150)}`)
      }
      console.info()
    }
  }
}
/// -------------------------------------------------------------------------------------------------------------------

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE INTERNAL METHODS ------------------------------------------------------------------------------------

const extractTypeName = (str) => str ? str.split(/(?=[A-Z])/).slice(1).join("") : "Any"

const stringifyFilter = (x, c) => {
  const color = c || helpers.colors.mcyan
  return color(`${Witnet.Radon.filters.Opcodes[x.opcode]}(${x.args ? JSON.stringify(x.args) : ""})`)
}

const stringifyReducer = (x, c) => {
  const color = c || helpers.colors.mcyan
  return color(`${Witnet.Radon.reducers.Opcodes[x.opcode]}()`)
}

function loadAssets (options) {
  const { assets } = options?.module ? require(options.module) : (options?.legacy ? {} : require("@witnet/sdk"))
  return isModuleInitialized && fs.existsSync(`${WITNET_ASSETS_PATH}`) ? merge(assets, require(`${WITNET_ASSETS_PATH}`)) : assets
}

function flattenRadonArtifacts (tree, headers) {
  if (!headers) headers = []
  const matches = []
  for (const key in tree) {
    if (
      tree[key] instanceof Witnet.Radon.RadonRetrieval ||
            tree[key] instanceof Witnet.Radon.RadonModal ||
            tree[key] instanceof Witnet.Radon.RadonRequest ||
            tree[key] instanceof Witnet.Radon.RadonTemplate
    ) {
      matches.push({
        key,
        artifact: tree[key],
      })
    } else if (typeof tree[key] === "object") {
      matches.push(...flattenRadonArtifacts(
        tree[key],
        [...headers, key]
      ))
    }
  }
  return matches
};

function countWitnetArtifacts (assets, args, filter = false) {
  let counter = 0
  Object.entries(assets).forEach(([key, value]) => {
    if ((
      value instanceof Witnet.Radon.RadonModal ||
                value instanceof Witnet.Radon.RadonRequest ||
                value instanceof Witnet.Radon.RadonTemplate ||
                value instanceof Witnet.Radon.RadonRetrieval
    ) && (
      !filter ||
                !args ||
                args.length === 0 ||
                args.find(arg => key.toLowerCase().indexOf(arg.toLowerCase()) >= 0)
    )) {
      counter++
    } else if (typeof value === "object") {
      counter += countWitnetArtifacts(value, args)
    }
  })
  return counter
}

function clearEmptyBranches (node, args, filter) {
  if (node) {
    const assets = Object.fromEntries(
      Object.entries(node).map(([key, value]) => {
        if (
          (!filter || args.find(arg => key.toLowerCase().indexOf(arg.toLowerCase()) >= 0)) && (
            value instanceof Witnet.Radon.RadonRetrieval ||
                        value instanceof Witnet.Radon.RadonModal ||
                        value instanceof Witnet.Radon.RadonRequest ||
                        value instanceof Witnet.Radon.RadonTemplate
          )
        ) {
          return [key, value]
        } else if (typeof value === "object") {
          if (countWitnetArtifacts(value, args, filter) > 0) {
            return [key, clearEmptyBranches(value, args, filter)]
          } else {
            return [key, undefined]
          }
        } else {
          return [key, undefined]
        }
      })
        .filter(([, value]) => value !== undefined)
    )
    if (Object.keys(assets).length > 0) {
      return assets
    } else {
      return undefined
    }
  }
}

function traceWitnetArtifacts (assets, args, indent = "", filter = false) {
  const prefix = `${indent}`
  Object.keys(assets).forEach((key, index) => {
    const isLast = index === Object.keys(assets).length - 1
    const found = args.find(arg => key.toLowerCase().indexOf(arg.toLowerCase()) >= 0)
    const color = found ? helpers.colors.mcyan : helpers.colors.cyan
    if (assets[key] instanceof Witnet.Radon.RadonRequest) {
      if (!filter || found) {
        console.info(`${prefix}${color(key)}`)
        if (isLast) {
          console.info(`${prefix}`)
        }
      }
    } else if (
      assets[key] instanceof Witnet.Radon.RadonTemplate ||
            assets[key] instanceof Witnet.Radon.RadonModal
    ) {
      const argsCount = assets[key].argsCount
      if (!filter || found) {
        console.info(`${prefix}${color(key)} ${argsCount > 0 ? helpers.colors.green(`(${argsCount} args)`) : ""}`)
        if (isLast) {
          console.info(`${prefix}`)
        }
      }
    } else if (assets[key] instanceof Witnet.Radon.RadonRetrieval) {
      const argsCount = assets[key].argsCount
      if (!filter || found) {
        console.info(`${prefix}${color(key)} ${argsCount > 0 ? helpers.colors.green(`(${argsCount} args)`) : ""}`)
        if (isLast) {
          console.info(`${prefix}`)
        }
      }
    } else if (typeof assets[key] === "object" && countWitnetArtifacts(assets[key], args, filter) > 0) {
      console.info(`${indent}${isLast ? "└─ " : "├─ "}${key}`)
      traceWitnetArtifacts(assets[key], args, !isLast ? `${indent}│  ` : `${indent}   `, filter)
    }
  })
}

function traceWitnetRadonReportHeadline (request, options) {
  const trait = (str) => `${str}${" ".repeat(66 - str.length)}`
  const indent = options?.indent ? " ".repeat(options.indent) : ""
  const resultDataType = `Result<${extractTypeName(request.sources[0]?.script?.outputType.constructor.name)}, RadonError>`
  console.info(`${indent}╔══════════════════════════════════════════════════════════════════════════════╗`)
  console.info(`${indent}║ ${helpers.colors.white(options?.headline)}${" ".repeat(77 - options?.headline.length)}║`)
  console.info(`${indent}╠══════════════════════════════════════════════════════════════════════════════╣`)
  console.info(`${indent}║ ${helpers.colors.white("RAD hash")}: ${helpers.colors.lgreen(request.radHash)}   ║`)
  console.info(`${indent}║ RAD size: ${helpers.colors.green(trait(helpers.commas(request.weight()) + " bytes"))} ║`)
  console.info(`${indent}║ RAD type: ${helpers.colors.yellow(trait(resultDataType))} ║`)
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

function traceWitnetRadonRequest (request, options) {
  const indent = options?.indent ? " ".repeat(parseInt(options.indent)) : ""
  if (options?.json) {
    console.info(JSON.stringify(request.toProtobuf(), null, options?.indent || 0))
  } else {
    if (!options.headline) options.headline = "WITNET DATA REQUEST DISASSEMBLE"
    traceWitnetRadonReportHeadline(request, options)

    console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)
    console.info(`${indent}┌──┴─────────────────┐`)
    console.info(`${indent}│  ${helpers.colors.white("RETRIEVE DATA")}     │`) // ├ ┤
    console.info(`${indent}└──┬─┬───────────────┘`)
    request.sources.forEach((source, sourceIndex) => {
      const authority = source.authority?.toUpperCase().split(".").slice(-2).join(".") || (
        source.method === Witnet.Radon.retrievals.Methods.RNG ? "WIT/RNG" : ""
      )
      const corner = sourceIndex === request.sources.length - 1 ? "└" : "├"
      const sep = sourceIndex === request.sources.length - 1 ? " " : "│"
      console.info(
        `${indent}   │ ${corner}─ ${helpers.colors.white("[ ")}${helpers.colors.white(`Data source #${sourceIndex + 1}`)
        }  ${" ".repeat(3 - sourceIndex.toString().length)}${helpers.colors.white(authority)} ${helpers.colors.white("]")}`
      )
      if (source.method !== Witnet.Radon.retrievals.Methods.RNG) {
        console.info(
          `${indent}   │ ${sep}    > Request:        ${
            helpers.colors.mgreen(Witnet.Radon.retrievals.Methods[source.method].split(/(?=[A-Z])/).join("-").toUpperCase())
          }`
        )
        console.info(`${indent}   │ ${sep}    > URL query:      ${helpers.colors.green(source.url)}`)
        if (source?.headers) { 
          console.info(`${indent}   │ ${sep}    > HTTP headers:   ${helpers.colors.green(JSON.stringify(source.headers))}`)
        }
        if (source?.body) {
          console.info(`${indent}   │ ${sep}    > HTTP body:      ${helpers.colors.green(source.body)}`)
        }
        if (source?.script) {
          const steps = source.script.disect()
          console.info(
            `${indent}   │ ${sep}    > Radon script:   ${helpers.colors.lyellow("[ ")
            }${helpers.colors.yellow(steps[0][1])}${" ".repeat(12 - steps[0][1].length)
            }${helpers.colors.lyellow(" ]")
            } ${helpers.colors.mcyan(steps[0][2])}`
          )
          steps.slice(1).forEach(step => {
            console.info(
              `${indent}   │ ${sep}                      ${helpers.colors.lyellow("[ ")
              }${helpers.colors.yellow(step[1])
              }${" ".repeat(12 - step[1].length)
              }${helpers.colors.lyellow(" ]")
              } ${" ".repeat(2 * step[0])}${helpers.colors.mcyan(step[2])
              }`
            )
          })
          const outputType = source.script.outputType.constructor.name || "RadonAny"
          console.info(
            `${indent}   │ ${sep}                      ${helpers.colors.lyellow("[ ")
            }${helpers.colors.yellow(outputType)
            }${" ".repeat(12 - outputType.length)
            }${helpers.colors.lyellow(" ]")
            }`
          )
        }
      }
      if (sourceIndex < request.sources.length - 1) {
        console.info(`${indent}   │ │`)
      }
    })
    console.info(`${indent}┌──┴──────────────────┐`)
    console.info(`${indent}│  ${helpers.colors.white("AGGREGATE SOURCES")}  │`)
    console.info(`${indent}└──┬──────────────────┘`) // ┬
    request.sourcesReducer?.filters.forEach(filter => console.info(`${indent}   │      > Radon filter:   ${stringifyFilter(filter)}`))
    console.info(`${indent}   │      > Radon reducer:  ${stringifyReducer(request.sourcesReducer)}`)
    console.info(`${indent}┌──┴──────────────────┐`)
    console.info(`${indent}│  ${helpers.colors.white("WITNESSING TALLY")}   │`)
    console.info(`${indent}└─────────────────────┘`) // ┬
    request.witnessReducer?.filters.forEach(filter => console.info(`${indent}          > Radon filter:   ${stringifyFilter(filter)}`))
    console.info(`${indent}          > Radon reducer:  ${stringifyReducer(request.witnessReducer)}`)
  }
}

async function traceWitnetRadonRequestDryRun (request, options) {
  const bytecode = request.toBytecode()
  let report = await helpers
    .toolkitRun(options, ["try-data-request", "--hex", bytecode.startsWith("0x") ? bytecode.slice(2) : bytecode])
    .catch((err) => {
      let errorMessage = err.message.split("\n").slice(1).join("\n").trim()
      const errorRegex = /.*^error: (?<message>.*)$.*/gm
      const matched = errorRegex.exec(err.message)
      if (matched) {
        errorMessage = matched.groups.message
      }
      throw errorMessage || err
    })
  if (!report) {
    throw Error("No dry-report?")
  } else {
    report = JSON.parse(report)
  }
  const result = report?.aggregate.result
  const resultType = Object.keys(result)[0]
  const resultValue = Object.values(result)[0]
  if (options?.json) {
    if (options?.verbose) {
      console.info(JSON.stringify(report, null, options?.indent ? " ".repeat(options.indent) : ""))
    } else {
      result[resultType] = resultValue
      console.info(JSON.stringify(result, null, options?.indent ? " ".repeat(options.indent) : ""))
    }
    return
  }
  if (!options.headline) options.headline = "WITNET DATA REQUEST DRY-RUN REPORT"
  traceWitnetRadonReportHeadline(request, options)
  const indent = options?.indent ? " ".repeat(options.indent) : ""
  console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)
  let execTimeMs = report.retrieve?.map(retrieval =>
    (retrieval?.running_time.secs || 0) + (retrieval?.running_time.nanos || 0) / 1000
  ).reduce(
    (sum, secs) => sum + secs
  )
  execTimeMs = Math.round(execTimeMs) + " ms"
  let flexbar = "─".repeat(17)
  let flexspc = " ".repeat(flexbar.length + 12)
  console.info(`${indent}┌──┴─────────────────────────────${flexbar}──────┐`)
  console.info(`${indent}│ ${helpers.colors.white("Data providers")}     ${flexspc}      │`) // ├ ┤
  console.info(`${indent}├────────────────────────────────${flexbar}──────┤`)
  console.info(`${indent}│ Execution time: ${helpers.colors.green(execTimeMs)} ${" ".repeat(flexbar.length + 19 - execTimeMs.length)} │`)
  console.info(`${indent}└──┬─┬───────────────────────────${flexbar}──────┘`)
  request.sources.forEach((source, sourceIndex) => {
    const authority = source.authority?.toUpperCase().split(".").slice(-2).join(".") || (
      source.method === Witnet.Radon.retrievals.Methods.RNG ? "WIT/RNG" : ""
    )
    const corner = sourceIndex === request.sources.length - 1 ? "└" : "├"
    const sep = sourceIndex === request.sources.length - 1 ? " " : "│"
    const color = report.retrieve[sourceIndex].result?.RadonError
      ? (options?.verbose ? helpers.colors.lgray : helpers.colors.gray)
      : (options?.verbose ? helpers.colors.lgreen : helpers.colors.green)
    if (options?.verbose) {
      console.info(
        `${indent}   │ ${corner}─ ${
          helpers.colors.white("[ ")
        }${
          helpers.colors.white(`Data Source #${sourceIndex + 1}`)
        }  ${
          " ".repeat(3 - sourceIndex.toString().length)
        }${
          color(authority)
        } ${
          helpers.colors.white("]")
        }`
      )
    } else {
      console.info(`${indent}   │ ${corner}─ [ ${color(authority)} ]`)
    }
    if (source.method !== Witnet.Radon.retrievals.Methods.RNG && options?.verbose) {
      // const result = report.retrieve[sourceIndex].result
      // const resultType = Object.keys(result)[0]
      // const resultValue = JSON.stringify(Object.values(result)[0])
      console.info(
        `${indent}   │ ${sep}    > Request:        ${
          helpers.colors.mgreen(Witnet.Radon.retrievals.Methods[source.method].split(/(?=[A-Z])/).join("-").toUpperCase())
        }`
      )
      console.info(`${indent}   │ ${sep}    > URL query:      ${helpers.colors.green(source.url)}`)
      if (source?.headers) {
        console.info(`${indent}   │ ${sep}    > HTTP headers:   ${helpers.colors.green(JSON.stringify(source.headers))}`)
      }
      if (source?.body) {
        console.info(`${indent}   │ ${sep}    > HTTP body:      ${helpers.colors.green(source.body)}`)
      }
      const printData = (headline, data, color) => {
        const type = Object.keys(data)[0]
        data = typeof data[type] === "object" || Array.isArray(data[type]) ? JSON.stringify(data[type]) : data[type]
        const lines = data.match(/.{1,96}/g).slice(0, 256)
        if (lines.length === 256) lines[255] += "..."
        const typeColor = (type === "RadonError") ? helpers.colors.red : helpers.colors.yellow
        const lineColor = (type === "RadonError") ? helpers.colors.gray : color
        console.info(
          `${indent}   │ ${sep}    > ${headline}${" ".repeat(15 - headline.length)} \x1b[1;m${
            typeColor("[ ")
          }\x1b[0m${typeColor(type)}${
            " ".repeat(12 - type.length)
          }\x1b[1;m${typeColor(" ]")}\x1b[0m ${
            lineColor(lines[0])
          }`)
        lines.slice(1).forEach(line => {
          console.info(`${indent}   │ ${sep}                                       ${lineColor(line)}`)
        })
      }
      if (report?.retrieve[sourceIndex]?.partial_results) {
        printData("HTTP response:", report?.retrieve[sourceIndex]?.partial_results[0], helpers.colors.cyan)
      }
      printData("Radon result:", report?.retrieve[sourceIndex]?.result, helpers.colors.mcyan)
    }
    if (options?.verbose && sourceIndex < request.sources.length - 1) {
      console.info(`${indent}   │ │`)
    }
  })
  flexbar = "─".repeat(24)
  flexspc = " ".repeat(36)
  console.info(`${indent}┌──┴───────────────────────────${flexbar}─┐`)
  console.info(`${indent}│ ${helpers.colors.white("Aggregated result")}${flexspc} │`) // ├ ┤
  console.info(`${indent}├──────────────────────────────${flexbar}─┤`)
  if (options?.verbose) {
    let partial_index = 0
    const partial_results = report.sourcesReducer?.partial_results
    request.sourcesReducer?.filters.forEach(filter => {
      const color = (partial_results && partial_results[partial_index]?.RadonArray) ? helpers.colors.mcyan : helpers.colors.gray
      const items = (partial_results && partial_results[partial_index]?.RadonArray)
        ? ` over ${partial_results[partial_index]?.RadonArray.length} sources`
        : ""
      partial_index += 1
      filter = stringifyFilter(filter, color)
      console.info(
        `${indent}│ Radon filter:   ${filter}${
          helpers.colors.cyan(items)
        }${
          " ".repeat(flexbar.length + 22 - filter.length - items.length)
        } │`
      )
    })
    const color = (partial_results && partial_results[partial_index]?.RadonArray) ? helpers.colors.mcyan : helpers.colors.gray
    const items = (partial_results && partial_results[partial_index]?.RadonArray)
      ? ` over ${partial_results[partial_index]?.RadonArray.length} sources`
      : ""
    const reducer = stringifyReducer(request.sourcesReducer, color)
    console.info(
      `${indent}│ Radon reducer:  ${reducer}${
        helpers.colors.cyan(items)}${" ".repeat(flexbar.length + 22 - reducer.length - items.length)
      } │`
    )
  }
  console.info(`${indent}│ Result size:    ${helpers.colors.cyan("xxx bytes")}${" ".repeat(flexbar.length + 13 - 9)} │`)
  console.info(`${indent}└────┬─────────────────────────${flexbar}─┘`)
  const printMapItem = (indent, width, key, value, indent2 = "") => {
    if (key) key = `${indent2}"${key}": `
    else key = `${indent2}`
    let type = extractTypeName(Object.keys(value)[0])
    value = Object.values(value)[0]
    if (["Map", "Array"].includes(type)) {
      if (key.length > width - 12) {
        console.info(
          `${indent}        ${
            helpers.colors.myellow(`[ ${type}${" ".repeat(7 - type.length)} ]`)
          } ${
            " ".repeat(width - 15)}${helpers.colors.green("...")
          }`
        )
      } else {
        console.info(
          `${indent}        ${
            helpers.colors.myellow(`[ ${type}${" ".repeat(7 - type.length)} ]`)
          } ${
            helpers.colors.green(key)
          }${
            " ".repeat(width - 12 - key.length)
          }`
        )
      }
      Object.entries(value).forEach(([key, value]) => printMapItem(indent, width, type === "Map" ? key : null, value, indent2 + " "))
    } else {
      if (key.length > width - 12) {
        console.info(`${indent}        ${helpers.colors.yellow(type)} ${" ".repeat(width - 15)}${helpers.colors.green("...")}`)
      } else {
        if (["String", "Error"].includes(type)) {
          value = JSON.stringify(value)
        }
        type = `[ ${type}${" ".repeat(7 - type.length)} ]`
        const result = key + value
        // let spaces = width - 12 - result.length
        if (result.length > width - 15) {
          value = value.slice(0, width - 15 - key.length) + "..."
          // spaces = 0
        }
        console.info(`${indent}        ${helpers.colors.yellow(type)} ${helpers.colors.green(key)}${helpers.colors.mcyan(value)}`)
      }
    }
  }
  const printResult = (indent, width, resultType, resultValue) => {
    resultType = extractTypeName(resultType)
    resultValue = typeof resultValue === "object" || Array.isArray(resultValue) ? JSON.stringify(resultValue) : resultValue
    if (["Map", "Array"].includes(resultType)) {
      console.info(`${indent}     └─ ${helpers.colors.lyellow(`[ ${resultType}${" ".repeat(7 - resultType.length)} ]`)}`)
      const obj = JSON.parse(resultValue)
      Object.entries(obj).forEach(([key, value]) => printMapItem(indent, width, resultType === "Map" ? key : null, value))
    } else {
      if (resultType === "Bytes") {
        resultValue = JSON.parse(resultValue).map(char => ("00" + char.toString(16)).slice(-2)).join("")
      }
      const color = resultType.indexOf("Error") > -1 ? helpers.colors.gray : helpers.colors.lcyan
      const typeText = resultType.indexOf("Error") > -1 ? "\x1b[1;98;41m  Error  \x1b[0m" : helpers.colors.lyellow(`[ ${resultType} ]`)
      const lines = resultValue.match(/.{1,96}/g).slice(0, 256)
      console.info(`${indent}     └─ ${typeText} ${color(lines[0])}`)
      lines.slice(1).forEach(line => {
        console.info(`${indent}             ${" ".repeat(resultType.length)}${color(line)}`)
      })
    }
  }
  printResult(indent, 134, resultType, resultValue)
}
