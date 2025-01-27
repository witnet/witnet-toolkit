import * as artifacts from './artifacts'
import * as reducers from './reducers'
import * as retrievals from './retrievals'

export * as RadonFilters from './filters'
export * as RadonReducers from './reducers'
export * as RadonRetrievals from './retrievals'

export { RadonRequest, RadonRequestTemplate as RadonTemplate } from './artifacts'
export { RadonRetrieval } from './retrievals'

export {
    RadonArray,
    RadonBytes,
    RadonBoolean,
    RadonFloat,
    RadonInteger,
    RadonString,
    RadonMap,
    RadonScript as RadonScriptWrapper
} from './types'

export class RadonSLA {
    public readonly numWitnesses: number;
    public readonly unitaryFee: number;
    constructor (numWitnesses: number, unitaryFee: number) {
        this.numWitnesses = numWitnesses
        this.unitaryFee = unitaryFee
    }
}


/// FACTORY METHODS ///////////////////////////////////////////////////////////////////////////////////////////////////

import { RadonAny, RadonString, RadonOperator } from './types'

export function PriceTickerRequest (dict: any, tags: Record<string, string[] | undefined>) {
    return RequestFromDictionary({
        retrieve: {
            dict, 
            tags,
        }, 
        aggregate: reducers.PriceAggregate(), 
        tally: reducers.PriceTally()
    })
};

export function PriceTickerTemplate (specs: { retrieve: retrievals.RadonRetrieval[], tests?: Record<string, string[][]> }) { 
    return new artifacts.RadonRequestTemplate({
            retrieve: specs.retrieve, 
            aggregate: reducers.PriceAggregate(), 
            tally: reducers.PriceTally() 
        }, 
        specs?.tests
    );
};

export function RadonScript<InputType extends RadonAny = RadonString>(inputType: { new (ops?: RadonOperator): InputType; }): InputType {
    if (!inputType) throw TypeError("An InputType must be specified when declaring a new Radon script") 
    return new inputType();
}

export function RequestFromDictionary (specs: { 
    retrieve: { dict: any, tags: Record<string, string[] | undefined>, },
    aggregate?: reducers.RadonReducer, 
    tally?: reducers.RadonReducer,
}) {
    const retrieve: retrievals.RadonRetrieval[] = []
    // const args: string[][] = []
    Object.keys(specs.retrieve.tags).forEach(key => {
        const retrieval: retrievals.RadonRetrieval = specs.retrieve.dict[key]
        const args = (specs.retrieve.tags as any)[key]
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
    return new artifacts.RadonRequest({ retrieve, aggregate: specs?.aggregate, tally: specs?.tally })
};

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
export function Dictionary<T>(t: { new(): T; }, dict: Object): Object {
    return new Proxy(dict, proxyHandler<T>(t))
}

function proxyHandler<T>(t: { new(): T; }) {
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
