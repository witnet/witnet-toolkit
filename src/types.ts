import { getMaxArgsIndexFromString } from './utils'

export class Script {
    protected _bytecode?: any; 
    protected _key?: string;
    protected _prev?: Script;
    protected _method?: string;
    protected _params?: any;
    constructor (prev?: Script, key?: string) {
        this._key = key
        this._prev = prev
        Object.defineProperty(this, "toString", { value: () => {
            let _result
            if (this._method) _result = `${this._method}(${this._params !== undefined ? this._params : ""})`
            if (this._prev) _result = `${this._prev.toString()}${_result ? `.${_result}` : ""}`
            return _result
        }})
    }
    public _countArgs(): number {
        return getMaxArgsIndexFromString(this._key) + (this._prev?._countArgs() || 0)
    }
    public _encodeArray(): any[] {
        let _result = this._bytecode ? [ this._bytecode ] : []
        if (this._prev !== undefined) _result = this._prev._encodeArray().concat(_result)
        return _result
    }
}
export class Any extends Script {
    public identity() {
        this._bytecode = 0x00
        this._method = "identity"
        return new Any(this)
    }
}
export class Array<T1> extends Script {
    public filter(subscript: Script) {
        this._bytecode = [ 0x11, subscript.toString() ]
        this._method = "filter"
        this._params = subscript.toString()
        return new Array<T1>
    }
    public getArray<T>(index: number) {
        this._bytecode = [ 0x13, index ]
        this._method = "getArray"
        this._params = index
        return new Array<T>(this)
    }
    public getBoolean(index: number) {
        this._bytecode = [ 0x14, index ]
        this._method = "getBoolean"
        this._params = index
        return new Boolean(this)
    }
    public getBytes(index: number) {
        this._bytecode = [ 0x15, index ]
        this._method = "getBytes"
        this._params = index
        return new Bytes(this)
    }
    public getFloat(index: number) {
        this._bytecode = [ 0x16, index ]
        this._method = "getFloat"
        this._params = index
        return new Float(this)
    }
    public getInteger(index: number) {
        this._bytecode = [ 0x17, index ]
        this._method = "getInteger"
        this._params = index
        return new Integer(this)
    }
    public getMap(index: number) {
        this._bytecode = [ 0x18, index ]
        this._method = "getMap"
        this._params = index
        return new Map(this)
    }
    public getString(index: number) {
        this._bytecode = [ 0x19, index ]
        this._method = "getString"
        this._params = index
        return new String(this)
    }
    public length() {
        this._bytecode = 0x10
        this._method = "length"
        return new Integer(this)
    }
    // TODO: public map(...) {
    //     this._bytecode = ...
    //     ...
    // }
    // TODO: public reduce(...) {
    //     this._bytecode = ...
    //     ...
    // }
    public sort() {
        this._bytecode = 0x1d
        this._method = "sort"
        return new Array<T1>(this)
    }
}
export class Boolean extends Script {
    public asString() {
        this._bytecode = 0x20
        this._method = "asString"
        return new String(this)
    }
    public negate() {
        this._bytecode = 0x22
        this._method = "negate"
        return new Boolean(this)
    }
}
export class Bytes extends Script {
    public asString() {
        this._bytecode = 0x30
        this._method = "asString"
        return new String(this)
    }
    public hash() {
        this._bytecode = 0x31
        this._method = "hash"
        return new Bytes(this)
    }
}
export class Float extends Script {
    public absolute() {
        this._bytecode = 0x50
        this._method = "absolute"
        return new Float(this)
    }
    public asString() {
        this._bytecode = 0x51
        this._method = "asString"
        return new String(this)
    }
    public ceiling() {
        this._bytecode = 0x52
        this._method = "ceiling"
        return new Integer(this)
    }
    public floor() {
        this._bytecode = 0x54
        this._method = "floor"
        return new Integer(this)
    }
    public greaterThan(value: number | string) {
        this._bytecode = [ 0x53, value ]
        this._method = "greaterThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Boolean(this)
    }
    public lessThan(value: number | string) {
        this._bytecode = [ 0x55, value ]
        this._method = "lessThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Boolean(this)
    }
    public module(value: number | string) {
        this._bytecode = [ 0x56, value ]
        this._method = "module"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Float(this)
    }
    public multiply(value: number | string) {
        this._bytecode = [ 0x57, value ]
        this._method = "multiply"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Float(this)
    }
    public negate() {
        this._bytecode = 0x58
        this._method = "negate"
        return new Float(this)
    }
    public power(value: number | string) {
        this._bytecode = [ 0x59, value ]
        this._method = "power"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Float(this)
    }
    public round() {
        this._bytecode = 0x5b
        this._method = "round"
        return new Integer(this)
    }
    public truncate() {
        this._bytecode = 0x5d
        this._method = "truncate"
        return new Integer(this)
    }
}
export class Integer extends Script {
    public absolute() {
        this._bytecode = 0x40
        this._method = "absolute"
        return new Integer(this)
    }
    public asFloat() {
        this._bytecode = 0x41
        this._method = "asFloat"
        return new Float(this)
    }
    public asString() {
        this._bytecode = 0x42
        this._method = "asString"
        return new String(this)
    }
    public greaterThan(value: number | string) {
        this._bytecode = [ 0x43, value ]
        this._method = "greaterThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Boolean(this)
    }
    public lessThan(value: number | string) {
        this._bytecode = [ 0x44, value ]
        this._method = "lessThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Boolean(this)
    }
    public modulo(value: number | string) {
        this._bytecode = [ 0x46, value ]
        this._method = "modulo"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Integer(this)
    }
    public multiply(value: number | string) {
        this._bytecode = [ 0x47, value ]
        this._method = "multiply"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Integer(this)
    }
    public negate() {
        this._bytecode = 0x48
        this._method = "negate"
        return new Integer(this)
    }
    public power(value: number | string) {
        this._bytecode = [ 0x49, value ]
        this._method = "power"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new Integer(this); 
    }
}
export class Map extends Script {
    public getArray(key: string) {
        this._bytecode = [ 0x61, key ]
        this._method = "getArray"
        this._params = `'${key}'`
        return new Array<Any>(this, key)
    }
    public getBoolean(key: string) {
        this._bytecode = [ 0x62, key ]
        this._method = "getBoolean"
        this._params = `'${key}'`
        return new Boolean(this, key)
    }
    public getBytes(key: string) {
        this._bytecode = [ 0x63, key ]
        this._method = "getBytes"
        this._params = `'${key}'`
        return new Bytes(this, key)
    }
    public getFloat(key: string) {
        this._bytecode = [ 0x64, key ]
        this._method = "getFloat"
        this._params = `'${key}'`
        return new Float(this, key)
    }
    public getInteger(key: string) {
        this._bytecode = [ 0x65, key ]
        this._method = "getInteger"
        this._params = `'${key}'`
        return new Integer(this, key)
    }
    public getMap(key: string) {
        this._bytecode = [ 0x66, key ]
        this._method = "getMap"
        this._params = `'${key}'`
        return new Map(this, key)
    }
    public getString(key: string) {
        this._bytecode = [ 0x67, key ]
        this._method = "getString"
        this._params = `'${key}'`
        return new String(this, key)
    }
    public keys(key: string) {
        this._bytecode = [ 0x68, key ]
        this._method = "keys"
        this._params = `'${key}'`
        return new Array<String>(this, key)
    }
    public values(key: string) {
        this._bytecode = [ 0x69, key ]
        this._method = "values"
        this._params = `'${key}'`
        return new Array<Array<any>>(this, key)
    }
}
export class String extends Script {
    public asBoolean() {
        this._bytecode = 0x70
        this._method = "asBoolean"
        return new Boolean(this)
    }
    public asFloat() {
        this._bytecode = 0x72
        this._method = "asFloat"
        return new Float(this)
    }
    public length() {
        this._bytecode = 0x74
        this._method = "length"
        return new Integer(this)
    }
    public parseJSONArray() {
        this._bytecode = 0x76
        this._method = "parseJSONArray"
        return new Array(this)
    }
    public parseJSONMap() {
        this._bytecode = 0x77
        this._method = "parseJSONMap"
        return new Map(this)
    }
    public parseXMLMap() {
        this._bytecode = 0x78
        this._method = "parseXMLMap"
        return new Map(this)
    }
    public toLowercase() {
        this._bytecode = 0x79
        this._method = "toLowercase"
        return new String(this)
    }
    public toUpperCase() {
        this._bytecode = 0x7a
        this._method = "toUpperCase"
        return new String(this)
    }
}