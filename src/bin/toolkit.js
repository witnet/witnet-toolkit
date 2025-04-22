#!/usr/bin/env node

/// IMPORTS ===========================================================================================================

const axios = require("axios")
require('dotenv').config() 
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
    colors, 
    deleteExtraFlags, extractFromArgs, 
    showUsage, showUsageError, showUsageSubcommand, showVersion,
    toolkitRun, 
} = require("./helpers")

  
/// CONSTANTS =======================================================================================================  
  
const version = '2.0.8'
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

const toolkitDirPath = path.resolve(binDir, '../../witnet/')
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


/// COMMAND HANDLERS ================================================================================================

async function installCommand (settings) {
  if (!settings.checks.toolkitIsDownloaded) {
    // Skip confirmation if install is forced
    if (!settings.force) {
      console.info(`The witnet_toolkit ${version} native binary hasn't been downloaded yet (this is a requirement).`)
      const will = await helpers.prompt("Do you want to download it now? (Y/n)")

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
  if (!fs.existsSync('.env_witnet')) {
   fs.cpSync("node_modules/witnet-toolkit/.env_witnet", ".env_witnet") 
  }
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
  if (toolkitOutput) console.info(toolkitOutput)
}


/// PROCESS SETTINGS ===============================================================================================

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
}

if (args.includes('--debug')) {
  settings.debug = true
  args.splice(args.indexOf('--debug'), 1)
}

let forceIndex = args.indexOf('--force');
if (forceIndex >= 2) {
  // If the `--force` flag is found, process it, but remove it from args so it doesn't get passed down to the binary
  settings.force = args[forceIndex]
  args.splice(forceIndex, 1)
}

if (args.includes('--help')) {
  settings.help = true
  args.splice(args.indexOf('--help'), 1)
}

if (args.includes('--version')) {
  settings.showVersion = true
  args.splice(args.indexOf('--version'), 1)
}

if (args.includes('--update')) {
  settings.update = true
  args.splice(args.indexOf('--update'), 1)
}


/// MAIN LOGIC ======================================================================================================

const mainRouter = {
  '--': fallbackBinaryCommand,
  'update':  forcedInstallCommand,
  'install': installCommand,
  'version': versionCommand,
}

async function main () {
  if (settings.showVersion) {
    showVersion()
  }
  // Run installCommand before anything else, mainly to ensure that the witnet_toolkit binary
  // has been downloaded, unless we're intentionally installing or updating the binary.
  if (settings.update) {
    await forcedInstallCommand(settings)
  }
  args = process.argv
  const command = mainRouter[args[2]]; 
  if (command) {
    await command(settings, args.slice(3))
    process.exit(0)

  } else if (args[2] && !args[2].startsWith(`--`)) try {
    var cmd = args[2]
    const module = require(`./cli/${args[2]}`)
    var [args, flags, ] = extractFromArgs(args.slice(3), module.flags)
    if (settings?.force) flags.force = true
    if (args && args[0] && module.subcommands && module?.router[args[0]]) {
      var subcmd = args[0]
      var options = module.router[subcmd]?.options
      if (settings?.help) {
        showUsageSubcommand(cmd, subcmd, module)
      
      } else {
        var [args, options, ] = extractFromArgs(args.slice(1), options)
        args = deleteExtraFlags(args)
        await module.subcommands[subcmd](flags, args, options, settings).catch(err => {
            showUsageError(cmd, subcmd, module, settings, err)
        });
      }
    } else {
      showUsage(cmd, module)
    }
    process.exit(0)
  
  } catch (e) {
    console.error(`EXCEPTION:\n${e}\n`)
  }
  console.info("USAGE:")
  console.info(`    ${colors.white("npx witnet")} [FLAGS] <COMMAND>`)
  console.info("\nFLAGS:")
  console.info("    --debug     Outputs stack trace in case of error.")
  console.info("    --force     Avoids asking the user to confirm operation.")
  console.info("    --help      Describes command or subcommand usage.")
  console.info("    --update    Forces update of underlying binaries.")
  console.info("    --version   Prints toolkit name and version as first line.")
  console.info("\nCOMMANDS:")
  console.info("    inspect     Inspect public data from the Wit/Oracle blockchain.")
  console.info("    network     Dynamic information from the Wit/Oracle P2P network.")
  console.info("    nodes       Interact with your private Wit/Oracle nodes, if reachable.")
  console.info("    radon       Manage Radon requests and templates within your project.")
  console.info("    wallet      Simple CLI wallet for spending and staking your Wits.")
}

main()
