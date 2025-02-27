export * as RadonFilters from './filters'
export * as RadonReducers from './reducers'
export * as RadonRetrievals from './retrievals'

export { RadonRequest, RadonTemplate } from './artifacts'
export { RadonCCDR, RadonRetrieval } from './retrievals'

export {
    RadonArray,
    RadonBytes,
    RadonBoolean,
    RadonFloat,
    RadonInteger,
    RadonString,
    RadonMap,
    RadonScript as RadonScriptWrapper,
    RadonEncodings,
} from './types'

export { HexString as RadonBytecode } from "../types"

import { RadonAny, RadonString, RadonOperator } from './types'
export function RadonScript<InputType extends RadonAny = RadonString>(inputType: { new (ops?: RadonOperator): InputType; }): InputType {
    if (!inputType) throw TypeError("An InputType must be specified when declaring a new Radon script") 
    return new inputType();
}

/// FACTORY METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////

import { RadonRequest, RadonTemplate } from "./artifacts"
import { RadonCCDR, RadonRetrieval } from "./retrievals"

/**
 * Creates a proxy dictionary of Witnet Radon assets
 * of the specified kind, where keys cannot
 * be duplicated, and where items can be accessed
 * by their name, no matter how deep they are placed
 * within the given hierarchy. 
 * @param t Type of the contained Radon assets.
 * @param dict Hierarchical object containing the assets.
 * @returns 
 */
export function RadonDictionary<T extends RadonRequest | RadonTemplate | RadonCCDR | RadonRetrieval>(t: { new (specs: any): T; }, dict: Object): Object {
    return new Proxy(dict, proxyHandler<T>(t))
}

import { RadonReducer } from "./reducers"
export function RadonRequestFromDictionary(specs: {
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
