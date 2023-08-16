const cbor = require('cbor')
const { execSync } = require("child_process")
require("dotenv").config()
const fs = require("fs")
const readline = require("readline")
const Witnet = require("../index")

module.exports = {
  deployWitnetRequest,
  deployWitnetRequestTemplate,
  dryRunBytecode,
  dryRunBytecodeVerbose,
  extractErc2362CaptionFromKey,
  findKeyInObject,
  findRadonRetrievalSpecs,
  findTemplateArtifact,
  fromAscii,
  getChainFromProcessArgv,
  getRealmNetworkFromArgs,
  getRealmNetworkFromString,
  getRequestMethodString,
  getRequestResultDataTypeString,
  getMaxArgsIndexFromString,
  getWitnetArtifactsFromArgs,
  getWitnetRequestArtifactsFromArgs,
  getWitnetRequestTemplateArtifactsFromArgs,
  isNullAddress,
  padLeft,
  processDryRunJson,
  prompt,
  saveAddresses,
  saveHashes,
  splitSelectionFromProcessArgv,
  stringifyWitnetFilterOperator,
  stringifyWitnetReducerOperator,
  stringifyWitnetReducerFilter,
  stringifyWitnetRequestMethod,  
  traceHeader,
  traceTx,
  web3BuildWitnetRequestFromTemplate,
  web3Encode,
  web3VerifyWitnetRadonReducer,
  web3VerifyWitnetRadonRetrieval,
}

async function deployWitnetRequest(web3, from, registry, factory, request, templateArtifact, key) {
  const templateAddr = await deployWitnetRequestTemplate(web3, from, registry, factory, request)
  if (key) traceHeader(`Building '\x1b[1;37m${key}\x1b[0m'...`)
  console.info("  ", "> Template address: ", templateAddr)
  const args = []
  if (request?.args) {
    console.info("  ", "> Instance parameters:")
    request?.args?.map((subargs, index) => {
      console.info("  ", " ", `Retrieval #${index}: \x1b[1;32m${JSON.stringify(subargs)}\x1b[0m => \x1b[32m${request.specs?.retrieve[index].url} ...\x1b[0m`)
      args[index] = subargs
    })
  } else {
    request.specs.retrieve.map(retrieval => args.push([]))
  }
  return await web3BuildWitnetRequestFromTemplate(web3, from, await templateArtifact.at(templateAddr), args)
}

async function deployWitnetRequestTemplate (web3, from, registry, factory, template, key) {
  const aggregate = await web3VerifyWitnetRadonReducer(from, registry, template.specs.aggregate)
  const tally = await web3VerifyWitnetRadonReducer(from, registry, template.specs.tally)
  const retrievals = []
  const args = []
  for (var j = 0; j < template?.specs.retrieve.length; j ++) {
    retrievals.push(await web3VerifyWitnetRadonRetrieval(from, registry, template.specs.retrieve[j]))
    args.push([])
  }
  if (key) traceHeader(`Building '\x1b[1;37m${key}\x1b[0m'...`)
  let templateAddr = await factory.buildRequestTemplate.call(
    retrievals,
    aggregate,
    tally,
    template?.specs?.maxSize || 0,
    { from }
  )
  if (isNullAddress(templateAddr) || (await web3.eth.getCode(templateAddr)).length <= 3) {
    const tx = await factory.buildRequestTemplate(
      retrievals,
      aggregate,
      tally,
      template?.specs?.maxSize || 0,
      { from }
    )
    traceTx(tx.receipt)
    tx.logs = tx.logs.filter(log => log.event === "WitnetRequestTemplateBuilt")
    templateAddr = tx.logs[0].args.template
  }
  return templateAddr
}


async function dryRunBytecode (bytecode) {
  return (await execSync(`npx witnet-toolkit try-data-request --hex ${bytecode}`)).toString()
}

async function dryRunBytecodeVerbose (bytecode) {
  return (await execSync(`npx witnet-toolkit try-query --hex ${bytecode}`)).toString()
}

function extractErc2362CaptionFromKey (prefix, key) {
  const decimals = key.match(/\d+$/)[0]
  const camels = key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, function (str) { return str.toUpperCase() })
    .split(" ")
  return `${prefix}-${
    camels[camels.length - 2].toUpperCase()
  }/${
    camels[camels.length - 1].replace(/\d$/, "").toUpperCase()
  }-${decimals}`
}

function findKeyInObject(dict, tag) {
  for (const key in dict) {
      if (typeof dict[key] === 'object') {
          if (key === tag) {
              return dict[key]
          } else {
              let found = findKeyInObject(dict[key], tag)
              if (found) return found
          }
      }
  }
}

