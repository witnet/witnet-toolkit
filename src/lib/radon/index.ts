export * as RadonFilters from './filters'
export * as RadonReducers from './reducers'
export * as RadonRetrieve from './retrievals'

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

import { RadonAny, RadonString, RadonOperator } from './types'

export function RadonScript<InputType extends RadonAny = RadonString>(inputType: { new (ops?: RadonOperator): InputType; }): InputType {
    if (!inputType) throw TypeError("An InputType must be specified when declaring a new Radon script") 
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
