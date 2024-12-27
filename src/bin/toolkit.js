#!/usr/bin/env node

/// IMPORTS ===========================================================================================================

const axios = require("axios")
const cbor = require('cbor')
const fs = require('fs')
const os = require('os')
const path = require('path')
const readline = require('readline')
const { exec } = require("child_process")

const toolkit = require("../")
  
/// CONSTANTS =======================================================================================================  
  
const version = '1.7.1'
const toolkitDownloadUrlBase = `https://github.com/witnet/witnet-rust/releases/download/${version}/`
const toolkitDownloadNames = {
  win32: (arch) => `witnet_toolkit-${arch}-pc-windows-msvc.exe`,
  // TODO: detect armv7
  linux: (arch) => `witnet_toolkit-${arch}-unknown-linux-gnu${arch === "arm" ? "eabihf" : ""}`,
  darwin: (arch) => `witnet_toolkit-${arch}-apple-darwin`,
}
const toolkitFileNames = {
  win32: (arch) => `witnet_toolkit-${version}-${arch}-pc-windows-msvc.exe`,
  // TODO: detect armv7
  linux: (arch) => `witnet_toolkit-${version}-${arch}-unknown-linux-gnu${arch === "arm" ? "eabihf" : ""}`,
  darwin: (arch) => `witnet_toolkit-${version}-${arch}-apple-darwin`,
}
const archsMap = {
  arm64: 'aarch64',
  x64: 'x86_64'
}

/// ENVIRONMENT ACQUISITION =========================================================================================

let args = process.argv
const binDir = __dirname

const toolkitDirPath = path.resolve(binDir, '../../assets/')
const platform = guessPlatform()
const arch = guessArch()
const toolkitDownloadName = guessToolkitDownloadName(platform, arch)
const toolkitFileName = guessToolkitFileName(platform, arch)
const toolkitBinPath = guessToolkitBinPath(toolkitDirPath, platform, arch)
const toolkitIsDownloaded = checkToolkitIsDownloaded(toolkitBinPath);

function guessPlatform () {
  return os.platform()
}
function guessArch () {
  const rawArch = os.arch()
  return archsMap[rawArch] || rawArch
}
function guessDownloadUrl(toolkitFileName) {
  return `${toolkitDownloadUrlBase}${toolkitFileName}`
}
function guessToolkitDownloadName (platform, arch) {
  return (toolkitDownloadNames[platform] || toolkitDownloadNames['linux'])(arch)
}
function guessToolkitFileName (platform, arch) {
  return (toolkitFileNames[platform] || toolkitFileNames['linux'])(arch)
}
function guessToolkitBinPath (toolkitDirPath, platform, arch) {
  const fileName = guessToolkitFileName(platform, arch)

  return path.resolve(toolkitDirPath, fileName)
}
function checkToolkitIsDownloaded (toolkitBinPath) {
  return fs.existsSync(toolkitBinPath)
}


/// HELPER FUNCTIONS ================================================================================================

