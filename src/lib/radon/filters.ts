import { encode as cborEncode } from "cbor"

export enum Opcodes {
    Mode = 0x08,
    StandardDeviation = 0x05,
}

export class RadonFilter {

    readonly opcode: Opcodes;
    readonly args?: any;
    
    constructor(opcode: Opcodes, args?: any) {
        this.opcode = opcode
        this.args = args
        Object.defineProperty(this, "toString", { value: () => {
            switch(this.opcode) {
                case Opcodes.Mode: return "Class(mode)";
                case Opcodes.StandardDeviation: return `Class(stdev = ${args})`
            }
        }})
    }

    public toJSON(): any {
        const json: any = {
            op: Opcodes[this.opcode],
        }
        if (this.args) {
            json.args = this.args
        }
        return json;
    }
    
    public toProtobuf(): any {
        const protobuf: any = {
            op: this.opcode,
        }
        if (this.args) {
            protobuf.args = cborEncode(this.args)
        }
        return protobuf
    }
}

export function Mode () { return new RadonFilter(Opcodes.Mode); }
export function Stdev (stdev: number) { return new RadonFilter(Opcodes.StandardDeviation, stdev); }
