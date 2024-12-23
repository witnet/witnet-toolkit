const cbor = require("cbor")

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
        var json: any = {
            op: Opcodes[this.opcode],
        }
        if (this.args) {
            json.args = this.args
        }
        return json;
    }
    
    public toProtobuf(): any {
        var protobuf: any = {
            op: this.opcode,
        }
        if (this.args) {
            protobuf.args = cbor.encode(this.args)
        }
        return protobuf
    }
}

export function Mode () { return new RadonFilter(Opcodes.Mode); }
export function Stdev (stdev: number) { return new RadonFilter(Opcodes.StandardDeviation, stdev); }