async function prompt (question) {
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

async function downloadToolkit (toolkitDownloadName, toolkitFileName, toolkitBinPath, platform, arch) {
  const downloadUrl = guessDownloadUrl(toolkitDownloadName)
  console.info('Downloading', downloadUrl, 'into', toolkitBinPath)

  const file = fs.createWriteStream(toolkitBinPath)
  const req = axios({
    method: "get",
    url: downloadUrl,
    responseType: "stream"
  }).then(function (response) {
    response.data.pipe(file)
  });
        
  return new Promise((resolve, reject) => {
    file.on('finish', () => {
      file.close(() => {
        if (file.bytesWritten > 1000000) {
          fs.chmodSync(toolkitBinPath, 0o755)
          resolve()
        } else {
          reject(`No suitable witnet_toolkit binary found. Maybe your OS (${platform}) or architecture \
(${arch}) are not yet supported. Feel free to complain about it in the Witnet community on Discord: \
https://discord.gg/2rTFYXHmPm `)
        }
      })
    })
    const errorHandler = (err) => {
      fs.unlink(downloadUrl, () => {
        reject(err)
      })
    }
    file.on('error', errorHandler)
  })
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

function decodeUint8Arrays(_obj, key, value) {
  return ['body', 'script', ].includes(key) ? JSON.stringify(value) : value
}


/// COMMAND HANDLERS ================================================================================================

async function installCommand (settings) {
  if (!settings.checks.toolkitIsDownloaded) {
    // Skip confirmation if install is forced
    if (!settings.force) {
      console.info(`The witnet_toolkit ${version} native binary hasn't been downloaded yet (this is a requirement).`)
      const will = await prompt("Do you want to download it now? (Y/n)")

      // Abort if not confirmed
      if (!['', 'y'].includes(will.toLowerCase())) {
        console.error('Aborted download of witnet_toolkit native binary.')
        return
      }
    }

    return forcedInstallCommand(settings)
  }
}

async function forcedInstallCommand (settings) {
  return downloadToolkit(
    settings.paths.toolkitDownloadName,
    settings.paths.toolkitFileName,
    settings.paths.toolkitBinPath,
    settings.system.platform,
    settings.system.arch
  )
    .catch((err) => {
      console.error(`Error updating witnet_toolkit binary:`, err)
    })
}


function tasksFromMatchingFiles (args, matcher) {
  return fs.readdirSync(args[2])
    .filter((filename) => filename.match(matcher))
    .map((filename) => [args[0], args[1], path.join(args[2], filename)])
}

function tasksFromArgs (args) {
  // Ensure that no task contains arguments starting with `0x`
  return args.map(arg => arg.replace(/^0x/gm, ''))
}

var cyan = (str) => `\x1b[36m${str}\x1b[0m`
var gray = (str) => `\x1b[90m${str}\x1b[0m`
var green = (str) => `\x1b[32m${str}\x1b[0m`
var lcyan = (str) => `\x1b[1;96m${str}\x1b[0m`
var lgreen = (str) => `\x1b[1;92m${str}\x1b[0m`
var lyellow = (str) => `\x1b[1;93m${str}\x1b[0m`
var lred = (str) => `\x1b[91m${str}\x1b[0m`
var mcyan = (str) => `\x1b[96m${str}\x1b[0m`
var red = (str) => `\x1b[31m${str}\x1b[0m`
var white = (str) => `\x1b[1;98m${str}\x1b[0m`
var yellow = (str) => `\x1b[33m${str}\x1b[0m`

var commas = (number) => number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
var extractTypeName = (str) => str ? str.split(/(?=[A-Z])/).slice(1).join("") : "Any"

async function reportHeadline(request, headline) {
  const trait = (str) => `${str}${" ".repeat(56 - str.length)}`
  const indent = settings?.indent ? " ".repeat(indent) : ""
  const resultDataType = `Result<${extractTypeName(request.retrieve[0]?.script?.constructor.name)}, RadonError>`
  console.info(`${indent}╔══════════════════════════════════════════════════════════════════════════════╗`)
  console.info(`${indent}║ ${white(headline)}${" ".repeat(77 - headline.length)}║`)
  console.info(`${indent}╠══════════════════════════════════════════════════════════════════════════════╣`)
  console.info(`${indent}║ ${white("RAD hash")}: ${lgreen(request.radHash())}   ║`)
  console.info(`${indent}║ > Bytes weight:     ${white(trait(commas(request.weight())))} ║`)
  console.info(`${indent}║ > Data sources:     ${white(trait(commas(request.retrieve.length)))} ║`)
  console.info(`${indent}║ > Radon operators:  ${white(trait(commas(request.opsCount())))} ║`)
  console.info(`${indent}║ > Result data type: ${yellow(trait(resultDataType))} ║`)
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

async function decodeRadonRequestCommand (settings, args) {
  const indent = settings?.indent ? " ".repeat(indent) : ""
  const tasks = tasksFromArgs(args)
  const promises = Promise.all(tasks.map(async (bytecode) => {
    const request = toolkit.Utils.decodeRequest(bytecode)
    if (settings?.json) {
      console.info(JSON.stringify(settings?.verbose ? request.toJSON() : request.toProtobuf(), null, settings?.verbose && settings?.indent || 0))

    } else {      
      reportHeadline(request, "WITNET DATA REQUEST DISASSEMBLE")
      const trait = (str) => `${str}${" ".repeat(54 - str.length)}`
      // console.info(`${indent}╠════════════════════════════════════════════════════════════════════════════╣`)
      // console.info(`${indent}║ > Times solved:     ${white(trait("{ values:  123, errors:  220 }"))} ║`)
      // console.info(`${indent}║ > Times witnessed:  ${white(trait("{ values: 2130, errors: 1326 }"))} ║`)
      // console.info(`${indent}║ > Total fees:       ${white(trait("15,234.123 Wits"))} ║`)
      // console.info(`${indent}║ > Total slashed:    ${white(trait("    56.123 Wits"))} ║`)
      // console.info(`${indent}║ > Total burnt:      ${white(trait("     0.789 Wits"))} ║`)
      if (!settings.verbose) {
        console.info(`${indent}╚══════════════════════════════════════════════════════════════════════════════╝`)
      
      } else {  
        console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)
        console.info(`${indent}┌──┴─────────────────┐`)
        console.info(`${indent}│  ${white("RETRIEVE DATA")}     │`) // ├ ┤
        console.info(`${indent}└──┬─┬───────────────┘`) 
        request.retrieve.forEach((source, sourceIndex) => {
          // var subdomains = source.authority.toUpperCase().split(".")
          // var authority = subdomains.length > 2 ? subdomains.slice(1).join(".") : subdomains.join(".")
          var authority = source.authority?.toUpperCase() || (source.method === toolkit.RadonRetrievals.Methods.RNG ? "WIT/RNG" : "")
          var corner = sourceIndex === request.retrieve.length - 1 ? "└" : "├"
          var sep = sourceIndex === request.retrieve.length - 1 ? " " : "│"
          console.info(`${indent}   │ ${corner}─ ${lgreen("[ ")}${`Data Source #${sourceIndex + 1}`}: ${" ".repeat(3 - sourceIndex.toString().length)}${lcyan(authority)} ${lgreen("]")}`)
          if (source.method !== toolkit.RadonRetrievals.Methods.RNG) {
            console.info(`${indent}   │ ${sep}    > Method:         ${lgreen(toolkit.RadonRetrievals.Methods[source.method])}`)
            if (source?.schema)  console.info(`${indent}   │ ${sep}    > URL schema:     ${green(source.schema)}`)
            if (source?.query)   console.info(`${indent}   │ ${sep}    > URL query:      ${green(source.query)}`)
            if (source?.headers) console.info(`${indent}   │ ${sep}    > HTTP headers:   ${green(JSON.stringify(source.headers))}`)
            if (source?.body)    console.info(`${indent}   │ ${sep}    > HTTP body:      ${green(source.body)}`)
            // if (source?.script)  console.info(`${indent}   │ ${sep}    > Input data:     ${lyellow("[ ")}${yellow(source.script.constructor.name)}${lyellow(" ]")}`)
            if (source?.script)  console.info(`${indent}   │ ${sep}    > Radon script:   ${lcyan(source.script.toString())}`)
            if (source?.script)  console.info(`${indent}   │ ${sep}    > Output data:    ${lyellow("[ ")}${yellow(source.script.constructor.name)}${lyellow(" ]")}`)
          }
          if (sourceIndex < request.retrieve.length - 1) {
            console.info(`${indent}   │ │`)
          }
        })
        var stringifyFilter = (x) => `${mcyan(toolkit.RadonFilters.Opcodes[x.opcode])}(${x.args ? cyan(JSON.stringify(x.args)) : ""})`
        var stringifyReducer = (x) => mcyan(`${toolkit.RadonReducers.Opcodes[x.opcode]}()`)
        // console.info(`   │`)
        console.info(`${indent}┌──┴──────────────────┐`)
        console.info(`${indent}│  ${white("AGGREGATE SOURCES")}  │`)
        console.info(`${indent}└──┬──────────────────┘`) // ┬
        request.aggregate?.filters.forEach(filter => 
        console.info(`${indent}   │      > Radon filter:   ${stringifyFilter(filter)}`))
        console.info(`${indent}   │      > Radon reducer:  ${stringifyReducer(request.aggregate)}`)
        // console.info(`   │`)
        console.info(`${indent}┌──┴──────────────────┐`)
        console.info(`${indent}│  ${white("WITNESSING TALLY")}   │`)
        console.info(`${indent}└─────────────────────┘`) // ┬
        request.tally?.filters.forEach(filter => 
        console.info(`${indent}          > Radon filter:   ${stringifyFilter(filter)}`))
        console.info(`${indent}          > Radon reducer:  ${stringifyReducer(request.tally)}`)
      }
    }
  }))
  return (await promises).join()
}

async function dryrunRadonRequestCommand (settings, args) {
  const indent = settings?.indent ? " ".repeat(indent) : ""
  const tasks = tasksFromArgs(args)
  const promises = Promise.all(tasks.map(async (bytecode) => {
    const report = JSON.parse(
      await toolkitRun(settings, ['try-data-request', '--hex', bytecode])
        .catch((err) => {
          let errorMessage = err.message.split('\n').slice(1).join('\n').trim()
          const errorRegex = /.*^error: (?<message>.*)$.*/gm
          const matched = errorRegex.exec(err.message)
          if (matched) {
            errorMessage = matched.groups.message
          }
          console.error(errorMessage || err)
          return
        })
      )
    const result = report?.tally.result
    const resultType = Object.keys(result)[0]
    const resultValue = JSON.stringify(Object.values(result)[0])
    if (settings?.json) {
      if (settings?.verbose) {
        console.info(JSON.stringify(report, null, settings?.indent))
      } else {
        result[resultType] = resultValue
        console.info(JSON.stringify(result, null, settings?.indent))
      }
    } else {
      const request = toolkit.Utils.decodeRequest(bytecode)
      reportHeadline(request, "WITNET DATA REQUEST DRY RUN REPORT", true)
      console.info(`${indent}╚══╤═══════════════════════════════════════════════════════════════════════════╝`)        
      var execTimeMs = report.retrieve?.map(retrieval => 
        (retrieval?.running_time.secs || 0) + (retrieval?.running_time.nanos || 0) / 1000 
      ).reduce(
        (sum, secs) => sum + secs
      )
      var execTimeMs = execTimeMs + " ms"
      var flexbar = "─".repeat(execTimeMs.length); 
      var flexspc = " ".repeat(flexbar.length + 12)
      console.info(`${indent}┌──┴─────────────────────────────${flexbar}──────┐`)
      console.info(`${indent}│ ${white("Data providers")}     ${flexspc}      │`) // ├ ┤
      console.info(`${indent}├────────────────────────────────${flexbar}──────┤`)
      console.info(`${indent}│ Execution time: ${green(execTimeMs)} ${flexspc} │`)
      console.info(`${indent}└──┬─┬───────────────────────────${flexbar}──────┘`)
      request.retrieve.forEach((source, sourceIndex) => {
        var authority = source.authority?.toUpperCase() || (source.method === toolkit.RadonRetrievals.Methods.RNG ? "WIT/RNG" : "")
        var corner = sourceIndex === request.retrieve.length - 1 ? "└" : "├"
        var sep = sourceIndex === request.retrieve.length - 1 ? " " : "│"
        console.info(`${indent}   │ ${corner}─ [ ${lcyan(authority)} ]`)
        if (source.method !== toolkit.RadonRetrievals.Methods.RNG) {
          const result = report.retrieve[sourceIndex].result
          const resultType = Object.keys(result)[0]
          const resultValue = JSON.stringify(Object.values(result)[0])
          // console.info(`${indent}   │ ${sep}    > Method:         ${lgreen(toolkit.RadonRetrievals.Methods[source.method])}`)
          // if (source?.schema)  console.info(`${indent}   │ ${sep}    > URL schema:     ${green(source.schema)}`)
          // if (source?.query)   console.info(`${indent}   │ ${sep}    > URL query:      ${green(source.query)}`)
          // if (source?.headers) console.info(`${indent}   │ ${sep}    > HTTP headers:   ${green(JSON.stringify(source.headers))}`)
          // if (source?.body)    console.info(`${indent}   │ ${sep}    > HTTP body:      ${green(source.body)}`)
          // if (source?.script)  console.info(`${indent}   │ ${sep}    > Input data:     ${lyellow("[ ")}${yellow(source.script.constructor.name)}${lyellow(" ]")}`)
          // if (source?.script)  console.info(`${indent}   │ ${sep}    > Radon script:   ${lcyan(source.script.toString())}`)
          // if (source?.script)  console.info(`${indent}   │ ${sep}    > Output data:    ${lyellow("[ ")}${yellow(source.script.constructor.name)}${lyellow(" ]")}`)
          // console.info(`${indent}   │ ${sep}  ${yellow("[ ")}${yellow(resultType)}${yellow(" ]")} ${green(resultValue)}`)
        }
        if (settings?.verbose && sourceIndex < request.retrieve.length - 1) {
          console.info(`${indent}   │ │`)
        }
      })
      var flexbar = "─".repeat(16); 
      var flexspc = " ".repeat(28); 
      var extraWidth = 0
      if (['RadonMap', 'RadonArray', 'RadonError', 'RadonBytes', ].includes(resultType)) {
        extraWidth = 31
        flexbar += "─".repeat(extraWidth)
        flexspc += " ".repeat(extraWidth)
      }
      console.info(`${indent}┌──┴───────────────────────────${flexbar}─┐`)
      console.info(`${indent}│ ${white("Aggregated result")}${flexspc} │`) // ├ ┤
      console.info(`${indent}├──────────────────────────────${flexbar}─┤`)
      var printMapItem = (indent, width, key, value, indent2 = "") => {
        // console.log(indent, width, key, value)
        var key = `${indent2}"${key}": `
        var type = extractTypeName(Object.keys(value)[0])
        var value = Object.values(value)[0]
        if (["Map", ].includes(type)) {
          if (key.length > width - 12) {
            console.info(`${indent}│ ${yellow("[ Map     ]")} ${" ".repeat(width - 15)}${green("...")}│`)   
          } else {
            console.info(`${indent}│ ${yellow("[ Map     ]")} ${green(key)}${" ".repeat(width - 12 - key.length)}│`)
          }
          Object.entries(value).forEach(([ key, value ]) => printMapItem(indent, width, key, value, indent2 + " "))
        } else {
          
          if (key.length > width - 12) {
            console.info(`${indent}│ ${yellow(type)} ${" ".repeat(width - 15)}${green("...")}│`)  
          } else {
            if (["String", "Array", "Error", "Map"].includes(type)) {
              value = JSON.stringify(value)
            }
            type = `[ ${type}${" ".repeat(7 - type.length)} ]`
            var result = key + value 
            var spaces = width - 12 - result.length
            if (result.length > width - 15) {
              value = value.slice(0, width - 15 - key.length) + "..."
              spaces = 0
            }
            console.info(`${indent}│ ${yellow(type)} ${green(key)}${lgreen(value)}${" ".repeat(spaces)}│`)
          }
        }
      }
      var printResult = (indent, width, resultType, resultValue) => {
        resultType = extractTypeName(resultType)
        // TODO: handle result arrays
        if (resultType === "Map") {
          console.info(`${indent}│ ${lyellow("[ Map     ]")}${" ".repeat(width - 11)}│`)
          var obj = JSON.parse(resultValue)
          Object.entries(obj).forEach(([ key, value ]) => printMapItem(indent, width, key, value))
        } else {
          if (resultType === "Bytes") {
            resultValue = JSON.parse(resultValue).map(char => ('00' + char.toString(16)).slice(-2)).join("")
          }
          var resultMaxWidth = width - resultType.length - 5
          if (resultValue.length > resultMaxWidth - 3) resultValue = resultValue.slice(0, resultMaxWidth - 3) + "..."
          var spaces = width - resultType.length - resultValue.toString().length - 5 
          var color = resultType.indexOf("Error") > -1 ? gray : lgreen
          var typeText = resultType.indexOf("Error") > -1 ? `\x1b[1;98;41m  Error  \x1b[0m` : lyellow(`[ ${resultType} ]`)
          console.info(`${indent}│ ${typeText} ${color(resultValue)}${" ".repeat(spaces)}│`)
        }
      }
      printResult(indent, 46 + extraWidth, resultType, resultValue)
      console.info(`${indent}└──────────────────────────────${flexbar}─┘`)
      // TODO: Simulate witnesses from multiple regions
    }
  }))
  return (await promises).join()
}

async function versionCommand (settings) {
  return fallbackBinaryCommand(settings, ['--version'])
}

async function fallbackBinaryCommand (settings, args) {
  const toolkitOutput = await toolkitRun(settings, args.slice(1))
    .catch((err) => {
      let errorMessage = err.message.split('\n').slice(1).join('\n').trim()
      const errorRegex = /.*^error: (?<message>.*)$.*/gm
      const matched = errorRegex.exec(err.message)
      if (matched) {
        errorMessage = matched.groups.message
      }
      console.error(errorMessage || err)
    })
  console.info(toolkitOutput)
}


/// PROCESS SETTINGS ===============================================================================================

let force;
let forceIndex = args.indexOf('--force');
if (forceIndex >= 2) {
  // If the `--force` flag is found, process it, but remove it from args so it doesn't get passed down to the binary
  force = args[forceIndex]
  args.splice(forceIndex, 1)
}

let json = false
if (args.includes('--json')) {
  json = true
  args.splice(args.indexOf('--json'), 1)
}

let indent;  
let indentIndex = args.indexOf('--indent')
if (indentIndex >= 2) {
  if (args[indentIndex + 1] && !args[indentIndex + 1].startsWith('--')) {
    indent = parseInt(args[indentIndex + 1])
    args.splice(indentIndex, 2)
  } else {
    args.splice(indentIndex)
  }
}

let verbose = false
if (args.includes('--verbose')) {
  verbose = true
  args.splice(args.indexOf('--verbose'), 1)
}

const settings = {
  paths: {
    toolkitBinPath,
    toolkitDirPath,
    toolkitDownloadName,
    toolkitFileName,
  },
  checks: {
    toolkitIsDownloaded,
  },
  system: {
    platform,
    arch,
  },
  force, json, indent, verbose
}


/// MAIN LOGIC ======================================================================================================

const mainRouter = {
  '--': fallbackBinaryCommand,
  'decodeRadonRequest': decodeRadonRequestCommand,
  'dryrunRadonRequest': dryrunRadonRequestCommand,
  'install': forcedInstallCommand,
  'network': networkFallbackCommand,
  'update': forcedInstallCommand,
  'version': versionCommand,
}

const networkRouter = {}

async function networkFallbackCommand (args) {
  const networkCommand = networkRouter[args[0]];
  if (networkCommand) {
    await networkCommand(settings, args.slice(1))
  } else {
    console.info("\nUSAGE:")
    console.info(`    ${white("npx witnet network")} <COMMAND> [<params> ...]`)
    console.info("\nFLAGS:")
    console.info("    --json             Output data in JSON format")
    console.info("    --indent <:nb>     Number of white spaces used to prefix every output line")
    console.info("    --verbose          Report network detailed information")
    console.info("\nNETWORK FLAGS:")
    console.info("    --epoch <:nb>      Extract data from or at specified epoch")
    console.info("    --limit <:nb>      Limit number of entries to fetch")
    console.info("    --timeout <:secs>  Limit seconds to wait for a result")
    // console.info("    --help             Explain commands requiring input params")
    console.info("\nNETWORK COMMANDS:")
    console.info(`    address            Public Witnet address corresponding to your ${yellow("WITNET_TOOLKIT_PRIVATE_KEY")}.`)
    console.info("    blocks             Lately consolidated blocks in the Witnet blockhain.")
    console.info("    fees               Lately consolidated transaction fees in the Witnet blockchain.")
    console.info("    peers              Search public P2P nodes in the Witnet network.")
    console.info("    protocol           Lorem ipsum.")
    console.info("    providers          Search public RPC providers in the Witnet network.")
    console.info("    reporter           Show Witnet network reporter's URL.")
    console.info("    stakes             Current staking entries in the Witnet network, ordered by power.")
    console.info("    supply             Current status of the Witnet network.")
    console.info("    wips               Lorem ipsum.")
    console.info()
    console.info("    getBalance         <pkhAddress> Get balance of the specified Witnet address.")
    console.info("    getUtxoInfo        <pkhAddress> Get unspent transaction outputs of the specified Witnet address.")
    console.info()
    console.info("    getBlock           <blockHash>  Get details for the specified Witnet block.")
    console.info("    getDataRequest     <d|drTxHash> Get current status or result of some unique data request transaction.")
    console.info("    getTransaction     <txHash>     Get details for specified Witnet transaction")
    console.info()
    console.info("    decodeRadonRequest <radHash>    Disassemble the Radon request given its network RAD hash.")
    console.info("    dryrunRadonRequest <radHash>    Resolve the Radon request identified by the given network RAD hash, locally.")
    console.info("    searchDataRequests <radHash>    Search data request transactions containing the given network RAD hash.")
    console.info()
    console.info("    sendDataRequest    <radHash>   --unitary-fee <:nanoWits> --num-witnesses <:number>")
    console.info("    sendValue          <:nanoWits> --fee <:nanoWits> --to <:pkhAddress>")
  }
}

async function main () {
  // Run installCommand before anything else, mainly to ensure that the witnet_toolkit binary
  // has been downloaded, unless we're intentionally installing or updating the binary.
  if (!args.includes('install') && !args.includes('update')) {
    await installCommand(settings)
  }
  const command = mainRouter[args[2]]; 
  if (command) {
    await command(settings, args.slice(3))
  } else {
    console.info("\nUSAGE:")
    console.info(`    ${white("npx witnet")} <COMMAND> [<params> ...]`)
    console.info("\nFLAGS:")
    console.info("    --json          Output data in JSON format")
    console.info("    --indent <:nb>  Number of white spaces used to prefix every output line")
    console.info("    --verbose       Report step-by-step detailed information")
    console.info("\nCOMMANDS:")
    console.info("    decodeRadonRequest <drBytecode>  Disassemble hexified bytecode into a Radon request.")
    console.info("    dryrunRadonRequest <drBytecode>  Resolve a Radon request given its hexified bytecode, locally.")
    console.info()      
    console.info("    network         Network commands suite for reading or interacting with the Witnet blockchain.")
    console.info("    version         Show version of the installed witnet_toolkit binary.")
  }
}

main()
