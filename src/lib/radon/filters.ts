enum Opcodes {
    Mode = 0x08,
    StandardDeviation = 0x05,
}

export class Class {
    public opcode: Opcodes;
    public args?: any;
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
}

export function Mode () { return new Class(Opcodes.Mode); }
export function Stdev (stdev: number) { return new Class(Opcodes.StandardDeviation, stdev); }
