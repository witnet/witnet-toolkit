import { encode as cborEncode } from "cbor"
import * as helpers from "../../bin/helpers"

import { Opcodes as RadonReducerOpcodes } from './reducers'
import * as Utils from '../utils'

export { HexString as RadonBytecode } from "../types"

export enum RadonEncodings {
    HexString = 0,
    Base64 = 1,
    Utf8 = 2,
}

enum RadonHashFunctions {
    // Blake256 = 0x00,
    // Blake512 = 0x01,
    // Blake2s256 = 0x02,
    // Blake2b512 = 0x03,
    // MD5_128 = 0x04,
    // Ripemd128 = 0x05,
    // Ripemd160 = 0x06,
    // Ripemd320 = 0x07,
    // SHA1_160 = 0x08,
    // SHA2_224 = 0x09,
    SHA2_256 = 0x0A,
    // SHA2_384 = 0x0B,
    // SHA2_512 = 0x0C,
    // SHA3_224 = 0x0D,
    // SHA3_256 = 0x0E,
    // SHA3_384 = 0x0F,
    // SHA3_512 = 0x10,
    // Whirlpool512 = 0x11,
}

export enum RadonOperators {
    ArrayLength = 0x10,
    ArrayFilter = 0x11,
    // ArrayJoin = 0x12,
    ArrayGetArray = 0x13,
    ArrayGetBoolean = 0x14,
    ArrayGetBytes = 0x15,
    ArrayGetFloat = 0x16,
    ArrayGetInteger = 0x17,
    ArrayGetMap = 0x18,
    ArrayGetString = 0x19,
    ArrayMap = 0x1a,
    ArrayReduce = 0x1b,
    ArraySort = 0x1d,
    // ArrayPick = 0x1e,
    BooleanToString = 0x20,
    BooleanNegate = 0x22,
    BytesToString = 0x30,
    BytesHash = 0x31,
    BytesAsInteger = 0x32,
    BytesLength = 0x34,
    BytesSlice = 0x3c,
    FloatAbsolute = 0x50,
    FloatToString = 0x51,
    FloatCeiling = 0x52,
    FloatGreaterThan = 0x53,
    FloatFloor = 0x54,
    FloatLessThan = 0x55,
    FloatModule = 0x56,
    FloatMultiply = 0x57,
    FloatNegate = 0x58,
    FloatPower = 0x59,
    FloatRound = 0x5b,
    FloatTruncate = 0x5d,
    IntegerAbsolute = 0x40,
    IntegerToFloat = 0x41,
    IntegerToString = 0x42,
    IntegerGreaterThan = 0x43,
    IntegerLessThan = 0x44,
    IntegerModulo = 0x46,
    IntegerMultiply = 0x47,
    IntegerNegate = 0x48,
    IntegerPower = 0x49,
    IntegerToBytes = 0x4a,
    MapToString = 0x60,
    MapGetArray = 0x61,
    MapGetBoolean = 0x62,
    MapGetFloat = 0x64,
    MapGetInteger = 0x65,
    MapGetMap = 0x66,
    MapGetString = 0x67,
    MapKeys = 0x68,
    MapValues = 0x69,
    MapAlter = 0x6b,
    MapPick = 0x6e,   
    StringAsBoolean = 0x70,
    StringAsBytes = 0x71,
    StringAsFloat = 0x72,
    StringAsInteger = 0x73,
    StringLength = 0x74,
    StringMatch = 0x75,
    StringParseJSONArray = 0x76,
    StringParseJSONMap = 0x77,
    StringParseXMLMap = 0x78,
    StringToLowerCase = 0x79,
    StringToUppserCase = 0x7a,
    StringReplace = 0x7b,
    StringSlice = 0x7c,
    StringSplit = 0x7d,
}

abstract class RadonClass {
    readonly prev?: RadonOperator;
    constructor(prev?: RadonOperator) {
        this.prev = prev
    }
}

