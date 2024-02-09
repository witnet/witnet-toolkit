import * as _Artifacts from "./artifacts"
import * as _Filters from "./filters"
import * as _Reducers from "./reducers"
import * as _Retrievals from "./retrievals"
import * as _RPC from "./ccdr"
import * as _Types from "./types"

/**
 * Web3 deployable artifacts that can be declared within
 * Witnet resource files: 
 * - data request templates,
 * - parameterized requests, 
 * - precompiled requests.
 */
export const Artifacts: typeof _Artifacts = _Artifacts;

/**
 * Radon Filters that can be used within both
 * the Aggregate and Tally scripts of a Data Request.
 */
export const Filters: typeof _Filters = _Filters;

/**
 * Radon Reducers that can be used within both
 * the Aggregate and Tally scripts of a Data Request.
 */
export const Reducers: typeof _Reducers = _Reducers;

/**
 * Data retrieving methods that can be added as
 * part of a Data Request.
 */
export const Retrievals: typeof _Retrievals = _Retrievals;

/**
 * Precompiled Remote Procedure Calls that can be included within
 * Cross Chain Data Retrievals (i.e. `Witnet.Retrievals.CrossChainDataRetrieval({ .. })`, 
 * grouped by JSON-RPC protocol:
 * - JSON ETH/RPC endpoints
 * - JSON WIT/RPC endpoints
 */
export const CCDR: typeof _RPC = _RPC;

/**
 * Data types handled by Radon scripts
 * while processing response(s) from 
 * the source(s) of a Data Request.
 */
export const Types: typeof _Types = _Types;

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
            if (!found) {
                throw EvalError(`\x1b[1;31m['${prop}']\x1b[1;33m was not found in dictionary\x1b[0m`)
            } else if (!(found instanceof t)) {
                throw EvalError(`\x1b[1;31m['${prop}']\x1b[1;33m was found with unexpected type!\x1b[0m`)
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

/**
 * Creates a Radon script capable of processing the returned
 * string value from some remote data source (i.e. Radon Retrieval). 
 * All involved computation will take place on the Witnet Oracle 
 * layer-1 side-chain, not in the EVM context. 
 */
export function Script(): _Types.RadonString { return InnerScript(Types.RadonString); }

/**
 * Creates a Radon script that can be passed to certain Radon
 * operators (e.g. `RadonString.filter(..)`, `RadonArray.map(..)`, ...)
 * as to internally process some input value of the specified kind.
 * @param t Radon type of the input data to be processed by the new script.
 */
export function InnerScript<T extends _Types.RadonType>(t: { new(): T; }): T { return new t(); }


/// ===================================================================================================================
/// --- Request and Template factory methods --------------------------------------------------------------------------

export function PriceTickerRequest (dict: any, tags: Map<string, string | string[] | undefined>) {
    return RequestFromDictionary({
        retrieve: {
            dict, 
            tags,
        }, 
        aggregate: _Reducers.PriceAggregate(), 
        tally: _Reducers.PriceTally()
    })
};

export function PriceTickerTemplate (specs: { retrieve: _Retrievals.Class[], tests?: Map<string, string[][]> }) { 
    return new _Artifacts.Template(
        {
            retrieve: specs.retrieve, 
            aggregate: _Reducers.PriceAggregate(), 
            tally: _Reducers.PriceTally() 
        }, 
        specs?.tests
    );
};
 
export function RequestFromDictionary (specs: { 
    retrieve: { dict: any, tags: Map<string, string | string[] | undefined>, },
    aggregate?: _Reducers.Class, 
    tally?: _Reducers.Class
}) {
    const retrievals: _Retrievals.Class[] = []
    const args: string[][] = []
    Object.keys(specs.retrieve.tags).forEach(key => {    
        const retrieval: _Retrievals.Class = specs.retrieve.dict[key]
        const value: any = (specs.retrieve.tags as any)[key]
        if (typeof value === 'string') {
            if (retrieval?.tuples) {
                args.push((retrieval.tuples as any)[value] || [])
            } else {
                throw EvalError(`\x1b[1;33mRequestFromDictionary: No tuple \x1b[1;31m'${value}'\x1b[1;33m was declared for retrieval \x1b[1;37m['${key}']\x1b[0m`)
            }
        } else {
            args.push(value || [])
        }
        retrievals.push(retrieval)
    })
    return new _Artifacts.Parameterized(
        new _Artifacts.Template({ retrieve: retrievals, aggregate: specs.aggregate, tally: specs.tally }),
        args
    )
};

export function RequestFromTemplate (template: _Artifacts.Template, args: string[] | string[][]) {
    return new _Artifacts.Parameterized(template, args);
};

export function RequestTemplate (specs: {
        retrieve: _Retrievals.Class[], 
        aggregate?: _Reducers.Class, 
        tally?: _Reducers.Class,
        tests?: Map<string, string[] | string[][]>,   
}) {
    return new _Artifacts.Template(
        {
            retrieve: specs.retrieve,
            aggregate: specs?.aggregate,
            tally: specs?.tally
        }, specs.tests
    );
};

export function RequestTemplateSingleSource (retrieval: _Retrievals.Class, tests?: Map<string, string[] | string[][]>) {
    return new _Artifacts.Template(
        {
            retrieve: [ retrieval ],
            aggregate: _Reducers.Mode(),
            tally: _Reducers.Mode(Filters.Mode()),
        }, 
        tests
    );
};

export function StaticRequest (specs: { 
    retrieve: _Retrievals.Class[], 
    aggregate?: _Reducers.Class, 
    tally?: _Reducers.Class 
}) {
    return new _Artifacts.Precompiled(specs)
};
