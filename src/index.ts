import * as _RadonRetrievals from "./lib/radon/retrievals"
export const RadonRetrievals: typeof _RadonRetrievals = _RadonRetrievals;

import * as _RadonReducers from "./lib/radon/reducers"
export const RadonReducers: typeof _RadonReducers = _RadonReducers;

import * as _RadonFilters from "./lib/radon/filters"
export const RadonFilters: typeof _RadonFilters = _RadonFilters;

import * as _RadonTypes from "./lib/radon/types"
export const RadonTypes: typeof _RadonTypes = _RadonTypes;

export function RadonInnerScript<T extends _RadonTypes.RadonType = _RadonTypes.RadonString>(t: { new(): T; }): T { return new t(); }
export function RadonScript(): _RadonTypes.RadonString { return RadonInnerScript(_RadonTypes.RadonString); }

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
