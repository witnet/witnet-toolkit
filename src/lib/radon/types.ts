const cbor = require("cbor")
const helpers = require('./helpers')

import { Opcodes as RedonReducerOpcodes } from './reducers'
import * as Utils from '../../utils'

enum RadonBytesEncodings {
    HexString = 0,
    Base64 = 1,
}

export enum RadonOperators {
    ArrayLength = 0x10,
    ArrayFilter = 0x11,
    ArrayJoin = 0x12,
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
    ArrayPick = 0x1e,
    BooleanStringify = 0x20,
    BooleanNegate = 0x22,
    BytesStringify = 0x30,
    BytesHash = 0x31,
    BytesAsInteger = 0x32,
    BytesLength = 0x34,
    BytesSlice = 0x3c,
    FloatAbsolute = 0x50,
    FloatStringify = 0x51,
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
    IntegerStringify = 0x42,
    IntegerGreaterThan = 0x43,
    IntegerLessThan = 0x44,
    IntegerModulo = 0x46,
    IntegerMultiply = 0x47,
    IntegerNegate = 0x48,
    IntegerPower = 0x49,
    IntegerToBytes = 0x4a,
    MapStringify = 0x60,
    MapGetArray = 0x61,
    MapGetBoolean = 0x62,
    MapGetFloat = 0x64,
    MapGetInteger = 0x65,
    MapGetMap = 0x66,
    MapGetString = 0x67,
    MapKeys = 0x68,
    MapValued = 0x69,
    MapAlter = 0x6b,
    MapPick = 0x6e,   
    StringAsBoolean = 0x70,
    StringAsBytes = 0x71,
    StringAsFloat = 0x72,
    StringLength = 0x74,
    StringMatch = 0x75,
    StringParseJSONArray = 0x76,
    StringParseJSONMap = 0x77,
    StringParseXMLMap = 0x78,
    StringToLowerCase = 0x79,
    StringToUppserCase = 0x7a,
    StringParseReplace = 0x7b,
    StringParseSlice = 0x7c,
    StringParseSplit = 0x7d,
}

export class RadonType {
    public static from(hexString: string) {
        return Utils.decodeScript(hexString)
    }
    
    protected _bytecode?: any; 
    protected _key?: string;
    protected _prev?: RadonType;
    protected _method?: string;
    protected _params?: any;
    constructor (prev?: RadonType, key?: string) {
        this._key = key
        this._prev = prev
        Object.defineProperty(this, "argsCount", { value: () => {
            return Math.max(
                helpers.getWildcardsCountFromString(key),
                prev?._countWildcards() || 0
            )   
        }})
        Object.defineProperty(this, "toArray", { value: () => {
            let _result = this._bytecode ? [ this._bytecode ] : []
            if (this._prev !== undefined) _result = Object(this._prev).toArray().concat(_result)
            return _result
        }})
        Object.defineProperty(this, "toBytecode", { value: () => {
            let _array = Object(this).toArray()
            return Utils.toHexString(Object.values(Uint8Array.from(cbor.encode(_array))))
        }})
        Object.defineProperty(this, "toString", { value: () => {
            let _result
            if (this._method) _result = `${this._method}(${this._params !== undefined ? this._params : ""})`
            if (this._prev) _result = `${this._prev.toString()}${_result ? `.${_result}` : ""}`
            return _result
        }})
    }
    protected _set(bytecode?: any, method?: string, params?: any) {
        this._bytecode = bytecode
        this._method = method
        this._params = params
    }
    /**
     * (Compilation time only) Returns the maximum index from all wildcarded arguments refered at any step of the script, plus 1.
     * @returns 0 if the script refers no wildcarded argument at all.
     */
    public _countWildcards(): number {
        return Math.max(
            helpers.getWildcardsCountFromString(this?._key),
            this._prev?._countWildcards() || 0
        );
    }
    /**
     * (Compilation time only) Encodes the script into an array of array of opcodes and values.
     */
    public _encodeArray(): any[] {
        let _result = this._bytecode ? [ this._bytecode ] : []
        if (this._prev !== undefined) _result = this._prev._encodeArray().concat(_result)
        return _result
    }
    /**
     * (Compilation time only) Clone the script and replace indexed wildcards
     * with given parameters. Fails if less values than indexed wildcards are provided.
     */
    public _replaceWildcards(args: string[]): RadonType {
        const RadonClass = [ 
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString
        ].find(RadonClass => this instanceof RadonClass) || RadonType;
        if (args.length < this._countWildcards()) {
            throw EvalError(`\x1b[1;33m${RadonClass}: insufficient args were provided (${args.length} < ${this._countWildcards()})\x1b[0m`)
        }
        const spliced = new RadonClass(this._prev?._replaceWildcards(args), this._key);  
        spliced._set(
            helpers.replaceWildcards(this._bytecode, args), 
            this._method, 
            helpers.replaceWildcards(this._params, args),
        )
        return spliced
    }
    