export class RadonOperator extends RadonClass {
    readonly opcode: RadonOperators
    readonly params?: any[]
    constructor(opcode: RadonOperators, params?: any[], ops?: RadonOperator) {
        super(ops)
        this.opcode = opcode
        this.params = params || []
    }
    public argsCount(): number { 
        let maxCount: number = 0
        this.params?.forEach(param => {
            if (typeof param === 'string') {
                const count = helpers.getWildcardsCountFromString(param)
                if (count > maxCount) maxCount = count
            } else if (typeof param === 'object' && param instanceof RadonScript) {
                const count = param.argsCount()
                if (count > maxCount) maxCount = count
            }
        })
        return Math.max(
            maxCount,
            this.prev?.argsCount() || 0
        )
    }
    public disect(level = 0): [number, string, string][] {
        const result = this?.prev?.disect(level) || []
        const operator = RadonOperators[this.opcode]
        const inputType = `Radon${operator.split(/(?=[A-Z])/)[0]}`
        let radonCall = operator.split(/(?=[A-Z])/).slice(1).join('')
        radonCall = radonCall.charAt(0).toLowerCase() + radonCall.slice(1)
        let args = ""
        let script
        if (this.params && this.params[0] !== undefined) {
            this.params.map(param => {
                if (typeof param !== 'object' || !(param instanceof RadonScript)) {
                    args += (typeof param === 'string' ?  `"${param}"` : JSON.stringify(param)) + ", "
                } else {
                    script = param
                }
            })
            if (script) args += "RadonOperator {"
            else args = args.slice(0, -2)
        }
        if (script) {
            const outputType = `${(script as RadonScript).outputType?.constructor.name || "RadonAny"}`
            radonCall += `(${args}`
            result.push([level, inputType, radonCall])
            result.push(...(script as RadonScript).disect(level + 1))
            result.push([level, outputType, "})"])
        } else {
            radonCall += `(${args})`
            result.push([level, inputType, radonCall])
        }
        return result
    }
    public encode(): any[] { 
        let encoded
        if (this?.params && this.params[0] !== undefined) {
            const args = this.params.map(param => {
                if (typeof param === 'object') {
                    if (param instanceof RadonAny) {
                        return param.prev?.encode()
                    } else if (param instanceof RadonOperator) {
                        return param.encode()
                    } else if (param instanceof RadonScript) {
                        return param.encode()
                    } else {
                        return param
                    }
                } else {
                    return param
                }
            })
            encoded = [this.opcode, ...args]
        } else {
            encoded = this.opcode
        }
        if (this.prev) {
            return [...this.prev.encode(), encoded]
        } else {
            return [encoded]
        }
    }
    public replaceWildcards(args: string[]): RadonOperator {
        if (args.length < this.argsCount()) {
            throw EvalError(`Insufficent args were provided (${args.length} < ${this.argsCount()})`)
        }
        return new RadonOperator(
            this.opcode, 
            this.params?.map(param => {
                if (typeof param === 'string') {
                    return helpers.replaceWildcards(param, args)
                } else if (typeof param === 'object') {
                    if (param instanceof RadonScript) {
                        return param.replaceWildcards(...args)
                    } else {
                        return helpers.replaceWildcards(param, args)
                    }
                } else {
                    return param
                }
            }), 
            this?.prev?.replaceWildcards(args)
        )
    }
    public spliceWildcard(argIndex: number, argValue: string): RadonOperator {
        return new RadonOperator(
            this.opcode,
            this.params?.map(param => {
                if (typeof param === 'string') {
                    return helpers.spliceWildcard(param, argIndex, argValue, this.argsCount())
                } else if (typeof param === 'object' && param instanceof RadonScript) {
                    return param.spliceWildcard(argIndex, argValue)
                } else {
                    return param
                }
            }),
            this?.prev?.spliceWildcard(argIndex, argValue)
        )
    }
    public toString(left = "", indent = 4, level = 0): string { 
        const lf = left !== "" ? "\n" : ""
        let str = this?.prev?.toString(left, indent, level) || ""
        let methodName = RadonOperators[this.opcode].split(/(?=[A-Z])/).slice(1).join('')
        methodName = methodName.charAt(0).toLowerCase() + methodName.slice(1)
        str += `${left}${" ".repeat(indent * level)}.${methodName}(`
        if (this.params && this.params[0] !== undefined) { 
            this.params.forEach(param => {
                if (typeof param === 'string') {
                    str += `"${param}", `
                } else if (typeof param === 'object' && param instanceof RadonScript) {
                    str += `${param.toString(left, indent, level + 1)}${left}${" ".repeat(indent * level)}, `
                } else {
                    str += param.toString() + ", "
                }
            })
            str = str.slice(0, -2)
        }
        str += `)${lf}`
        return str
    }
}