function findRadonRetrievalSpecs(retrievals, tag, headers) {
  if (!headers) headers = []
  for (const key in retrievals) {
    if (typeof retrievals[key] === 'object') {
      var retrieval = retrievals[key]
      if (key === tag || key === retrieval?.alias) {
        if (retrieval.requestMethod) {
          if (retrieval?.requestMethod !== 2) {
            if (!retrieval?.requestAuthority) {
              retrieval.requestAuthority = headers[headers.length - 1]
              if (!retrieval?.requestPath) {
                retrieval.requestPath = tag
              }
            }
          }
        }
        return retrieval
      } else {
        retrieval = findRadonRetrievalSpecs(retrievals[key], tag, [...headers, key])
        if (retrieval) {
          return retrieval
        }
      }
    }
  }
}

function findTemplateArtifact (templates, artifact) {
  if (typeof templates === "object") {
    for (const key in templates) {
      if (key === artifact) {
        return templates[key]
      }
      if (typeof templates[key] === "object") {
        const template = findTemplateArtifact(templates[key], artifact)
        if (template !== "") return template
      }
    }
  }
  return ""
}

function fromAscii(str) {
  const arr1 = []
  for (let n = 0, l = str.length; n < l; n++) {
    const hex = Number(str.charCodeAt(n)).toString(16)
    arr1.push(hex)
  }
  return "0x" + arr1.join("")
}

function getChainFromProcessArgv() {
  let network = process.env.WITNET_SIDECHAIN
  process.argv.map((argv, index, args) => {
      if (argv === "--chain") {
          network = args[index + 1]
      }
  })
  if (network) {
    network = network.replaceAll(":", ".")
      return getRealmNetworkFromString(network)
  }
}

export function getMaxArgsIndexFromString(str) {
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

function getRealmNetworkFromArgs() {
  let networkString = process.argv.includes("test") ? "test" : "development"
  // If a `--network` argument is provided, use that instead
  const args = process.argv.join("=").split("=")
  const networkIndex = args.indexOf("--network")
  if (networkIndex >= 0) {
    networkString = args[networkIndex + 1]
  }
  return getRealmNetworkFromString(networkString)
}

function getRealmNetworkFromString(network) {
  network = network ? network.toLowerCase() : "development"

  // Try to extract realm/network info from environment
  const envRealm = process.env.WITNET_EVM_REALM
    ? process.env.WITNET_EVM_REALM.toLowerCase()
    : null

  let realm
  if (network.split(".")[1]) {
    realm = network.split(".")[0]
    if (realm === "ethereum") {
      // Realm in "ethereum.*" networks must be set to "default"
      realm = "default"
    }
    if (envRealm && realm !== envRealm) {
      // Check that WITNET_EVM_REALM, if defined, and network's realm actually match
      console.error(
        `\n> Fatal: network "${network}" and WITNET_EVM_REALM value`,
        `("${envRealm.toUpperCase()}") don't match.\n`
      )
      process.exit(1)
    }
  } else {
    realm = envRealm || "default"
    network = `${realm === "default" ? "ethereum" : realm}.${network}`
  }
  if (realm === "default") {
    const subnetwork = network.split(".")[1]
    if (subnetwork === "development" || subnetwork === "test") {
      // In "default" realm, networks "development" and "test" must be returned without a prefix.
      network = subnetwork
    }
  }
  return [realm, network]
}

function getWitnetArtifactsFromArgs() {
  let selection = []
  process.argv.map((argv, index, args) => {
    if (argv === "--artifacts") {
      selection = args[index + 1].split(",")
    }
    return argv
  })
  return selection
}

function getWitnetRequestArtifactsFromArgs() {
  let selection = []
  process.argv.map((argv, index, args) => {
    if (argv === "--requests") {
      selection = args[index + 1].split(",")
    }
    return argv
  })
  return selection
}

function getWitnetRequestTemplateArtifactsFromArgs() {
  let selection = []
  process.argv.map((argv, index, args) => {
    if (argv === "--templates") {
      selection = args[index + 1].split(",")
    }
    return argv
  })
  return selection
}

function getRequestMethodString(method) {
  if (method == 0) {
    return "UNKNOWN"
  } else if (method == 1 || !method) {
    return "HTTP-GET"
  } else if (method == 2) {
    return "RNG"
  } else if (method == 3) {
    return "HTTP-POST"
  } else {
    return method.toString()
  }
}

function getRequestResultDataTypeString(type) {
  if (type == 1) {
    return "Array"
  } else if (type == 2) {
    return "Bool"
  } else if (type == 3) {
    return "Bytes"
  } else if (type == 4) {
    return "Integer"
  } else if (type == 5) {
    return "Float"
  } else if (type == 6) {
    return "Map"
  } else if (type == 7) {
    return "String"
  } else {
    return "(Undetermined)"
  }
}

function isNullAddress(addr) {
  return !addr ||
    addr === "" ||
    addr === "0x0000000000000000000000000000000000000000"
}

function mapObjectRecursively(obj, callback) {
  let newObj = {};
  for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
          if (typeof obj[key] === "object") {
              newObj[key] = mapObjectRecursively(obj[key], callback);
          } else {
              newObj[key] = callback(key, obj[key]);
          }
      }
  }
  return newObj;
}