    /**
     * (Compilation time only) Clone the script and replace all occurences of the 
     * specified argument index by the given value. All wildcards with a higher
     * index will be decreased by one in the new script.
     */
    _spliceWildcard(argIndex: number, argValue: string): RadonType {
        const RadonClass = [ 
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString
        ].find(RadonClass => this instanceof RadonClass) || RadonType;
        const argsCount: number = this._countWildcards()
        const spliced = new RadonClass(this._prev?._spliceWildcard(argIndex, argValue), this._key);  
        spliced._set(
            helpers.spliceWildcard(this._bytecode, argIndex, argValue, argsCount), 
            this._method, 
            helpers.spliceWildcard(this._params, argIndex, argValue, argsCount)
        )
        return spliced
    }
}

export class RadonArray extends RadonType {
    /**
     * Discard the items in the input array that make the given `innerScript` to return a `false` value. 
     * @param innerScript Filtering script ultimately returning a `RadonBoolean` object.
     * Must accept as input the same data types as the ones of the items being iterated. 
     * @returns A `RadonArray` object containing only the items that make the `innerScript` to return a `true` value. 
     */
    public filter(innerScript: RadonType) {
        if (!(innerScript instanceof RadonBoolean)) {
            throw new EvalError(`\x1b[1;33mRadonArray::filter: inner script returns no RadonBoolean object\x1b[0m`)
        }
        this._bytecode = [ 0x11, innerScript._encodeArray() ]
        this._method = "filter"
        this._params = innerScript.toString()
        return new RadonArray(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonArray` object.
     * @param index 
     */
    public getArray(index: number) {
        this._bytecode = [ 0x13, index ]
        this._method = "getArray"
        this._params = index
        return new RadonArray(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonBoolean` object.
     * @param index 
     */
    public getBoolean(index: number) {
        this._bytecode = [ 0x14, index ]
        this._method = "getBoolean"
        this._params = index
        return new RadonBoolean(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonBytes` object.
     * @param index 
     */
    public getBytes(index: number) {
        this._bytecode = [ 0x15, index ]
        this._method = "getBytes"
        this._params = index
        return new RadonBytes(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonFloat` object.
     * @param index 
     */
    public getFloat(index: number) {
        this._bytecode = [ 0x16, index ]
        this._method = "getFloat"
        this._params = index
        return new RadonFloat(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonInteger` object.
     * @param index 
     */
    public getInteger(index: number) {
        this._bytecode = [ 0x17, index ]
        this._method = "getInteger"
        this._params = index
        return new RadonInteger(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonMap` object.
     * @param index 
     */
    public getMap(index: number) {
        this._bytecode = [ 0x18, index ]
        this._method = "getMap"
        this._params = index
        return new RadonMap(this)
    }
    /**
     * Fetch the item at the given `index` as a `RadonString` object.
     * @param index 
     */
    public getString(index: number) {
        this._bytecode = [ 0x19, index ]
        this._method = "getString"
        this._params = index
        return new RadonString(this)
    }
    /**
     * Join all items of the array into a value of the given type. The array must be homogeneous, 
     * all items being of the same type as the expected `outputType`. 
     * @param outputType Radon type of the output value. 
     * @param separator Separator to be used when joining strings. When joining RadonMaps, it can be used to settle base schema on resulting object.
     */
    public join<T extends RadonType>(
        outputType: { new(prev?: RadonType, key?: string): T; }, 
        separator?: string,
    ) {
        if (separator && typeof separator === 'string') {
            this._bytecode = [ 0x12, separator, ]
        } else {
            this._bytecode = 0x12
        }
        this._method = "join"
        this._params = `${separator && separator !== "" ? `"${separator}"`: `""`}`
        return new outputType(this)
    }
    /**
     * Count the number of items. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        this._bytecode = 0x10
        this._method = "length"
        return new RadonInteger(this)
    }
    /**
     * Map all items in the array with the given `innerScript`. 
     * @param innerScript Mapping script returning some `RadonType` object.
     * Must accept as input the same data type as the one of the items being iterated. 
     * @returns A `RadonArray` object containing the mapped values. 
     */
    public map(innerScript: RadonType) {
        this._bytecode = [ 0x1A, innerScript._encodeArray() ]
        this._method = "map"
        this._params = innerScript.toString()
        return new RadonArray(this)
    }
    /**
     * Reduce all items in the array into a single value.
     * @param reductor The reductor method to be applied. All array items must be 
     * convertable into float values.
     * @returns A `RadonFloat` object.
     */
    public reduce(reductor: RedonReducerOpcodes) {
        this._bytecode = [ 0x1B, reductor ]
        this._method = "reduce"
        this._params = RedonReducerOpcodes[reductor]
        return new RadonFloat(this)
    }
    /**
     * Order the array items based either on the results of applying the given `innerScript` to every item, or on the 
     * actual item values (as long as these are either integers or strings).
     * Fails if applied on non-homegenous arrays (i.e. not all items sharing the same `RadonType`). 
     * @param innerScript (Optional) Sorting script returning either a `RadonInteger` or a `RadonString` object.
     * @returns A `RadonArray` object.
     */
    public sort(innerScript?: RadonType) {
        if (!(innerScript instanceof RadonInteger) && !(innerScript instanceof RadonString)) {
            throw new EvalError(`\x1b[1;33mRadonArray::sort: inner script returns neither a RadonInteger nor a RadonString object\x1b[0m`)
        }
        if (innerScript) {
            this._bytecode = [ 0x1d, innerScript._encodeArray() ]
            this._params = innerScript.toString()
        } else {
            this._bytecode = [ 0x1d, [] ]
        }
        this._method = "sort"
        return new RadonArray(this)
    }
    /**
     * Take a selection of items from the input array.
     * @param indexes Indexes of the input items to take into the output array. 
     * @return A `RadonArray` object.
     */
    public pick(...indexes: number[]) {
        if (Array(indexes).length == 0) {
            throw new EvalError(`\x1b[1;33mRadonArray::pick: a non-empty array of numbers must be provided\x1b[0m`)
        }
        this._bytecode = [ 0x1e, ...indexes ]
        this._params = JSON.stringify(indexes)
        this._method = "pick"
        return new RadonArray(this)
    }
}

export class RadonBoolean extends RadonType {
    /**
     * Reverse value.
     * @returns A `RadonBoolean` object.
     */
    public negate() {
        this._bytecode = 0x22
        this._method = "negate"
        return new RadonBoolean(this)
    }
    /**
     * Cast value into a string. 
     * @returns A `RadonString` object.
     */
    public stringify() {
            this._bytecode = 0x20
        this._method = "stringify"
        return new RadonString(this)
    }
}

export class RadonBytes extends RadonType {
    static readonly Encodings = RadonBytesEncodings;
    /**
     * Convert buffer into (big-endian) integer.
     * @returns A `RadonBytes` object.
     */
    public asInteger() {
        this._bytecode = 0x32
        this._method = "toInteger"
        return new RadonInteger(this)
    }
    /**
     * Apply the SHA2-256 hash function.
     * @returns A `RadonBytes` object.
     */
    public hash() {
        this._bytecode = [ 0x31, 0x0A ]
        this._method = "hash"
        return new RadonBytes(this)
    }
    /**
     * Count the number of bytes. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        this._bytecode = 0x34
        this._method = "length"
        return new RadonInteger(this)
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
        if (endIndex !== undefined) {
            this._bytecode = [ 0x3c, startIndex, endIndex ]
            this._params = `${startIndex}, ${endIndex}`
        } else {
            this._bytecode = [ 0x3c, startIndex ]
            this._params = `${startIndex}`
        }
        this._method = "slice"
        return new RadonBytes(this)
    }
    /**
     * Convert the input buffer into a string.
     * @param encoding Enum integer value specifying the encoding schema on the output string, standing:
     *   0 -> Hex string (default, if none was specified)
     *   1 -> Base64 string
     * @returns A `RadonString` object.
     */
    public stringify(encoding?: RadonBytesEncodings) {
        if (encoding) {
            this._bytecode = [ 0x30, encoding ]
            this._params = `${RadonBytesEncodings[encoding]}`
        } else {
            this._bytecode = 0x30
        }
        this._method = "stringify"
        return new RadonString(this)
    }
}

export class RadonFloat extends RadonType {
    /**
     * Compute the absolute value.
     * @returns A `RadonFloat` object.
     */
    public absolute() {
        this._bytecode = 0x50
        this._method = "absolute"
        return new RadonFloat(this)
    }
    /**
     * Compute the lowest integer greater than or equal to the float value.
     * @returns A `RadonInteger` object. 
     */
    public ceiling() {
        this._bytecode = 0x52
        this._method = "ceiling"
        return new RadonInteger(this)
    }
    /**
     * Compute the greatest integer less than or equal to the float value.
     * @returns A `RadonInteger` object.
     */
    public floor() {
        this._bytecode = 0x54
        this._method = "floor"
        return new RadonInteger(this)
    }
    /**
     * Determine if the float value is greater than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public greaterThan(input: number | string) {
        this._bytecode = [ 0x53, input ]
        this._method = "greaterThan"
        this._params = typeof input === 'string' ? `'${input}'` : input
        return new RadonBoolean(this)
    }
    /**
     * Determine if the float value is less than the given `input`.
     * @param input 
     * @returns A `RadonBoolen` object.
     */
    public lessThan(input: number | string) {
        this._bytecode = [ 0x55, input ]
        this._method = "lessThan"
        this._params = typeof input === 'string' ? `'${input}'` : input
        return new RadonBoolean(this)
    }
    /**
     * Compute the float remainder of dividing the value by the given `integer`.
     * @param integer 
     * @returns A `RadonFloat` object.
     */
    public modulo(integer: number | string) {
        this._bytecode = [ 0x56, integer ]
        this._method = "modulo"
        this._params = typeof integer === 'string' ? `'${integer}'` : integer
        return new RadonFloat(this)
    }
    /**
     * Multiply the float value by the given `factor`.
     * @param factor 
     * @returns A `RadonFloat` object. 
     */
    public multiply(factor: number | string) {
        this._bytecode = [ 0x57, factor ]
        this._method = "multiply"
        this._params = typeof factor === 'string' ? `'${factor}'` : factor
        return new RadonFloat(this)
    }
    /**
     * Negate the float value. 
     * @returns A `RadonFloat` object.
     */
    public negate() {
        this._bytecode = 0x58
        this._method = "negate"
        return new RadonFloat(this)
    }
    /**
     * Compute the float value raised to the power of given `exponent`
     * @param exponent
     * @returns A `RadonFloat` object.
     */
    public power(exponent: number | string) {
        this._bytecode = [ 0x59, exponent ]
        this._method = "power"
        this._params = typeof exponent === 'string' ? `'${exponent}'` : exponent
        return new RadonFloat(this)
    }
    /**
     * Round to the closest integer value.
     * @returns A `RadonInteger` object.
     */
    public round() {
        this._bytecode = 0x5b
        this._method = "round"
        return new RadonInteger(this)
    }
    /**
     * Stringify the float value.
     * @returns A `RadonString` object.
     */
    public stringify() {
        this._bytecode = 0x51
        this._method = "stringify"
        return new RadonString(this)
    }
    /**
     * Take the integer part of the float value. 
     * @returns A `RadonInteger` object.
     */
    public truncate() {
        this._bytecode = 0x5d
        this._method = "truncate"
        return new RadonInteger(this)
    }
}

export class RadonInteger extends RadonType {
    /**
     * Compute the absolute value.
     * @returns A `RadonInteger` object.
     */
    public absolute() {
        this._bytecode = 0x40
        this._method = "absolute"
        return new RadonInteger(this)
    }
    /**
     * Determine if the integer value is greater than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public greaterThan(input: number | string) {
        this._bytecode = [ 0x43, input ]
        this._method = "greaterThan"
        this._params = typeof input === 'string' ? `'${input}'` : input
        return new RadonBoolean(this)
    }
    /**
     * Determine if the integer value is less than the given `input`. 
     * @param input
     * @returns A `RadonBoolean` object.
     */
    public lessThan(input: number | string) {
        this._bytecode = [ 0x44, input ]
        this._method = "lessThan"
        this._params = typeof input === 'string' ? `'${input}'` : input
        return new RadonBoolean(this)
    }
    /**
     * Compute the remainder of dividing the value by the given `integer`.
     * @param integer 
     * @returns A `RadonFloat` object.
     */
    public modulo(integer: number | string) {
        this._bytecode = [ 0x46, integer ]
        this._method = "modulo"
        this._params = typeof integer === 'string' ? `'${integer}'` : integer
        return new RadonInteger(this)
    }
    /**
     * Multiply the value by the given `integer`.
     * @param integer 
     * @returns A `RadonInteger` object. 
     */
    public multiply(integer: number | string) {
        this._bytecode = [ 0x47, integer ]
        this._method = "multiply"
        this._params = typeof integer === 'string' ? `'${integer}'` : integer
        return new RadonInteger(this)
    }
    /**
     * Negate the integer value. 
     * @returns A `RadonFloat` object.
     */
    public negate() {
        this._bytecode = 0x48
        this._method = "negate"
        return new RadonInteger(this)
    }
    /**
     * Compute the value raised to the power of given `exponent`
     * @param exponent
     * @returns A `RadonInteger` object.
     */
    public power(value: number | string) {
        this._bytecode = [ 0x49, value ]
        this._method = "power"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonInteger(this); 
    }
    /**
     * Stringify the value.
     * @returns A `RadonString` object.
     */
    public stringify() {
        this._bytecode = 0x42
        this._method = "stringify"
        return new RadonString(this)
    }
    /**
     * Cast into a big-endian bytes buffer.
     * @returns A `RadonBytes` object.
     */
    public toBytes() {
        this._bytecode = 0x4A
        this._method = "toBytes"
        return new RadonBytes(this)
    }
    /**
     * Cast into a float value.
     * @returns A `RadonFloat` object.
     */
    public toFloat() {
        this._bytecode = 0x41
        this._method = "toFloat"
        return new RadonFloat(this)
    }
}

export class RadonMap extends RadonType {
    /**
     * Alter the value of the item(s) identified by `keys`, applying the given `innerScript` to each one of them.
     * @param key 
     * @param innerScript 
     * @returns The same RadonMap upon which this operator is executed, with the specified item(s) altered
     * by the given `innerScript`.
     */
    public alter(innerScript: RadonType, ...keys: string[])  {
        const RadonClass = [ 
            RadonArray,
            RadonBoolean,
            RadonBytes,
            RadonFloat,
            RadonInteger,
            RadonMap,
            RadonString,
            RadonType,
        ].find(RadonClass => innerScript instanceof RadonClass) || undefined;
        if (!RadonClass || RadonClass instanceof RadonType) {
            throw new EvalError(`\x1b[1;33mRadonMap::alter: passed inner script is not valid\x1b[0m`)
        }
        this._bytecode = [ 0x6b, innerScript._encodeArray(), ...keys ]
        this._method = "alter"
        this._params = `{ ${innerScript.toString()}${keys.length > 0 ? `, ${JSON.stringify(keys).slice(1, -1)}` : ""} }`
        return new RadonMap(this)
    }
    /**
     * Fetch the array within the specified `key` field.
     * @param key 
     * @returns A `RadonArray` object.
     */
    public getArray(key: string) {
        this._bytecode = [ 0x61, key ]
        this._method = "getArray"
        this._params = `'${key}'`
        return new RadonArray(this, key)
    }
    /**
     * Fetch the boolean within the specified `key` field. 
     * @param key 
     * @returns A `RadonBoolean` object. 
     */
    public getBoolean(key: string) {
        this._bytecode = [ 0x62, key ]
        this._method = "getBoolean"
        this._params = `'${key}'`
        return new RadonBoolean(this, key)
    }
    /**
     * Fetch the float value within the specified `key` field.
     * @param key 
     * @returns A `RadonFloat` object.
     */
    public getFloat(key: string) {
        this._bytecode = [ 0x64, key ]
        this._method = "getFloat"
        this._params = `'${key}'`
        return new RadonFloat(this, key)
    }
    /**
     * Fetch the integer value within the specified `key` field. 
     * @param key 
     * @returns A `RadonInteger` object.
     */
    public getInteger(key: string) {
        this._bytecode = [ 0x65, key ]
        this._method = "getInteger"
        this._params = `'${key}'`
        return new RadonInteger(this, key)
    }
    /**
     * Fetch the map object within the specified `key` field. 
     * @param key 
     * @returns A `RadonMap` object.
     */
    public getMap(key: string) {
        this._bytecode = [ 0x66, key ]
        this._method = "getMap"
        this._params = `'${key}'`
        return new RadonMap(this, key)
    }
    /**
     * Fetch the string within the specified `key` field.
     * @param key 
     * @returns A `RadonString` object.
     */
    public getString(key: string) {
        this._bytecode = [ 0x67, key ]
        this._method = "getString"
        this._params = `'${key}'`
        return new RadonString(this, key)
    }
    /**
     * Extract key names of the map into an array of strings.
     * @returns A `RadonArray` object.
     */
    public keys() {
        this._bytecode = 0x68
        this._method = "keys"
        return new RadonArray(this)
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
        this._bytecode = [ 0x6e, ...keys ]
        this._params = JSON.stringify(keys)
        this._method = "pick"
        return new RadonMap(this)
    }
    /**
     * Extract the map values into an array.
     * @returns A `RadonArray` object.
     */
    public values() {
        this._bytecode = 0x69
        this._method = "values"
        return new RadonArray(this)
    }
    /**
     * Stringify input `RadonMap` object into a JSON string.
     * @return A `RadonString` object.
     */
    public stringify() {
        this._bytecode = 0x60
        this._method = "stringify"
        return new RadonString(this)
    }
}

export class RadonString extends RadonType {
    /**
     * Cast into a boolean value.
     * @returns A `RadonBoolean` object.
     */
    public asBoolean() {
        this._bytecode = 0x70
        this._method = "asBoolean"
        return new RadonBoolean(this)
    }
    /**
     * Convert the input string into a bytes buffer.
     * @param encoding Enum integer value specifying the encoding schema on the input string, standing:
     *   0 -> Hex string (default, if none was specified)
     *   1 -> Base64 string
     * @returns A `RadonBytes` object.
     */
    public asBytes(encoding?: RadonBytesEncodings) {
        if (encoding !== undefined) {
            this._bytecode = [ 0x71, encoding ]
            this._params = `${RadonBytesEncodings[encoding]}`
        } else {
            this._bytecode = 0x71
        }
        this._method = "asBytes"
        return new RadonBytes(this)
    }
    /**
     * Cast into a float number.
     * @returns A `RadonFloat` object.
     */
    public asFloat() {
        this._bytecode = 0x72
        this._method = "asFloat"
        return new RadonFloat(this)
    }
    /**
     * Count the number of chars. 
     * @returns A `RadonInteger` object.
     */
    public length() {
        this._bytecode = 0x74
        this._method = "length"
        return new RadonInteger(this)
    }
    /**
     * Replace the string by a value of type `outputType`, determined on whether the string value matches 
     * any of the keys within the provided `matchingMap`, or set to a `defaultValue` if no match is found.
     * @param outputType Radon type of the output value. 
     * @param matchingMap Map determining the output value depending on the string value.
     * @param defaultValue Value returned if no match is found. 
     * @returns 
     */
    public match<T extends RadonType>(
        outputType: { new(prev?: RadonType, key?: string): T; }, 
        matchingMap: Map<string, any>, 
        defaultValue: any
    ) {
        this._bytecode = [ 
            0x75,  
            matchingMap,
            defaultValue
        ]
        this._method = "match"
        this._params = `{ ${Object.entries(matchingMap).map((entry: [string, any]) => `\"${entry[0]}\": ${entry[1]}, `)}}, ${defaultValue}`
        let keys: string = ""
        Object.keys(matchingMap).map((key: string) => keys += key + ";")
        return new outputType(this, keys)
    }
    /**
     * Parse input string as an array of JSON items. 
     * @param jsonPaths (optional) Array of JSON paths within input `RadonString` from where to fetch items that will be appended to the output `RadonArray`. 
     * @returns A `RadonArray` object.
     */
    public parseJSONArray(...jsonPaths: string[]) {
        if (jsonPaths.length > 0) {
            this._bytecode = [ 0x76, ...jsonPaths ]
            this._params = `${jsonPaths}`
        } else {
            this._bytecode = 0x76
        }
        this._method = "parseJsonArray"
        return new RadonArray(this)
    }
    /**
     * Parse string as a JSON-encoded map. 
     * @param jsonPath (optional) JSON path within input `RadonString` from where to extract the output `RadonMap`. 
     * @returns A `RadonMap` object. 
     */
    public parseJSONMap(jsonPath?: string) {
        if (jsonPath && jsonPath !== "") {
            this._bytecode = [ 0x77, jsonPath ]
            this._params = `${jsonPath}`
        } else {
            this._bytecode = 0x77
        }
        this._method = "parseJsonMap"
        return new RadonMap(this)
    }
    /**
     * Parse string as an XML-encoded map. 
     * @returns A `RadonMap` object.
     */
    public parseXMLMap() {
        this._bytecode = 0x78
        this._method = "parseXMLMap"
        return new RadonMap(this)
    }
    /**
     * Replace with given `replacement` string, all parts of the input string that match with given regular expression. 
     * @param regex Regular expression to be matched.
     * @param replacement Text that will replace all occurences. 
     * @returns A `RadonString` object.
     */
    public replace(regex: string = "", replacement: string = "") {
        this._bytecode = [
            0x7b,
            regex,
            replacement,
        ]
        this._method = "replace"
        this._params = `/${regex}/, "${replacement}"`
        return new RadonString(this)
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
        if (endIndex !== undefined) {
            this._bytecode = [ 0x7c, startIndex, endIndex ]
            this._params = `${startIndex}, ${endIndex}`
        } else {
            this._bytecode = [ 0x7c, startIndex ]
            this._params = `${startIndex}`
        }
        this._method = "slice"
        return new RadonString(this)
    }
    /**
     * Divides input string into an array of substrings, 
     * @param regex The string or regular expression to use for splitting.
     * @returns A `RadonArray` object.
     */
    public split(regex: string = "\r") {
        this._bytecode = [ 0x7d, regex ]
        this._params = `/${regex}/`
        this._method = "split"
        return new RadonArray(this)
    }
    /**
     * Lower case all characters.
     * @returns A `RadonString` object.
     */
    public toLowercase() {
        this._bytecode = 0x79
        this._method = "toLowercase"
        return new RadonString(this)
    }
    /**
     * Upper case all characters.
     * @returns A `RadonString` object.
     */
    public toUpperCase() {
        this._bytecode = 0x7a
        this._method = "toUpperCase"
        return new RadonString(this)
    }
}
