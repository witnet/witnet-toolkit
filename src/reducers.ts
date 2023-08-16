import { Script } from "./types"
import { Class as Filter, Stdev as StdevFilter } from "./filters"

export enum Opcodes {
    Mode = 0x02,
    MeanAverage = 0x03,
    MedianAverage = 0x05,
    StandardDeviation = 0x07,
    ConcatenateAndHash = 0x0B,
}

export interface Specs {
    filters?: Filter[],
    script?: Script,
}

export class Class {
    opcode: Opcodes
    filters?: Filter[]
    // TODO: script?: Script
    constructor(opcode: Opcodes, filters?: Filter[]) {
        this.opcode = opcode
        this.filters = filters
        // TODO: this.script = specs?.filters
        Object.defineProperty(this, "toString", { value: () => {
            let filters = ""
            this.filters?.map(filter => { filters = filter.toString() + `${filters ? "." + filters : ""}` })
            if (filters) filters = filters + "."
            switch(this.opcode) {
                case Opcodes.Mode: return `${filters}Mode()`;
                case Opcodes.MeanAverage: return `${filters}Mean()`;
                case Opcodes.MedianAverage: return `${filters}Median()`;
                case Opcodes.StandardDeviation: return `${filters}Stdev()`;
                case Opcodes.ConcatenateAndHash: return `${filters}ConcatHash()`;
            }
        }})
    }
}

export const Mode = (...filters: Filter[]) => new Class(Opcodes.Mode, filters);
export const Mean = (...filters: Filter[]) => new Class(Opcodes.MeanAverage, filters)
export const Median = (...filters: Filter[]) => new Class(Opcodes.MedianAverage, filters)
export const Stdev = (...filters: Filter[]) => new Class(Opcodes.StandardDeviation, filters)
export const ConcatHash = (...filters: Filter[]) => new Class(Opcodes.ConcatenateAndHash, filters)

export const PriceAggregate = () => new Class(Opcodes.MeanAverage, [ StdevFilter(1.4) ])
export const PriceTally = () => new Class(Opcodes.MeanAverage, [ StdevFilter(2.5) ])