function padLeft(str, char, size) {
  if (str.length < size) {
    return char.repeat((size - str.length) / char.length) + str
  } else {
    return str
  }
}

function processDryRunJson(dryrun) {
  let error = ""
  let nanos = []
  mapObjectRecursively(dryrun, (key, value) => {
    if (key === "nanos") nanos.push(value || 0);
  })
  const itWorks = !("RadonError" in dryrun?.aggregate?.result)
  if (!itWorks) {
    error = `Aggregatation failed: ${unescape(dryrun?.aggregate?.result?.RadonError)}`
  }
  const nokRetrievals = Object.values(
    dryrun?.retrieve.filter((retrieval, index) => {
      const nok = "RadonError" in retrieval.result
      if (nok && !error) {
        error = `Retrieval #${index + 1}: ${uescape(retrieval.result?.RadonError)}`
      }
      return nok
    })
  ).length;
  const totalRetrievals = Object.values(dryrun?.retrieve).length
  const status = itWorks ? (nokRetrievals > 0 ? "WARN": "OK") : "FAIL"
  return {
    error,
    itWorks: itWorks,
    nokRetrievals,
    totalRetrievals,
    runningTime: `${nanos.reduce((a, b) => a + b) / 1000} ms`,
    status,
    tally: dryrun?.tally.result
  }
}

async function prompt(text) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  let answer
  await new Promise((resolve) => {
    rl.question(
      text,
      function (input) {
        answer = input
        rl.close()
      })
    rl.on("close", function () {
      resolve()
    })
  })
  return answer
}

function saveAddresses(addrs, path) {
  fs.writeFileSync(
    `${path || './migrations/witnet'}/addresses.json`,
    JSON.stringify(addrs, null, 4),
    { flag: 'w+' }
  )
}

function saveHashes(hashes, path) {
  fs.writeFileSync(
    `${path || './migrations/witnet'}/hashes.json`,
    JSON.stringify(hashes, null, 4),
    { flag: 'w+' }
  )
}

function splitSelectionFromProcessArgv(operand) {
  let selection = []
  if (process.argv.includes(operand)) {
      process.argv.map((argv, index, args) => {
          if (argv === operand) {
              if (index < process.argv.length - 1 && !args[index + 1].startsWith("--")) {
                  selection = args[index + 1].replaceAll(":", ".").split(",")
              }
          }
      })
  }
  return selection
}

function stringifyWitnetReducerOperator(opcode) {
  if (opcode === Witnet.Types.REDUCERS.mode) {
      return "Mode"
  } else if (opcode === Witnet.Types.REDUCERS.averageMean) {
      return "MeanAverage"
  } else if (opcode === Witnet.Types.REDUCERS.averageMedian) {
      return "MedianAverage"
  } else if (opcode === Witnet.Types.REDUCERS.deviationStandard) {
      return "StandardDeviation"
  } else if (opcode === Witnet.Types.REDUCERS.concatenateAndHash) {
      return "ConcatHash"
  } else {
      return opcode
  }
}

function stringifyWitnetReducerFilter(filter) {
  return `${stringifyWitnetFilterOperator(filter?.opcode)}${filter?.args ? `( ${cbor.decode(filter.args)} )` : ""}`
}

function stringifyWitnetFilterOperator(opcode) {
  if (opcode === Witnet.Types.FILTERS.mode) {
      return "Mode"
  } else if (opcode === Witnet.Types.FILTERS.deviationStandard) {
      return "StandardDeviation"
  } else {
      return opcode
  }
}

function stringifyWitnetRequestMethod(method) {
  if (method === Witnet.Types.RETRIEVAL_METHODS.HttpGet) {
    return "HTTP/GET"
  } else if (method === Witnet.Types.RETRIEVAL_METHODS.HttpPost) {
    return "HTTP/POST"
  } else if (method === Witnet.Types.RETRIEVAL_METHODS.Rng) {
    return "RNG"
  } else {
    return method
  }

  
}

