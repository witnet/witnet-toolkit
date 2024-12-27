import * as _RadonRetrievals from "./lib/radon/retrievals"
export const RadonRetrievals: typeof _RadonRetrievals = _RadonRetrievals;

import * as _RadonReducers from "./lib/radon/reducers"
export const RadonReducers: typeof _RadonReducers = _RadonReducers;

import * as _RadonFilters from "./lib/radon/filters"
export const RadonFilters: typeof _RadonFilters = _RadonFilters;

import { RadonAny, RadonString, RadonScript as _RadonScript } from "./lib/radon/types"
export { RadonArray, RadonBytes, RadonBoolean, RadonFloat, RadonInteger, RadonString, RadonMap,  } from './lib/radon/types'
export { RadonScriptWrapper } from "./lib/radon/types"

export function RadonScript<InputType extends RadonAny = RadonString>(inputType: { new (ops?: _RadonScript): InputType; }): InputType {
    if (!inputType) throw EvalError("An InputType must be specified when declaring a new RadonScript") 
    return new inputType();
}

export { RadonRequest, RadonRequestTemplate as RadonTemplate } from "./lib/radon/artifacts"

export class RadonSLA {
    public readonly numWitnesses: number;
    public readonly unitaryFee: number;
    constructor (numWitnesses: number, unitaryFee: number) {
        this.numWitnesses = numWitnesses
        this.unitaryFee = unitaryFee
    }
}

import * as _Utils from "./utils"
export const Utils: typeof _Utils = _Utils;
