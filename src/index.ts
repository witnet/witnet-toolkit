export * as Utils from "./utils"

export * as RadonFilters from "./lib/radon/filters"
export * as RadonReducers from "./lib/radon/reducers"
export * as RadonRetrievals from "./lib/radon/retrievals"

export { 
    RadonRequest, 
    RadonRequestTemplate as RadonTemplate 
} from "./lib/radon/artifacts"

import { RadonAny, RadonString, RadonScript as _RadonScript } from "./lib/radon/types"
export { 
    RadonArray, 
    RadonBytes, 
    RadonBoolean, 
    RadonFloat, 
    RadonInteger, 
    RadonString, 
    RadonMap,
    RadonScriptWrapper,
} from './lib/radon/types'

export function RadonScript<InputType extends RadonAny = RadonString>(inputType: { new (ops?: _RadonScript): InputType; }): InputType {
    if (!inputType) throw EvalError("An InputType must be specified when declaring a new Radon script") 
    return new inputType();
}

export class RadonSLA {
    public readonly numWitnesses: number;
    public readonly unitaryFee: number;
    constructor (numWitnesses: number, unitaryFee: number) {
        this.numWitnesses = numWitnesses
        this.unitaryFee = unitaryFee
    }
}
