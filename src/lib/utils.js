const cbor = require("cbor")
const os = require("os")
const crypto = require("crypto")
const { exec } = require("child_process")
const net = require("net")
const helpers = require("./helpers")

var protoBuf = require("protobufjs")
var protoRoot = protoBuf.Root.fromJSON(require("../../witnet/witnet.proto.json"))
var RADRequest = protoRoot.lookupType("RADRequest")

import { RadonRequest } from "./radon/artifacts"
import { RadonRetrieval } from "./radon/retrievals"
import { RadonReducer } from "./radon/reducers"
import { RadonFilter } from "./radon/filters"
import { 
  RadonAny, 
  RadonArray, 
  RadonBoolean, 
  RadonBytes, 
  RadonFloat, 
  RadonInteger, 
  RadonMap, 
  RadonString,
  RadonOperators
} from "./radon/types"

export { 
  fromHexString, isHexString, isHexStringOfLength, toHexString,
  parseURL, ipIsPrivateOrLocalhost,
  toUtf8Array, utf8ArrayToStr,
} from "./helpers"

export function decodeRequest(hexString) {
  const buffer = fromHexString(hexString)
  const obj = RADRequest.decode(buffer)
  const retrieve = obj.retrieve.map(retrieval => {
    const specs = {}
    if (retrieval?.url) { specs.url = retrieval.url }
    if (retrieval?.headers) { 
      specs.headers = retrieval.headers.map(stringPair =>  [
        stringPair.left,
        stringPair.right
      ])
    }
    if (retrieval?.body && retrieval.body.length > 0) { 
      specs.body = utf8ArrayToStr(Object.values(retrieval.body)) 
    }
    if (retrieval?.script) specs.script = decodeScript(toHexString(retrieval.script))
    return new RadonRetrieval(retrieval.kind, specs)
  })
  var decodeFilter = (f) => {
    if (f?.args && f.args.length > 0) return new RadonFilter(f.op, cbor.decode(f.args))
    else return new RadonFilter(f.op);
  }
  return new RadonRequest({
    retrieve,
    aggregate: new RadonReducer(obj.aggregate.reducer, obj.aggregate.filters?.map(decodeFilter)),
    tally: new RadonReducer(obj.tally.reducer, obj.tally.filters?.map(decodeFilter))
  })
}

export function decodeScript(hexString) {
  const buffer = fromHexString(hexString)
  const array = cbor.decode(buffer)
  return parseScript(array)
}

export function encodeRequest(payload) {
  var errMsg = RADRequest.verify(payload)
  if (errMsg) {
    throw Error(errMsg);
  } else {
    var message = RADRequest.fromObject(payload);
    return RADRequest.encode(message).finish()
  }
}

export async function execDryRun(bytecode, ...flags) {
  if (!helpers.isHexString(bytecode)) {
    throw EvalError("Witnet.Utils.execDryRun: invalid bytecode")
  } else {
    const npx = os.type() === "Windows_NT" ? "npx.cmd" : "npx"
    return cmd(npx, "witnet-toolkit", "dryrunRadonRequest", bytecode, ...flags)
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

export function sha256(buffer) {
  const hash = crypto.createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}


// internal helper methods ------------------------------------------------------------------------

function cmd (...command) {
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

function parseScript(array, script) {
  if (Array.isArray(array)) {
    array.forEach(item => {
      if (Array.isArray(item)) {
        script = parseScriptOperator(script, item[0], ...item.slice(1))
      } else {
        script = parseScriptOperator(script, item)
      }
    }) 
    return script
  } else {
    return parseScriptOperator(script, array)
  }
}

function parseScriptOperator(script, opcode, args) {
  if (!script) {
    const found = Object.entries({
      "10": RadonArray,
      "20": RadonBoolean,
      "30": RadonBytes,
      "40": RadonInteger,
      "50": RadonFloat,
      "60": RadonMap,
      "70": RadonString,
    }).find(entry => entry[0] === (parseInt(opcode) & 0xf0).toString(16))
    const RadonClass = found ? found[1] : RadonAny;
    script = new RadonClass()
  }
  if (opcode) {
    var operator = RadonOperators[opcode].split(/(?=[A-Z])/).slice(1).join("")
    operator = operator.charAt(0).toLowerCase() + operator.slice(1)
    switch (operator) {
      case "filter": case "map": case "sort": case "alter":
        var innerScript = parseScript(args)
        return script[operator](innerScript, ...args.slice(1));
      
      // case "alter":
      //   return script[operator](args[0], parseScript(args[1], ...args.slice(2)));
      
      default:
        return script[operator](args)
    }
  }
}
