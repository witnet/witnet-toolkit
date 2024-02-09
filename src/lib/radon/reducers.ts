import { RadonType as Script } from "./types"
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

export function Mode (...filters: Filter[]) { return new Class(Opcodes.Mode, filters); }
export function Mean (...filters: Filter[]) { return new Class(Opcodes.MeanAverage, filters); }
export function Median (...filters: Filter[]) { return new Class(Opcodes.MedianAverage, filters); }
export function Stdev (...filters: Filter[]) { return new Class(Opcodes.StandardDeviation, filters); }
export function ConcatHash (...filters: Filter[]) { return new Class(Opcodes.ConcatenateAndHash, filters); }

export function PriceAggregate () { return new Class(Opcodes.MeanAverage, [ StdevFilter(1.4) ]); }
export function PriceTally () { return new Class(Opcodes.MeanAverage, [ StdevFilter(2.5) ]); }