export class RadonScript {
    protected readonly ops?: RadonOperator;
    public readonly inputType?: RadonAny;
    public readonly outputType?: RadonAny;
    constructor (output: RadonAny) {
        this.ops = output?.prev;
        const radonTypes = {
            "Array": RadonArray,
            "Boolean": RadonBoolean,
            "Bytes": RadonBytes,
            "Float": RadonFloat,
            "Integer": RadonInteger,
            "Map": RadonMap,
            "String": RadonString,
        }
        let input = output?.prev
        while (input?.prev) input = input?.prev
        const inputType = Object.entries(radonTypes).find(([prefix, _]) => input && RadonOperators[input.opcode].startsWith(prefix))
        if (inputType && inputType[1]) this.inputType = new inputType[1]()
        const outputType = Object.values(radonTypes).find(outputType => output instanceof outputType);
        if (outputType) this.outputType = new outputType()
    }
    public argsCount(): number {
        return this.ops?.argsCount() || 0;
    }
    public clone(): RadonAny {
        const OutputType = [
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString,
        ].find(OutputType => this.outputType instanceof OutputType);
        if (OutputType) {
            return new OutputType(this.ops?.prev)
        } else {
            throw EvalError(`Cannot clone from empty script`)
        }
    }
    public disect(level = 0): [number, string, string][] {
        return this.ops?.disect(level) || [[level, "RadonAny", ""]]
    }
    public encode(): any[] {
        return this.ops?.encode() || [];
    }
    public replaceWildcards(...args: string[]): RadonAny {
        const OutputType = [
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString,
        ].find(OutputType => this.outputType instanceof OutputType);
        if (OutputType) {
            return new OutputType(this.ops?.replaceWildcards(args))
        } else {
            throw EvalError(`Cannot replace wildcards on empty script`)
        }
    }
    public spliceWildcard(argIndex: number, argValue: string): RadonAny {
        const OutputType = [
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString,
        ].find(OutputType => this.outputType instanceof OutputType);
        if (OutputType) {
            return new OutputType(this.ops?.spliceWildcard(argIndex, argValue))
        } else {
            throw EvalError(`Cannot splice wildcards on empty script`)
        }
    }
    public toBytecode(): string {
        return Utils.toHexString(Object.values(Uint8Array.from(cborEncode(this.encode()))), true)
    }
    public toString(left = "", indent = 0, level = 0): string {
        const lf = left !== "" ? "\n" : ""
        return `RadonOperator(${this.inputType?.constructor.name || ""})${lf}${this.ops?.toString(left, indent, level + 1)}`
    }
}

export abstract class RadonAny extends RadonClass {
    protected _pushOperator<OutputType extends RadonAny>(
        outputType: { new(ops?: RadonOperator): OutputType; }, 
        params: any[],
    ): OutputType {
        let name
        try {
            throw new Error();
        } catch (err) {
            const result = (err as Error)
            name = result.stack?.split(' at ')[2]
                .split(' ')[0]
                .split('.')
                .map(part => helpers.toUpperCamelCase(part))
                .join('')
                .split(/(?=[A-Z])/).slice(1)
                .join('')
        }
        const opcode = RadonOperators[name as keyof typeof RadonOperators]
        if (!opcode) {
            throw Error(`Fatal: unknown Radon Operator opcode '${name}'`)
        } else {
            return new outputType(new RadonOperator(
                opcode, 
                [...params], 
                this?.prev
            ))
        }
    }
}

export interface RadonArray<ItemsType extends RadonAny> {
    itemsType: ItemsType;
}

