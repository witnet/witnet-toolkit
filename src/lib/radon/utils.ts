require('dotenv').config()
import { decode as cborDecode } from 'cbor'

import { fromHexString, isHexString } from "../../bin/helpers"

import { RadonRequest, RadonRequestTemplate } from "./artifacts"
import { RadonReducer, PriceAggregate, PriceTally } from "./reducers"
import { RadonCCDR, RadonRetrieval } from "./retrievals"
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

const WITNET_ASSETS_PATH = process.env.WITNET_TOOLKIT_ASSETS_PATH || "../../../../../witnet/assets"

// /**
//  * Decodes a RadonRequest artifact out from a Protobuf-serialized bytecode.
//  * @param bytecode Radon request bytecode.
//  * @returns RadonRequest object.
//  */
// export function decodeRadonRequest(bytecode: any): RadonRequest {
//   let buffer
//   if (isHexString(bytecode)) {
//     buffer = fromHexString(bytecode)
//   } else if (bytecode instanceof Uint8Array) {
//     buffer = Buffer.from(bytecode)
//   } else if (bytecode instanceof Buffer) {
//     buffer = bytecode
//   } else {
//     throw new TypeError(`Unsupported RadonRequest bytecode format: ${bytecode}`)
//   }
//   const obj: any = RADRequest.decode(buffer)
//   const retrieve = obj.retrieve.map((retrieval: any) => {
//     const specs: any = {}
//     if (retrieval?.url) { specs.url = retrieval.url }
//     if (retrieval?.headers) {
//       specs.headers = retrieval.headers.map((stringPair: any) => [
//         stringPair.left,
//         stringPair.right
//       ])
//     }
//     if (retrieval?.body && retrieval.body.length > 0) {
//       specs.body = utf8ArrayToStr(Object.values(retrieval.body))
//     }
//     if (retrieval?.script) specs.script = decodeRadonScript(toHexString(retrieval.script))
//     return new RadonRetrieval(retrieval.kind, specs)
//   })
//   const decodeFilter = (f: any) => {
//     if (f?.args && f.args.length > 0) return new RadonFilter(f.op, cborDecode(f.args))
//     else return new RadonFilter(f.op);
//   }
//   return new RadonRequest({
//     retrieve,
//     aggregate: new RadonReducer(obj.aggregate.reducer, obj.aggregate.filters?.map(decodeFilter)),
//     tally: new RadonReducer(obj.tally.reducer, obj.tally.filters?.map(decodeFilter))
//   })
// }

/**
 * Decodes a Radon script out from a Protobuf-serialized bytecode.
 * @param hexString Radon script bytecode.
 * @returns Radon script object (i.e. chain of Radon operators with a deterministic output Radon type).
 */
