require('dotenv').config()
import { decode as cborDecode } from 'cbor'

import { fromHexString, isHexString } from "../../bin/helpers"

import { RadonRequest, RadonModal, RadonTemplate, RadonRetrieval } from "./index"

import {
  RadonAny,
  RadonArray,
  RadonBoolean,
  RadonBytes,
  RadonFloat,
  RadonInteger,
  RadonMap,
  RadonString,
  RadonOperators,
} from "./types"

const WITNET_ASSETS_PATH = process.env.WITNET_SDK_RADON_ASSETS_PATH || "../../../../../witnet/assets"

export { execRadonBytecode } from "../../bin/helpers"

/**
 * Decodes a Radon script out from a Protobuf-serialized bytecode.
 * @param hexString Radon script bytecode.
 * @returns Radon script object (i.e. chain of Radon operators with a deterministic output Radon type).
 */
export function parseRadonScript(bytecode: any): RadonAny {
  let buffer
  if (isHexString(bytecode)) {
    buffer = fromHexString(bytecode)
  } else if (bytecode instanceof Uint8Array) {
    buffer = Buffer.from(bytecode)
  } else if (bytecode instanceof Buffer) {
    buffer = bytecode
  } else {
    throw new TypeError(`Unsupported RadonScript bytecode format: ${bytecode}`)
  }
  const array = cborDecode(buffer)
  return parseScript(array)
}


export function flattenRadonAssets<T extends RadonRequest | RadonTemplate | RadonModal | RadonRetrieval>(
  tree: any,
  type?: { new(specs: any): T; },
  headers?: string[]
): Array<{ key: string, artifact: any }> {
  if (!headers) headers = []
  const entries: Array<{ key: string, artifact: any }> = []
  for (const key in tree) {
    if (
      (type && tree[key] instanceof type)
      || (!type && (
          tree[key] instanceof RadonRequest
          || tree[key] instanceof RadonTemplate
          || tree[key] instanceof RadonModal
          || tree[key] instanceof RadonRetrieval
      ))
    ) {
      entries.push({
        key,
        artifact: tree[key],
      })
    } else if (typeof tree[key] === "object") {
      entries.push(...flattenRadonAssets(
        tree[key],
        type,
        [...headers, key]
      ))
    }
  }
  return entries
};

export function requireRadonAsset<T extends RadonRequest | RadonTemplate | RadonModal | RadonRetrieval>(specs: {
  artifact: string,
  assets?: any,
  type?: { new (specs: any): T; },
}): T {
  const stuff = (
    specs?.assets 
      ? flattenRadonAssets(specs.assets, specs?.type) 
      : loadModuleAssets({ flattened: true, type: specs?.type })
  );
  const found = stuff.find((entry: { key: string, artifact: any }) => entry.key === specs.artifact)
  if (found) {
    return found[0].artifact
  } else {
    throw Error(`Radon asset "${specs.artifact}" not available.`)
  }
}

/**
 * Search Witnet Radon assets declared or imported within current repository, 
 * whose names complies with the provided `pattern` and `filterFn`. 
 * If no `filterFn` is specified, search will include assets whose names 
 * are suffixed by given `pattern` (case insensitive).
 * @param options Search options
 * @param filterFn Filtering function.
 * @returns An array of Radon assets of the specified kind complying with the search pattern. 
 */
export function searchRadonAssets<T extends RadonRequest | RadonTemplate | RadonModal | RadonRetrieval>(
  options: {
    /**
     * Object containing structured heriarchy of Radon assets. If not provided, Radon assets declared within project's environment.
     */
    assets?: any,
    /**
     * Limits number of returned Radon assets.
     */
    limit?: number,
    /**
     * Offsets returned array of Radon assets.
     */
    offset?: number,
    /**
     * Name pattern searched for.
     */
    pattern: string,
    /**
     * Specific type of Radon asset to search for: `RadonRequest`, `RadonRequest`, `RadonRetrieval` or `RadonCCDR`.
     */
    type?: { new (specs: any): T; },
  },
  filterFn?: (key: string, pattern: string) => boolean,
): Array<[key: string, artifact: T]> {
  const defaultFilter = (key: string, pattern: string) => key.toLowerCase().endsWith(pattern.toLowerCase())
  const stuff = (
    options?.assets
      ? flattenRadonAssets(options.assets, options?.type)
      : loadModuleAssets({ flattened: true, type: options?.type })
  );
  return (
    stuff
      .filter((entry: { key: string, artifact: any }) => (filterFn || defaultFilter)(entry.key, options.pattern || ""))
      .slice(options?.offset || 0, options?.limit)
      .map((entry: { key: string, artifact: any | T }) => [entry.key, entry.artifact])
  );
}


// ====================================================================================================================
// --- INTERNAL METHODS -----------------------------------------------------------------------------------------------

function loadModuleAssets<T extends RadonRequest | RadonTemplate | RadonModal | RadonRetrieval>(
  options: {
    // legacy?: boolean,
    flattened?: boolean,
    type?: { new(specs: any): T; },
  },
): any {
  // const stuff = options?.legacy ? require(`${WITNET_ASSETS_PATH}`).legacy : {
  //   requests: require(`${WITNET_ASSETS_PATH}/requests`),
  //   templates: require(`${WITNET_ASSETS_PATH}/templates`),
  //   retrievals: require(`${WITNET_ASSETS_PATH}/retrievals`),
  // };
  const stuff = require(`${WITNET_ASSETS_PATH}`)
  return options?.flattened ? flattenRadonAssets(stuff, options?.type) : stuff
}

function parseScript(array: any, script?: any): any {
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

function parseScriptOperator(script: any, opcode: any, args?: any): any {
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
    if (found) {
      script = new found[1]
    } else {
      throw TypeError(`unknown Radon operator: ${opcode}`)
    }
  }
  if (opcode) {
    let operator = RadonOperators[opcode].split(/(?=[A-Z])/).slice(1).join("")
    operator = operator.charAt(0).toLowerCase() + operator.slice(1)
    switch (operator) {
      case "filter": case "map": case "sort": case "alter":
        const innerScript = parseScript(args)
        return script[operator](innerScript, ...args.slice(1));

      // case "alter":
      //   return script[operator](args[0], parseScript(args[1], ...args.slice(2)));

      default:
        return script[operator](args)
    }
  }
}