export class RadonArray<ItemsType extends RadonAny = RadonAny> extends RadonAny {
    /**
     * Discard the items in the input array that make the given `innerScript` to return a `false` value. 
     * @param script Filtering script ultimately returning a `RadonBoolean` object.
     * Must accept as input the same data types as the ones of the items being iterated. 
     * @returns A `RadonArray` object containing only the items that make the `innerScript` to return a `true` value. 
     */
    public filter(innerScript: RadonBoolean) {
        if (!(innerScript instanceof RadonBoolean)) {
            throw new EvalError(`Inner script must fetch a RadonBoolean value`)
        } 
        return this._pushOperator(RadonArray<ItemsType>, [new RadonScript(innerScript)])
    }
    /**
     * Fetch the item at the given `index` as a `RadonArray` object.
     * @param index 
     */
    public getArray<SubItemsType extends RadonAny = RadonAny>(index: number) {
        return this._pushOperator(RadonArray<SubItemsType>, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonBoolean` object.
     * @param index 
     */
    public getBoolean(index: number) {
        return this._pushOperator(RadonBoolean, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonBytes` object.
     * @param index 
     */
    public getBytes(index: number) {
        return this._pushOperator(RadonBytes, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonFloat` object.
     * @param index 
     */
    public getFloat(index: number) {
        return this._pushOperator(RadonFloat, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonInteger` object.
     * @param index 
     */
    public getInteger(index: number) {
        return this._pushOperator(RadonInteger, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonMap` object.
     * @param index 
     */
    public getMap(index: number) {
        return this._pushOperator(RadonMap, [index])
    }
    /**
     * Fetch the item at the given `index` as a `RadonString` object.
     * @param index 
     */
    public getString(index: number) {
        return this._pushOperator(RadonString, [index])
    }
    /**
     * Join all items of the array into a value of the given type. The array must be homogeneous, 
     * all items being of the same type as the outputType`, if specified, or the Array's itemsType otherwise.
     * @param separator Separator to be used when joining strings. When joining RadonMaps, it can be used to settle base schema on resulting object.
     * @param outputType Radon type of the output value. 
     */
    // public join<OutputType extends RadonAny = RadonAny>(separator = "", outputType?: { new(): ItemsType; }) {
    //     if (outputType) this._pushOperator(RadonArray<OutputType>, [separator])
    //     else this._pushOperator(RadonArray<ItemsType>, [separator])
    // }
    /**
     * Count the number of items. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Map all items in the array with the given `innerScript`. 
     * @param innerScript Mapping script returning some `RadonAny` object.
     * Must accept as input the same data type as the one of the items being iterated. 
     * @returns A `RadonArray` object containing the mapped values. 
     */
    public map(innerScript: RadonOperator) {
        return this._pushOperator(RadonArray, [innerScript])
    }
    // public map<OutputItemsType extends RadonAny>(innerScript: RadonOperator<OutputItemsType>) {
    //     // todo: check script's input type matches array's items type, if any ??
    //     return this._pushOperator(RadonArray<OutputItemsType>, [innerScript])
    // }
    /**
     * Reduce all items in the array into a single value.
     * @param reductor The reductor method to be applied. All array items must be 
     * convertable into float values.
     * @returns A `RadonFloat` object.
     */
    public reduce(reductor: RadonReducerOpcodes) {
        return this._pushOperator(RadonFloat, [reductor])
    }
    /**
     * Order the array items based either on the results of applying the given `innerScript` to every item, or on the 
     * actual item values (as long as these are either integers or strings).
     * Fails if applied on non-homegenous arrays (i.e. not all items sharing the same `RadonAny`). 
     * @param innerScript (Optional) Sorting script returning either a `RadonInteger` or a `RadonString` object.
     * @returns A `RadonArray` object.
     */
    public sort(innerScript?: RadonOperator) {
        return this._pushOperator(RadonArray<ItemsType>, [innerScript])
    }
    /**
     * Take a selection of items from the input array.
     * @param indexes Indexes of the input items to take into the output array. 
     * @return A `RadonArray` object.
     */
    // public pick(...indexes: number[]) {
    //     if (Array(indexes).length == 0) {
    //         throw new EvalError(`\x1b[1;33mRadonArray::pick: a non-empty array of numbers must be provided\x1b[0m`)
    //     }
    //     return this._pushOperator(RadonArray<ItemsType>, [...indexes])
    // }
}

export class RadonBoolean extends RadonAny {
    /**
     * Reverse value.
     * @returns A `RadonBoolean` object.
     */
    public negate() {
        return this._pushOperator(RadonBoolean, [])
    }
    /**
     * Cast value into a string. 
     * @returns A `RadonString` object.
     */
    public toString() {
        return this._pushOperator(RadonString, [])
    }
}

export class RadonBytes extends RadonAny {
    static readonly Encodings = RadonEncodings;
    static readonly Hashers = RadonHashFunctions;
    /**
     * Convert buffer into (big-endian) integer.
     * @returns A `RadonInteger` object.
     */
    public asInteger() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Apply the SHA2-256 hash function.
     * @returns A `RadonBytes` object.
     */
    public hash() {
        return this._pushOperator(RadonBytes, [RadonBytes.Hashers.SHA2_256])
    }
    /**
     * Count the number of bytes. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Returns a slice extracted from the input buffer. 
     * A `startIndex` of 0 refers to the beginning of the input buffer. If no `endIndex` is provided, it will be assumed 
     * the length of the input buffer. Negative values will be relative to the end of the input buffer.
     * @param startIndex Position within input buffer where the output buffer will start.
     * @param endIndex Position within input buffer where the output buffer will end
     * @returns A `RadonBytes` object.
     */
    public slice(startIndex: number = 0, endIndex?: number) {
        return this._pushOperator(RadonBytes, [startIndex, endIndex])
    }
    /**
     * Convert the input buffer into a string.
     * @param encoding Enum integer value specifying the encoding schema on the output string, standing:
     *   0 -> Hex string (default, if none was specified)
     *   1 -> Base64 string
     *   2 -> Utf-8 string
     * @returns A `RadonString` object.
     */
    public toString(encoding = RadonEncodings.HexString) {
        return this._pushOperator(RadonString, [encoding])
    }
}

export class RadonFloat extends RadonAny {
    /**
     * Compute the absolute value.
     * @returns A `RadonFloat` object.
     */
    public absolute() {
        return this._pushOperator(RadonFloat, [])
    }
    /**
     * Compute the lowest integer greater than or equal to the float value.
     * @returns A `RadonInteger` object. 
     */
    public ceiling() {
        return this._pushOperator(RadonFloat, [])

    }
    /**
     * Compute the greatest integer less than or equal to the float value.
     * @returns A `RadonInteger` object.
     */
    public floor() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Determine if the float value is greater than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public greaterThan(input: number | string) {
        return this._pushOperator(RadonBoolean, [input])
    }
    /**
     * Determine if the float value is less than the given `input`.
     * @param input 
     * @returns A `RadonBoolean` object.
     */
    public lessThan(input: number | string) {
        return this._pushOperator(RadonBoolean, [input])
    }
    /**
     * Compute the float remainder of dividing the value by the given `integer`.
     * @param integer 
     * @returns A `RadonFloat` object.
     */
    public modulo(integer: number | string) {
        return this._pushOperator(RadonFloat, [integer])
    }
    /**
     * Multiply the float value by the given `factor`.
     * @param factor 
     * @returns A `RadonFloat` object. 
     */
    public multiply(factor: number | string) {
        return this._pushOperator(RadonFloat, [factor])
    }
    /**
     * Negate the float value. 
     * @returns A `RadonFloat` object.
     */
    public negate() {
        return this._pushOperator(RadonFloat, [])
    }
    /**
     * Compute the float value raised to the power of given `exponent`
     * @param exponent
     * @returns A `RadonFloat` object.
     */
    public power(exponent: number | string) {
        return this._pushOperator(RadonFloat, [exponent])
    }
    /**
     * Round to the closest integer value.
     * @returns A `RadonInteger` object.
     */
    public round() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Stringify the float value.
     * @returns A `RadonString` object.
     */
    public toString() {
        return this._pushOperator(RadonString, [])
    }
    /**
     * Take the integer part of the float value. 
     * @returns A `RadonInteger` object.
     */
    public truncate() {
        return this._pushOperator(RadonInteger, [])
    }
}

export class RadonInteger extends RadonAny {
    /**
     * Compute the absolute value.
     * @returns A `RadonInteger` object.
     */
    public absolute() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Determine if the integer value is greater than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public greaterThan(input: number | string) {
        return this._pushOperator(RadonBoolean, [input])
    }
    /**
     * Determine if the integer value is less than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public lessThan(input: number | string) {
        return this._pushOperator(RadonBoolean, [input])
    }
    /**
     * Compute the remainder of dividing the value by the given `integer`.
     * @param integer 
     * @returns A `RadonFloat` object.
     */
    public modulo(integer: number | string) {
        return this._pushOperator(RadonInteger, [integer])
    }
    /**
     * Multiply the value by the given `integer`.
     * @param integer 
     * @returns A `RadonInteger` object. 
     */
    public multiply(integer: number | string) {
        return this._pushOperator(RadonInteger, [integer])
    }
    /**
     * Negate the integer value. 
     * @returns A `RadonFloat` object.
     */
    public negate() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Compute the value raised to the power of given `exponent`
     * @param exponent
     * @returns A `RadonInteger` object.
     */
    public power(exponent: number | string) {
        return this._pushOperator(RadonInteger, [exponent])
    }
    /**
     * Stringify the value.
     * @returns A `RadonString` object.
     */
    public toString() {
        return this._pushOperator(RadonString, [])
    }
    /**
     * Cast into a big-endian bytes buffer.
     * @returns A `RadonBytes` object.
     */
    public toBytes() {
        return this._pushOperator(RadonBytes, [])
    }
    /**
     * Cast into a float value.
     * @returns A `RadonFloat` object.
     */
    public toFloat() {
        return this._pushOperator(RadonFloat, [])
    }
}

export class RadonMap extends RadonAny {
    /**
     * Alter the value of the item(s) identified by `keys`, applying the given `innerScript` to each one of them.
     * @param keys  
     * @param innerScript 
     * @returns The same RadonMap upon which this operator is executed, with the specified item(s) altered
     * by the given `innerScript`.
     */
    public alter(innerScript: RadonOperator, ...keys: string[]) {
        return this._pushOperator(RadonMap, [[...keys], innerScript])
    }
    /**
     * Fetch the array within the specified `key` field.
     * @param key 
     * @returns A `RadonArray` object.
     */
    public getArray<ItemsType extends RadonAny = RadonAny>(key: string, _itemsType?: { new(): ItemsType; }) {
        return this._pushOperator(RadonArray<ItemsType>, [key])
    }
    /**
     * Fetch the boolean within the specified `key` field. 
     * @param key 
     * @returns A `RadonBoolean` object. 
     */
    public getBoolean(key: string) {
        return this._pushOperator(RadonBoolean, [key])
    }
    /**
     * Fetch the float value within the specified `key` field.
     * @param key 
     * @returns A `RadonFloat` object.
     */
    public getFloat(key: string) {
        return this._pushOperator(RadonFloat, [key])
    }
    /**
     * Fetch the integer value within the specified `key` field. 
     * @param key 
     * @returns A `RadonInteger` object.
     */
    public getInteger(key: string) {
        return this._pushOperator(RadonInteger, [key])
    }
    /**
     * Fetch the map object within the specified `key` field. 
     * @param key 
     * @returns A `RadonMap` object.
     */
    public getMap(key: string) {
        return this._pushOperator(RadonMap, [key])
    }
    /**
     * Fetch the string within the specified `key` field.
     * @param key 
     * @returns A `RadonString` object.
     */
    public getString(key: string) {
        return this._pushOperator(RadonString, [key])
    }
    /**
     * Extract key names of the map into an array of strings.
     * @returns A `RadonArray` object.
     */
    public keys() {
        return this._pushOperator(RadonArray<RadonString>, [])
    }
    /**
     * Take a selection of items from the input map. Fails if unexistent items are referred.
     * @param keys Key string of the input items to take into the output map. 
     * @return A `RadonMap` object.
     */
    public pick(...keys: string[]) {
        if (Array(keys).length == 0) {
            throw new EvalError(`\x1b[1;33mRadonMap::pick: a non-empty array of key strings must be provided\x1b[0m`)
        }
        return this._pushOperator(RadonMap, [...keys])

    }
    /**
     * Extract the map values into an array.
     * @returns A `RadonArray` object.
     */
    public values() {
        return this._pushOperator(RadonArray, [])
    }
    /**
     * Stringify input `RadonMap` object into a JSON string.
     * @return A `RadonString` object.
     */
    public toString() {
        return this._pushOperator(RadonString, [])
    }
}

export class RadonString extends RadonAny {
    /**
     * Cast into a boolean value.
     * @returns A `RadonBoolean` object.
     */
    public asBoolean() {
        return this._pushOperator(RadonBoolean, [])
    }
    /**
     * Convert the input string into a bytes buffer.
     * @param encoding Enum integer value specifying the encoding schema on the input string, standing:
     *   0 -> Hex string (default, if none was specified)
     *   1 -> Base64 string
     * @returns A `RadonBytes` object.
     */
    public asBytes(encoding = RadonEncodings.HexString) {
        return this._pushOperator(RadonBytes, [encoding])
    }
    /**
     * Cast into a float number.
     * @returns A `RadonFloat` object.
     */
    public asFloat() {
        return this._pushOperator(RadonFloat, [])
    }
    /**
     * Cast into an integer number.
     * @returns A `RadonInteger` object.
     */
    public asInteger() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Count the number of chars. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        return this._pushOperator(RadonInteger, [])
    }
    /**
     * Replace the string by a value of type `outputType`, determined on whether the string value matches 
     * any of the keys within the provided `matchingMap`, or set to a `defaultValue` if no match is found.
     * @param outputType Radon type of the output value. 
     * @param matchingMap Map determining the output value depending on the string value.
     * @param defaultValue Value returned if no match is found. 
     * @returns 
     */
    public match<OutputType extends RadonAny = RadonString>(
        outputType: { new(prev?: RadonOperator): OutputType; }, 
        matchingMap: Map<string, any>, 
        defaultValue: any
    ) {
        return this._pushOperator(outputType, [matchingMap, defaultValue])
        // this._bytecode = [ 
        //     0x75,  
        //     matchingMap,
        //     defaultValue
        // ]
        // this._method = "match"
        // this._params = `{ ${Object.entries(matchingMap).map((entry: [string, any]) => `\"${entry[0]}\": ${entry[1]}, `)}}, ${defaultValue}`
        // let keys: string = ""
        // Object.keys(matchingMap).map((key: string) => keys += key + ";")
        // return new outputType(this, keys)
    }
    /**
     * Parse input string as an array of JSON items. 
     * @param jsonPaths (optional) Array of JSON paths within input `RadonString` from where to fetch items that will be appended to the output `RadonArray`. 
     * @returns A `RadonArray` object.
     */
    public parseJSONArray(...jsonPaths: string[]): RadonArray<RadonAny> { 
        return this._pushOperator(RadonArray<RadonAny>, [...jsonPaths])
    }
    /**
     * Parse string as a JSON-encoded map. 
     * @param jsonPath (optional) JSON path within input `RadonString` from where to extract the output `RadonMap`. 
     * @returns A `RadonMap` object. 
     */
    public parseJSONMap(jsonPath?: string) {
        return this._pushOperator(RadonMap, [jsonPath])
    }
    /**
     * Parse string as an XML-encoded map. 
     * @returns A `RadonMap` object.
     */
    public parseXMLMap() {
        return this._pushOperator(RadonMap, [])
    }
    /**
     * Replace with given `replacement` string, all parts of the input string that match with given regular expression. 
     * @param regex Regular expression to be matched.
     * @param replacement Text that will replace all occurences. 
     * @returns A `RadonString` object.
     */
    public replace(regex: string = "", replacement: string = "") {
        return this._pushOperator(RadonString, [regex, replacement])
    }
    /**
     * Returns a slice extracted from the input string. 
     * A `startIndex` of 0 refers to the beginning of the input string. If no `endIndex` is provided, it will be assumed 
     * the length of the input string. Negative values will be relative to the end of the input string.
     * @param startIndex Position within input string where the output string will start.
     * @param endIndex Position within input string where the output string will end.
     * @returns A `RadonString` object.
     */
    public slice(startIndex: number = 0, endIndex?: number) {
        return this._pushOperator(RadonString, [startIndex, endIndex])
    }
    /**
     * Divides input string into an array of substrings, 
     * @param regex The string or regular expression to use for splitting.
     * @returns A `RadonArray` object.
     */
    public split(regex: string = "\r") {
        return this._pushOperator(RadonArray<RadonString>, [regex])
    }
    /**
     * Lower case all characters.
     * @returns A `RadonString` object.
     */
    public toLowercase() {
        return this._pushOperator(RadonString, [])
    }
    /**
     * Upper case all characters.
     * @returns A `RadonString` object.
     */
    public toUpperCase() {
        return this._pushOperator(RadonString, [])
    }
}