export function decodeRadonScript(bytecode: any): RadonAny {
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

/**
 * Create a proxy dictionary containing
 * the Witnet Radon assets of the specified
 * kind declared or imported within current repository,
 * where keys cannot be duplicated, and where 
 * items can be accessed by their name, 
 * no matter how deep they are placed
 * within the assets hierarchy. 
 * @param type Type of Radon assets to contain: RadonRequest, RadonTemplate or RadonRetrieval.
 * @param legacy Whether to import legacy Witnet Radon assets, or not. 
 * @returns A dictionary object where assets can be accessed by name (e.g. `dict.WitnetRequestPriceWitUsdt6`).
 */
export function RadonDictionary<T extends RadonRequest | RadonRequestTemplate | RadonRetrieval>(
  type: { new(specs: any): T; },
  legacy = false,
): { [key: string]: T } {
  const dict = loadWitnetAssets({ legacy, type, flattened: false })
  if (dict) return new Proxy(dict, proxyHandler<T>(type));
  else return {}
}

/**
 * Search Witnet Radon assets declared or imported within current repository, 
 * whose names complies with the provided `pattern` and `filterFn`. 
 * If no `filterFn` is specified, search will include assets whose names 
 * are suffixed by given `pattern` (case insensitive).
 * @param options Search options
 * @param pattern Name pattern searched for.
 * @param filterFn Filtering function.
 * @returns 
 */
export function searchRadonAssets<T extends RadonRequest | RadonRequestTemplate | RadonRetrieval | RadonCCDR>(
  options: {
    /**
     * Whether to import legacy Witnet Radon assets, or not.
     */
    legacy?: boolean,
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
     * Specific type of Radon asset to search for: `RadonRequest`, `RadonRequestTemplate`, `RadonRetrieval` or `RadonCCDR`.
     */
    type: { new(specs: any): T; },
  },
  filterFn?: (key: string, pattern: string) => boolean,
): Array<[key: string, artifact: T]> {
  const defaultFilter = (key: string, pattern: string) => key.toLowerCase().endsWith(pattern.toLowerCase())
  return (
    loadWitnetAssets({ legacy: options?.legacy, flattened: true, type: options.type })
      .filter((entry: { key: string, artifact: any }) => (filterFn || defaultFilter)(entry.key, options.pattern || ""))
      .slice(options?.offset || 0, options?.limit)
      .map((entry: { key: string, artifact: any | T }) => [entry.key, entry.artifact])
  );
}

// export function searchRadonRequests(
//   flags: {
//     legacy?: boolean,
//     limit?: number,
//     offset?: number,
//     strategy?: 'contains' | 'exact' | 'prefix' | 'suffix',
//   },
//   name: string,
//   args?: string[],
//   modalArgs?: boolean,
// ): Array<{ key: string, artifact: RadonRequest }> {
//   const assets = loadRadonAssets(
//     { legacy: flags?.legacy, flattened: true },
//     !args || args.length === 0 ? RadonRequest : undefined
//   )
//   return assets
//     .find((entry: { key: string, artifact: any }) => {
//       switch (flags?.strategy || 'suffix') {
//         case 'contains': return entry.key.toLowerCase().indexOf(name.toLowerCase()) >= 0;
//         case 'exact': return entry.key.toLowerCase() === name.toLowerCase();
//         case 'prefix': return entry.key.toLowerCase().startsWith(name.toLowerCase());
//         case 'suffix': return entry.key.toLowerCase().endsWith(name.toLowerCase());
//         default: throw new TypeError(`Unsupported artifact search option: ${flags?.strategy}`)
//       }
//     })
//     .map((entry: { key: string, artifact: any }) => {
//       let artifactArgs = [...(args || [])]
//       if (entry.artifact instanceof RadonRequestTemplate) {
//         const template = entry.artifact as RadonRequestTemplate
//         if (!modalArgs) {
//           const templateArgs = new Array(template.retrieve.length)
//           template.retrieve.forEach((retrieval, index) => {
//             templateArgs[index] = artifactArgs?.splice(0, retrieval.argsCount)
//             if (templateArgs[index].length < retrieval.argsCount) {
//               throw new TypeError(`Not enough args passed for retrieval #${index + 1} of RadonTemplate "${entry.key}": ${args}`)
//             }
//           })
//           return { key: entry.key, artifact: template.buildRequest(templateArgs) }
//         } else {
//           return { key: entry.key, artifact: template.buildRequestModal(...artifactArgs) }
//         }

//       } else if (entry.artifact instanceof RadonRetrieval) {
//         let retrieve = entry.artifact as RadonRetrieval
//         if (retrieve.argsCount > 0) {
//           if (artifactArgs.length < retrieve.argsCount) {
//             throw new TypeError(`Not enough args passed for RadonRetrieval "${entry.key}": ${args}`)
//           } else {
//             retrieve = retrieve.foldArgs(...artifactArgs)
//           }
//         }
//         return { key: entry.key, artifact: new RadonRequest({ retrieve }) }

//       } else {
//         return { key: entry.key, artifact: entry.artifact as RadonRequest }
//       }
//     })
//     .slice(flags?.offset || 0, flags?.limit);
// }

/**
 * Build a Price-feed alike Radon Request out from a Radon Retrievals dictionary.
 * > Note: Price-feed alike data requests shall be ultimately resolved 
 * > with PriceAggregate() and PriceTally() reducers for the 
 * > respective aggregate and tally stages, and always return 
 * > an integer if solved successfully by the Wit/Oracle, 
 * > or a RadonError array otherwise.
 * @param argsMap A map containing the names of the Radon Retrievals to build the Price-feed request from, 
 * and the arguments to pass over the parameterized ones (e.g.: `{ "coinbase.com/ticker": ["BTC", "USD"], .. }`). 
 * @param dictionary Radon Retrievals dictionary, other than project's default.
 * @returns Price-feed alike Radon Request.
 */
export function PriceTickerRequest(
  argsMap: Record<string, string[] | undefined>,
  dictionary?: Record<string, RadonRetrieval>
): RadonRequest {
  return RequestFromDictionary({
    retrieve: {
      argsMap,
      dictionary: dictionary || RadonDictionary(RadonRetrieval, true),
    },
    aggregate: PriceAggregate(),
    tally: PriceTally()
  })
};

/**
 * Build a Price-feed alike Radon Template out from the given Radon Retrievals.
 * > Note: Data requests built of returned template shall be ultimately resolved
 * > with PriceAggregate() and PriceTally() reducers for the 
 * > respective aggregate and tally stages, and always return 
 * > an integer if solved successfully by the Wit/Oracle, 
 * > or with RadonError map otherwise.
 * @param retrievals Array of parameterized Radon Retrievals to build the Radon Template from.
 * @param tests Optional map containing named testing tuples (combination of args that should resolve successfully).
 * @returns RadonTemplate capable of building Price-feed alike Radon Requests.
 */
export function PriceTickerTemplate(
  retrievals: RadonRetrieval[],
  tests?: { [test: string]: string[][] },
): RadonRequestTemplate {
  return new RadonRequestTemplate(
    {
      retrieve: retrievals,
      aggregate: PriceAggregate(),
      tally: PriceTally()
    },
    tests
  );
};


// ====================================================================================================================
// --- INTERNAL METHODS -----------------------------------------------------------------------------------------------

function findKeyInObject(dict: any, tag: string) {
  for (const key in dict) {
    if (typeof dict[key] === 'object') {
      if (key === tag) {
        return dict[key]
      } else {
        let found: any = findKeyInObject(dict[key], tag)
        if (found) return found
      }
    }
  }
}

function flattenRadonAssets<T extends RadonRequest | RadonRequestTemplate | RadonRetrieval>(
  tree: any,
  type?: { new(specs: any): T; },
  headers?: string[]
): any {
  if (!headers) headers = []
  const entries = []
  for (const key in tree) {
    if (
      (type && tree[key] instanceof type)
      || (!type &&
        tree[key] instanceof RadonRequest
        || tree[key] instanceof RadonRequestTemplate
        || tree[key] instanceof RadonRetrieval
      )
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

function loadWitnetAssets<T extends RadonRequest | RadonRequestTemplate | RadonRetrieval>(
  options: {
    legacy?: boolean,
    flattened?: boolean,
    type?: { new(specs: any): T; },
  },
): any {
  const assets = options?.legacy ? require(`${WITNET_ASSETS_PATH}`)?.legacy : {
    requests: require(`${WITNET_ASSETS_PATH}/requests`),
    templates: require(`${WITNET_ASSETS_PATH}/templates`),
    retrievals: require(`${WITNET_ASSETS_PATH}/retrievals`),
  };
  return options?.flattened ? flattenRadonAssets(assets, options?.type) : assets
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

function proxyHandler<T>(t: { new(specs: any): T; }) {
  return {
    get(target: any, prop: string) {
      let found = target[prop] ?? findKeyInObject(target, prop)
      // if (!found) {
      //     throw EvalError(`['${prop}'] was not found in dictionary`)
      // } else 
      if (found && !(found instanceof t)) {
        throw TypeError(`['${prop}'] was found with type ${found?.constructor?.name} instead of ${t.name}!`)
      }
      return found
    }
  }
}

function RequestFromDictionary(specs: {
  retrieve: { dictionary: Record<string, RadonRetrieval>, argsMap: Record<string, string[] | undefined>, },
  aggregate?: RadonReducer,
  tally?: RadonReducer,
}): RadonRequest {
  const retrieve: RadonRetrieval[] = []
  // const args: string[][] = []
  Object.keys(specs.retrieve.argsMap).forEach(key => {
    const retrieval: RadonRetrieval = specs.retrieve.dictionary[key]
    const args = (specs.retrieve.argsMap as any)[key]
    if (retrieval.argsCount > 0) {
      if (!args || args.length < retrieval.argsCount) {
        throw TypeError(`Insufficient args passed to retrieval named as '${key}': ${args.length} < ${retrieval.argsCount}`)
      } else {
        retrieve.push(retrieval.foldArgs(...args))
      }
    } else {
      retrieve.push(retrieval)
    }
  })
  return new RadonRequest({ retrieve, aggregate: specs?.aggregate, tally: specs?.tally })
};
