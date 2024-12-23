const cbor = require("cbor")
const os = require("os")
const crypto = require("crypto")
const { exec } = require("child_process")

var protoBuf = require("protobufjs")
var protoRoot = protoBuf.Root.fromJSON(require("../assets/witnet.proto.json"))
var RADRequest = protoRoot.lookupType("RADRequest")

import { RadonRequest } from "./lib/radon/artifacts"
import { RadonRetrieval } from "./lib/radon/retrievals"
import { RadonReducer } from "./lib/radon/reducers"
import { RadonFilter } from "./lib/radon/filters"
import * as RadonTypes from "./lib/radon/types"

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

export async function execDryRun(bytecode, ...flags) {
  if (!isHexString(bytecode)) {
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

export function fromHexString(hexString) {
  if (hexString.startsWith("0x")) hexString = hexString.slice(2)
  return Uint8Array.from(hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)))
}

export function sha256(buffer) {
  const hash = crypto.createHash('sha256')
  hash.update(buffer)
  return hash.digest('hex')
}

export function toHexString(buffer) {
  return "0x" + Array.prototype.map.call(buffer, x => ('00' + x.toString(16)).slice(-2))
    .join('')
    .match(/[a-fA-F0-9]{2}/g)
    .join('')
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

function isHexString(str) {
  if (str.startsWith("0x")) str = str.slice(2)
  return (
    !Number.isInteger(str)
    && /^[a-fA-F0-9]+$/i.test(str.slice(2))
  );
}

function parseScript(array, script) {
  if (Array.isArray(array)) {
    array.forEach(item => {
      if (Array.isArray(item)) {
        script = parseScriptOperator(script, item[0], item.slice(1))
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
      "10": RadonTypes.RadonArray,
      "20": RadonTypes.RadonBoolean,
      "30": RadonTypes.RadonBytes,
      "40": RadonTypes.RadonInteger,
      "50": RadonTypes.RadonFloat,
      "60": RadonTypes.RadonMap,
      "70": RadonTypes.RadonString,
    }).find(entry => entry[0] === (parseInt(opcode) & 0xf0).toString(16))
    const RadonClass = found ? found[1] : RadonTypes.RadonType;
    script = new RadonClass()
  }
  if (opcode) {
    var operator = RadonTypes.RadonOperators[opcode].split(/(?=[A-Z])/).slice(1).join("")
    operator = operator.charAt(0).toLowerCase() + operator.slice(1)
    switch (operator) {
      case "filter": case "map": case "sort": 
        return script[operator](parseScript(args[0]), args.slice(1));
      
      case "alter":
        return script[operator](args[0], parseScript(args[1], ...args.slice(2)));
      
      default:
        return script[operator](args)
    }
  }
}

function utf8ArrayToStr(array) {
  var out, i, len, c;
  var char2, char3;

  out = "";
  len = array.length;
  i = 0;
  while(i < len) {
    c = array[i++];
    switch(c >> 4)
    { 
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
