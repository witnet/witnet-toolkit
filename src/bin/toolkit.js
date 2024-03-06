#!/usr/bin/env node

/// IMPORTS ===========================================================================================================

const axios = require("axios")
const cbor = require('cbor')
const fs = require('fs')
const os = require('os')
const path = require('path')
const readline = require('readline')
const { exec } = require("child_process")

Promise.all([
  import('witnet-radon-js'),
])
.then(([{ default: witnet_radon_js_1 }, ]) => {
  
  const { Radon } = witnet_radon_js_1;

  /// CONSTANTS =======================================================================================================  
  
  const version = '1.6.7'
  const toolkitDownloadUrlBase = `https://github.com/witnet/witnet-rust/releases/download/${version}/`
  const toolkitDownloadNames = {
    win32: (arch) => `witnet_toolkit-${arch}-pc-windows-msvc.exe`,
    linux: (arch) => `witnet_toolkit-${arch}-unknown-linux-gnu${arch.includes("arm") ? "eabihf" : ""}`,
    darwin: (arch) => `witnet_toolkit-${arch}-apple-darwin`,
  }
  const toolkitFileNames = {
    win32: (arch) => `witnet_toolkit-${version}-${arch}-pc-windows-msvc.exe`,
    linux: (arch) => `witnet_toolkit-${version}-${arch}-unknown-linux-gnu${arch.includes("arm") ? "eabihf" : ""}`,
    darwin: (arch) => `witnet_toolkit-${version}-${arch}-apple-darwin`,
  }
  const archsMap = {
    arm64: 'x86_64',
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
    console.log('Downloading', downloadUrl, 'into', toolkitBinPath)

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
    if (settings.verbose) {
      console.log('Running >', cmd)
    }

    return new Promise((resolve, reject) => {
      exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          reject(error)
        }
        if (stderr) {
          if (settings.verbose) {
            console.log('STDERR <', stderr)
          }
          reject(stderr)
        }
        if (settings.verbose) {
          console.log('STDOUT <', stdout)
        }
        resolve(stdout)
      })
    })
  }

  function formatRadonValue (call) {
    const radonType = Object.keys(call)[0]
    let value = JSON.stringify(call[radonType])

    if (radonType === 'RadonInteger') {
      value = parseInt(value.replace('\"', ''))
    } else if (radonType === 'RadonBytes') {
      value = JSON.parse(value).map(i => i.toString(16)).join("")
    } else if (radonType === 'RadonError') {
      value = red(
        value
          .replace(/.*Inner\:\s`Some\((?<inner>.*)\)`.*/g, '$<inner>')
          .replace(/UnsupportedReducerInAT\s\{\soperator\:\s0\s\}/g, 'MissingReducer')
      )
    }

    return [radonType.replace('Radon', ''), value]
  }

  function blue (string) {
    return `\x1b[34m${string}\x1b[0m`
  }

  function green (string) {
    return `\x1b[32m${string}\x1b[0m`
  }

  function red (string) {
    return `\x1b[31m${string}\x1b[0m`
  }

  function yellow (string) {
    return `\x1b[33m${string}\x1b[0m`
  }

  
  /// COMMAND HANDLERS ================================================================================================
  
  async function installCommand (settings) {
    if (!settings.checks.toolkitIsDownloaded) {
      // Skip confirmation if install is forced
      if (!settings.force) {
        console.log(`The witnet_toolkit ${version} native binary hasn't been downloaded yet (this is a requirement).`)
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

  function decodeFilters (mir) {
    return mir.map((filter) => {
      if (filter.args.length > 0) {
        const decodedArgs = cbor.decode(Buffer.from(filter.args))
        return {...filter, args: decodedArgs}
      } else {
        return filter
      }
    })
  }

  function decodeScriptsAndArguments (mir) {
    let decoded = mir.data_request
    decoded.retrieve = decoded.retrieve.map((source) => {
      const decodedScript = cbor.decode(Buffer.from(source.script))
      return {...source, script: decodedScript}
    })
    decoded.aggregate.filters = decodeFilters(decoded.aggregate.filters)
    decoded.tally.filters = decodeFilters(decoded.tally.filters)

    return decoded
  }

  function tasksFromMatchingFiles (args, matcher) {
    return fs.readdirSync(args[2])
      .filter((filename) => filename.match(matcher))
      .map((filename) => [args[0], args[1], path.join(args[2], filename)])
  }

  async function tasksFromArgs (args) {
    // Ensure that no task contains arguments starting with `0x`
    return [args.map(arg => arg.replace(/^0x/gm, ''))]
  }

  async function decodeQueryCommand (settings, args) {
    const tasks = await tasksFromArgs(args)
    const promises = Promise.all(tasks.map(async (task) => {
      return fallbackCommand(settings, ['decode-query', ...task.slice(1)])
        .then(JSON.parse)
        .then(decodeScriptsAndArguments)
        .then((decoded) => JSON.stringify(decoded, null, 4))
    }))

    return (await promises).join()
  }

  async function traceQueryCommand (settings, args) {
    let query, radon
    const tasks = await tasksFromArgs(args)

    return Promise.all(tasks.map(async (task) => {
      const queryJson = await fallbackCommand(settings, ['decode-query', ...task.slice(1)])
      const mir = JSON.parse(queryJson)
      query = decodeScriptsAndArguments(mir)
      radon = new Radon(query)
      const output = await fallbackCommand(settings, ['try-query', ...task.slice(1)])
      let report;
      try {
        report = JSON.parse(output)
      } catch {
        return
      }
      const dataSourcesCount = report.retrieve.length

      const dataSourcesInterpolation = report.retrieve.map((source, sourceIndex, sources) => {
        let executionTime
        try {
          executionTime =
            (source.context.completion_time.nanos_since_epoch - source.context.start_time.nanos_since_epoch) / 1000000
        } catch (_) {
          executionTime = 0
        }

        const cornerChar = sourceIndex < sources.length - 1 ? '├' : '└'
        const sideChar = sourceIndex < sources.length - 1 ? '│' : ' '

        let traceInterpolation
        try {
          if ((source.partial_results || []).length === 0) {
            source.partial_results = [source.result]
          }
          traceInterpolation = source.partial_results.map((radonValue, callIndex) => {
            const formattedRadonValue = formatRadonValue(radonValue)

            const operator = radon
              ? (callIndex === 0
              ? blue(radon.retrieve[sourceIndex].kind)
              : `.${blue(radon.retrieve[sourceIndex].script.operators[callIndex - 1].operatorInfo.name + '(')}${radon.retrieve[sourceIndex].script.operators[callIndex - 1].mirArguments.join(', ') + blue(')')}`) + ' ->'
              : ''

            return ` │   ${sideChar}    [${callIndex}] ${operator} ${yellow(formattedRadonValue[0])}: ${formattedRadonValue[1]}`
          }).join('\n')
        } catch (e) {
          traceInterpolation = ` │   ${sideChar}  ${red('[ERROR] Cannot decode execution trace information')}`
        }

        let urlInterpolation = query ? `
 │   ${sideChar}  Method: ${radon.retrieve[sourceIndex].kind}
 │   ${sideChar}  Complete URL: ${radon.retrieve[sourceIndex].url}` : ''

        // // TODO: take headers info from `radon` instead of `query` once POST is supported in `witnet-radon-js`
        const headers = radon.retrieve[sourceIndex].headers;//query.retrieve[sourceIndex].headers
        if (headers) {
          const headersInterpolation = headers.map(([key, value]) => `
 │   ${sideChar}    "${key}": "${value}"`).join()
          urlInterpolation += `
 │   ${sideChar}  Headers: ${headersInterpolation}`
        }

        // // TODO: take body info from `radon` instead of `query` once POST is supported in `witnet-radon-js`
        const body = radon.retrieve[sourceIndex].body;//query.retrieve[sourceIndex].body
        if (body) {
          urlInterpolation += `
 │   ${sideChar}  Body: ${Buffer.from(body)}`
        }

        const formattedRadonResult = formatRadonValue(source.result)
        const resultInterpolation = `${yellow(formattedRadonResult[0])}: ${formattedRadonResult[1]}`
        return `
 │   ${cornerChar}─${green('[')} Source #${sourceIndex} ${ query?.retrieve[sourceIndex]?.url ? `(${new URL(query.retrieve[sourceIndex].url).hostname})` : ''} ${green(']')}${urlInterpolation}
 │   ${sideChar}  Number of executed operators: ${source.context.call_index + 1 || 0}
 │   ${sideChar}  Execution time: ${executionTime > 0 ? executionTime + ' ms' : 'unknown'}
 │   ${sideChar}  Execution trace:\n${traceInterpolation}
 │   ${sideChar}  Execution result: ${resultInterpolation}`
      }).join('\n │   │\n')

      let aggregationExecuted, aggregationExecutionTime, aggregationResult, tallyExecuted, tallyExecutionTime, tallyResult

      try {
        aggregationExecuted = report.aggregate.context.completion_time !== null
        aggregationExecutionTime = aggregationExecuted &&
          (report.aggregate.context.completion_time.nanos_since_epoch - report.aggregate.context.start_time.nanos_since_epoch) / 1000000
        aggregationResult = formatRadonValue(report.aggregate.result);
      } catch (error) {
        aggregationExecuted = false
      }

      try {
        tallyExecuted = report.tally.context.completion_time !== null
        tallyExecutionTime = tallyExecuted &&
          (report.tally.context.completion_time.nanos_since_epoch - report.tally.context.start_time.nanos_since_epoch) / 1000000
        tallyResult = formatRadonValue(report.tally.result);
      } catch (error) {
        tallyExecuted = false
      }

      let filenameInterpolation = ''
      const retrievalInterpolation = `│
 │  ┌────────────────────────────────────────────────┐
 ├──┤ Retrieve stage                                 │
 │  ├────────────────────────────────────────────────┤
 │  │ Number of retrieved data sources: ${dataSourcesCount}${` `.repeat(13 - dataSourcesCount.toString().length)}│
 │  └┬───────────────────────────────────────────────┘
 │   │${dataSourcesInterpolation}`

      const aggregationExecutionTimeInterpolation = aggregationExecuted ? `
 │  │ Execution time: ${aggregationExecutionTime} ms${` `.repeat(28 - aggregationExecutionTime.toString().length)}│` : ''
      const aggregationInterpolation = `│
 │  ┌────────────────────────────────────────────────┐
 ├──┤ Aggregate stage                                │
 │  ├────────────────────────────────────────────────┤${aggregationExecutionTimeInterpolation}
 │  │ Result is: ${yellow(aggregationResult[0])}: ${aggregationResult[1]}${` `.repeat(Math.max(0, (aggregationResult[0] === 'Error' ? 43 : 34) - aggregationResult[0].toString().length - aggregationResult[1].toString().length))}│
 │  └────────────────────────────────────────────────┘`

      const tallyExecutionTimeInterpolation = tallyExecuted ? `
    │ Execution time: ${tallyExecutionTime} ms${` `.repeat(28 - tallyExecutionTime.toString().length)}│` : ''
      const tallyInterpolation = `│  
 │  ┌────────────────────────────────────────────────┐
 └──┤ Tally stage                                    │
    ├────────────────────────────────────────────────┤${tallyExecutionTimeInterpolation}
    │ Result is: ${yellow(tallyResult[0])}: ${tallyResult[1]}${` `.repeat(Math.max(0, (tallyResult[0] === 'Error' ? 43 : 34) - tallyResult[0].toString().length - tallyResult[1].toString().length))}│
    └────────────────────────────────────────────────┘`

      return `╔═══════════════════════════════════════════════════╗
║ Witnet data request local execution report        ║${filenameInterpolation}
╚╤══════════════════════════════════════════════════╝
 ${retrievalInterpolation}
 ${aggregationInterpolation}
 ${tallyInterpolation}`
    })).then((outputs) => outputs.join('\n'))
  }

  async function fallbackCommand (settings, args) {
    // For compatibility reasons, map query methods to data-request methods
    if (args.length > 0) {
      args = [args[0].replace('-query', '-data-request'), ...args.slice(1)]
      return toolkitRun(settings, args)
        .catch((err) => {
          let errorMessage = err.message.split('\n').slice(1).join('\n').trim()
          const errorRegex = /.*^error: (?<message>.*)$.*/gm
          const matched = errorRegex.exec(err.message)
          if (matched) {
            errorMessage = matched.groups.message
          }
          console.error(errorMessage || err)
        })
    } else {
      console.info("USAGE:")
      console.info("    npx witnet-toolkit <SUBCOMMAND>")
      console.info("\nFLAGS:")
      console.info("    --help            Prints help information")
      console.info("    --verbose         Prints detailed information of the subcommands being run")
      console.info("    --version         Prints version information")
      console.info("\nSUBCOMMANDS:")
      console.info("    decode-query      Decodes some Witnet data query bytecode")
      console.info("    trace-query       Resolves some Witnet data query bytecode locally, printing out step-by-step information")
      console.info("    try-query         Resolves some Witnet data query bytecode locally, returning a detailed JSON report")
      console.info("    update            Updates the witnet-toolkit binary if required")
      console.info()
    }
  }


  /// COMMAND ROUTER ==================================================================================================
  
  const router = {
    'decode-query': decodeQueryCommand,
    'fallback': fallbackCommand,
    'install': forcedInstallCommand,
    'trace-query': traceQueryCommand,
    'update': forcedInstallCommand,
  }

  
  /// PROCESS SETTINGS ===============================================================================================
  
  let force;
  let forceIndex = args.indexOf('--force');
  if (forceIndex >= 2) {
    // If the `--force` flag is found, process it, but remove it from args so it doesn't get passed down to the binary
    force = args[forceIndex]
    args.splice(forceIndex, 1)
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
    verbose: false,
    force,
  }


  /// MAIN LOGIC ======================================================================================================

  async function main () {
    // Enter verbose mode if the --verbose flag is on
    const verboseIndex = args.indexOf("--verbose")
    if (verboseIndex >= 2) {
      settings.verbose = true
      args = [...args.slice(0, verboseIndex), ...args.slice(verboseIndex + 1)]
    }

    // Find the right command using the commands router, or default to the fallback command
    const commandName = args[2]
    let command = router[commandName] || router['fallback']

    // Run command before anything else, mainly to ensure that the witnet_toolkit binary
    // has been downloaded.
    // Skip if we are intentionally installing or updating the toolkit.
    if (!['install', 'update'].includes(commandName)) {
      await installCommand(settings)
    }

    // Make sure that commands with --help are always passed through
    if (args.includes("--help")) {
      command = router['fallback']
    }

    // Run the invoked command, if any
    if (command) {
      const output = await command(settings, args.slice(2))
      if (output) {
        console.log(output.trim())
      }
    }
  }

  main()
})
