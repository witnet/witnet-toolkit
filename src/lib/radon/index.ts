import * as _Artifacts from "./artifacts"
import * as _Filters from "./filters"
import * as _Reducers from "./reducers"
import * as _Retrievals from "./retrievals"
import * as _RPCs from "./rpcs"
import * as _Types from "./types"

import { RadonRequest, RadonRequestTemplate } from "./artifacts"
import { RadonReducer } from "./reducers"
import { RadonRetrieval } from "./retrievals"

/**
 * Constructors for Radon requests or templates.
 */
export const Artifacts: typeof _Artifacts = _Artifacts;

/**
 * Set of Radon filters operators that can be used within both
 * the `aggregate` and `tally` Radon reducers within
 * a Radon request or template.
 */
export const Filters: typeof _Filters = _Filters;

/**     
 * Set of Radon reducers that can be applied to either
 * data extracted from multiple data sources (i.e. `aggregate`),
 * or results revealed from multiple witnessing nodes (i.e. `tally`).
 */
export const Reducers: typeof _Reducers = _Reducers;

/**
 * Set of Radon retrievals that can be added as part of Radon requests or templates.
 */
export const Retrievals: typeof _Retrievals = _Retrievals;

/**
 * Set or Remote Procedure Calls that can be used within Cross-chain Radon retrievals.
 */
export const RPCs: typeof _RPCs = _RPCs;

/**
 * Set of data types that can be processed
 * by Radon scripts when processing the result
 * extracted from Radon retrievals.
 */
export const Types: typeof _Types = _Types;

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

export function PriceTickerTemplate (specs: { retrieve: RadonRetrieval[], tests?: Map<string, string[][]> }) { 
    return new RadonRequestTemplate(
        {
            retrieve: specs.retrieve, 
            aggregate: _Reducers.PriceAggregate(), 
            tally: _Reducers.PriceTally() 
        }, 
        specs?.tests
    );
};

export function Request (specs: { 
    retrieve: RadonRetrieval[], 
    aggregate?: RadonReducer, 
    tally?: RadonReducer 
}): RadonRequest {
    return new RadonRequest(specs)
};
 

export function RequestTemplate (specs: {
        retrieve: RadonRetrieval[], 
        aggregate?: RadonReducer, 
        tally?: RadonReducer,
        tests?: Map<string, string[] | string[][]>,   
}): RadonRequestTemplate {
    return new RadonRequestTemplate(
        {
            retrieve: specs.retrieve,
            aggregate: specs?.aggregate,
            tally: specs?.tally
        }, 
        specs.tests
    );
};