function traceHeader(header) {
  console.log("")
  console.log("  ", header)
  console.log("  ", `${"-".repeat(header.length)}`)
}

function traceTx (receipt) {
  console.log("  ", "> Transaction block:", receipt.blockNumber)
  console.log("  ", "> Transaction hash: ", receipt.transactionHash)
  console.log("  ", "> Transaction gas:  ", receipt.gasUsed)
}

async function web3BuildWitnetRequestFromTemplate(web3, from, templateContract, args) {
  // convert all args values to string
  args = args.map(subargs => subargs.map(v => v.toString()))
  let requestAddr = await templateContract.buildRequest.call(args, { from })
  if ((await web3.eth.getCode(requestAddr)).length <= 3) {
    const tx = await templateContract.buildRequest(args, { from })
    console.info("  ", "> Template settlement hash:", tx.receipt.transactionHash)
    console.info("  ", "> Template settlement gas: ", tx.receipt.gasUsed)
  }
  return requestAddr
}

export function web3Encode(T) {
  if (T instanceof Witnet.Reducers.Class) {
      return [
          T.opcode,
          T.filters?.map(filter => web3Encode(filter)) || [],
          "0x", // TBD: reduction scripts
      ];
  } else if (T instanceof Witnet.Filters.Class) {
      return [
          T.opcode,
          `0x${T.args ? cbor.encode(T.args).toString("hex"): ""}`
      ];
  } else if (T instanceof Witnet.Retrievals.Class) {
      return [
          T.method,
          T.schema || "",
          T.authority || "",
          T.path || "",
          T.query || "",
          T.body || "",
          T.headers || "",
          web3Encode(T.script) || "0x80"
      ];
  } else if (T instanceof Witnet.Types.Script) {
      return cbor.encode(T._encodeArray())
  }
  return T;
}

async function web3VerifyWitnetRadonReducer(from, registry, reducer) {
  let hash
  if (reducer instanceof Witnet.Reducers.Class) {
    hash = await registry.verifyRadonReducer.call(web3Encode(reducer), { from })
    try {
      await registry.lookupRadonReducer.call(hash, { from })
    } catch {
      // register new reducer, otherwise:
      traceHeader(`Verifying Radon Reducer ...`)
      console.info(`   > Hash:        \x1b[1;35m${hash}\x1b[0m`)
      console.info(`   > Reducer:     \x1b[35m${reducer.toString()}\x1b[0m`)
      const tx = await registry.verifyRadonReducer(web3Encode(reducer), { from })
      traceTx(tx.receipt)
    }
  } else {
    throw `Witnet Radon Reducer: invalid type: '\x1b[1;31m${reducer}\x1b[0m'`
  }
  return hash
}

async function web3VerifyWitnetRadonRetrieval(from, registry, retrieval) {
  // get actual hash for this data source
  var hash
  if (retrieval) {
    try {
      hash = await registry.verifyRadonRetrieval.call(...web3Encode(retrieval), { from })
    } catch (e) {
      throw `Cannot check if Witnet Radon Retrieval is already verified: ${e}`
    }
    // checks whether hash is already registered
    try {
      await registry.lookupRadonRetrieval.call(hash, { from })
    } catch {
      // register new retrieval, otherwise:
      traceHeader(`Verifying Radon Retrieval ...`)
      console.info(`   > Hash:      \x1b[1;32m${hash}\x1b[0m`)
      if (retrieval?.url) {
        console.info(`   > URL:       \x1b[32m${retrieval.url}\x1b[0m`)
      } 
      console.info(`   > Method:    \x1b[32m${getRequestMethodString(retrieval?.method)}\x1b[0m`)
      if (retrieval?.body) {
        console.info(`   > Body:      \x1b[32m${retrieval.body}\x1b[0m`)
      }
      if (retrieval?.headers && retrieval?.headers[0] && retrieval?.headers[0][0] !== "") {
        console.info(`   > Headers:   \x1b[32m${retrieval.headers}\x1b[0m`)
      }
      if (retrieval?.script) {
        console.info(`   > Script:    \x1b[32m${retrieval.script.toString()}\x1b[0m`)
      }
      const tx = await registry.verifyRadonRetrieval(...web3Encode(retrieval), { from })
      traceTx(tx.receipt)
    }
  } else {
    throw `Witnet Radon Retrieval: invalid type: '\x1b[1;31m${retrieval}\x1b[0m'`
  }
  return hash
}
