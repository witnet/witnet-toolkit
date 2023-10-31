export enum Opcodes {
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
                case Opcodes.Mode: return "Filter(mode)";
                case Opcodes.StandardDeviation: return `Filter(stdev = ${args})`
            }
        }})
    }
}

export const Mode = () => new Class(Opcodes.Mode);
export const Stdev = (stdev: number) => new Class(Opcodes.StandardDeviation, stdev);
