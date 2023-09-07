const utils = require('./utils')

import * as Reducers from './reducers'

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
        return Math.max(
            utils.getMaxArgsIndexFromString(this._key),
            this._prev?._countArgs() || 0
        );
    }
    public _encodeArray(): any[] {
        let _result = this._bytecode ? [ this._bytecode ] : []
        if (this._prev !== undefined) _result = this._prev._encodeArray().concat(_result)
        return _result
    }
    protected _set(bytecode?: any, method?: string, params?: any) {
        this._bytecode = bytecode
        this._method = method
        this._params = params
    }
    public _spliceWildcards(argIndex: number, argValue: string, argsCount: number): Script {
        let spliced: Script
        if (this instanceof RadonAny) {
            spliced = new RadonAny(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonArray) {
            spliced = new RadonArray(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonBoolean) {
            spliced = new RadonBoolean(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonBytes) {
            spliced = new RadonBytes(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonFloat) {
            spliced = new RadonFloat(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonInteger) {
            spliced = new RadonInteger(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonMap) {
            spliced = new RadonMap(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else if (this instanceof RadonString) {
            spliced = new RadonString(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        } else {
            spliced = new Script(this._prev?._spliceWildcards(argIndex, argValue, argsCount), this._key)
        }
        spliced._set(
            utils.spliceWildcards(this._bytecode, argIndex, argValue, argsCount), 
            this._method, 
            utils.spliceWildcards(this._params, argIndex, argValue, argsCount)
        )
        return spliced
    }
}
export class RadonAny extends Script {
    public identity() {
        this._bytecode = 0x00
        this._method = "identity"
        return new RadonAny(this)
    }
}
export class RadonArray extends Script {
    public filter(subscript: Script) {
        this._bytecode = [ 0x11, subscript._encodeArray() ]
        this._method = "filter"
        this._params = subscript.toString()
        return new RadonArray(this)
    }
    public getArray(index: number) {
        this._bytecode = [ 0x13, index ]
        this._method = "getArray"
        this._params = index
        return new RadonArray(this)
    }
    public getBoolean(index: number) {
        this._bytecode = [ 0x14, index ]
        this._method = "getBoolean"
        this._params = index
        return new RadonBoolean(this)
    }
    public getBytes(index: number) {
        this._bytecode = [ 0x15, index ]
        this._method = "getBytes"
        this._params = index
        return new RadonBytes(this)
    }
    public getFloat(index: number) {
        this._bytecode = [ 0x16, index ]
        this._method = "getFloat"
        this._params = index
        return new RadonFloat(this)
    }
    public getInteger(index: number) {
        this._bytecode = [ 0x17, index ]
        this._method = "getInteger"
        this._params = index
        return new RadonInteger(this)
    }
    public getMap(index: number) {
        this._bytecode = [ 0x18, index ]
        this._method = "getMap"
        this._params = index
        return new RadonMap(this)
    }
    public getString(index: number) {
        this._bytecode = [ 0x19, index ]
        this._method = "getString"
        this._params = index
        return new RadonString(this)
    }
    public length() {
        this._bytecode = 0x10
        this._method = "length"
        return new RadonInteger(this)
    }
    public map(subscript: Script) {
        this._bytecode = [ 0x1A, subscript._encodeArray() ]
        this._method = "map"
        this._params = subscript.toString()
        return new RadonArray(this)
    }
    public reduce(reductor: Reducers.Opcodes) {
        this._bytecode = [ 0x1B, reductor ]
        this._method = "reduce"
        this._params = Reducers.Opcodes[reductor]
        return new RadonFloat(this)
    }
    public sort() {
        this._bytecode = 0x1d
        this._method = "sort"
        return new RadonArray(this)
    }
}
export class RadonBoolean extends Script {
    public asString() {
        this._bytecode = 0x20
        this._method = "asString"
        return new RadonString(this)
    }
    public match(entries: Map<boolean, boolean>, match: boolean) {
        this._bytecode = [ 
            0x21, [ 
                Object.entries(entries).map((entry: [string, any]) => { [ entry[0], entry[1] ]}), 
            ],
            match 
        ]
        this._method = "match"
        this._params = `{ ${Object.entries(entries).map((entry: [string, any]) => `\"${entry[0]}\": ${entry[1]}, `)} }, ${match}`
        let keys: string = ""
        Object.keys(entries).map((key: string) => keys += key + ";")
        return new RadonBoolean(this, keys)
    }
    public negate() {
        this._bytecode = 0x22
        this._method = "negate"
        return new RadonBoolean(this)
    }
}
export class RadonBytes extends Script {
    public asString() {
        this._bytecode = 0x30
        this._method = "asString"
        return new RadonString(this)
    }
    public hash() {
        this._bytecode = 0x31
        this._method = "hash"
        return new RadonBytes(this)
    }
}
export class RadonFloat extends Script {
    public absolute() {
        this._bytecode = 0x50
        this._method = "absolute"
        return new RadonFloat(this)
    }
    public asString() {
        this._bytecode = 0x51
        this._method = "asString"
        return new RadonString(this)
    }
    public ceiling() {
        this._bytecode = 0x52
        this._method = "ceiling"
        return new RadonInteger(this)
    }
    public floor() {
        this._bytecode = 0x54
        this._method = "floor"
        return new RadonInteger(this)
    }
    public greaterThan(value: number | string) {
        this._bytecode = [ 0x53, value ]
        this._method = "greaterThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonBoolean(this)
    }
    public lessThan(value: number | string) {
        this._bytecode = [ 0x55, value ]
        this._method = "lessThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonBoolean(this)
    }
    public module(value: number | string) {
        this._bytecode = [ 0x56, value ]
        this._method = "module"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonFloat(this)
    }
    public multiply(value: number | string) {
        this._bytecode = [ 0x57, value ]
        this._method = "multiply"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonFloat(this)
    }
    public negate() {
        this._bytecode = 0x58
        this._method = "negate"
        return new RadonFloat(this)
    }
    public power(value: number | string) {
        this._bytecode = [ 0x59, value ]
        this._method = "power"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonFloat(this)
    }
    public round() {
        this._bytecode = 0x5b
        this._method = "round"
        return new RadonInteger(this)
    }
    public truncate() {
        this._bytecode = 0x5d
        this._method = "truncate"
        return new RadonInteger(this)
    }
}
export class RadonInteger extends Script {
    public absolute() {
        this._bytecode = 0x40
        this._method = "absolute"
        return new RadonInteger(this)
    }
    public asFloat() {
        this._bytecode = 0x41
        this._method = "asFloat"
        return new RadonFloat(this)
    }
    public asString() {
        this._bytecode = 0x42
        this._method = "asString"
        return new RadonString(this)
    }
    public greaterThan(value: number | string) {
        this._bytecode = [ 0x43, value ]
        this._method = "greaterThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonBoolean(this)
    }
    public lessThan(value: number | string) {
        this._bytecode = [ 0x44, value ]
        this._method = "lessThan"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonBoolean(this)
    }
    public match(entries: Map<number, boolean>, match: boolean) {
        this._bytecode = [ 
            0x45, [ 
                Object.entries(entries).map((entry: [string, any]) => { [ entry[0], entry[1] ]}), 
            ],
            match 
        ]
        this._method = "match"
        this._params = `{ ${Object.entries(entries).map((entry: [string, any]) => `\"${entry[0]}\": ${entry[1]}, `)} }, ${match}`
        let keys: string = ""
        Object.keys(entries).map((key: string) => keys += key + ";")
        return new RadonBoolean(this, keys)
    }
    public modulo(value: number | string) {
        this._bytecode = [ 0x46, value ]
        this._method = "modulo"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonInteger(this)
    }
    public multiply(value: number | string) {
        this._bytecode = [ 0x47, value ]
        this._method = "multiply"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonInteger(this)
    }
    public negate() {
        this._bytecode = 0x48
        this._method = "negate"
        return new RadonInteger(this)
    }
    public power(value: number | string) {
        this._bytecode = [ 0x49, value ]
        this._method = "power"
        this._params = typeof value === 'string' ? `'${value}'` : value
        return new RadonInteger(this); 
    }
}
export class RadonMap extends Script {
    public getArray(key: string) {
        this._bytecode = [ 0x61, key ]
        this._method = "getArray"
        this._params = `'${key}'`
        return new RadonArray(this, key)
    }
    public getBoolean(key: string) {
        this._bytecode = [ 0x62, key ]
        this._method = "getBoolean"
        this._params = `'${key}'`
        return new RadonBoolean(this, key)
    }
    // TODO: witnet-rust should be able to deserialize an hex string 
    // into a buffer in order to this method to work:
        // public getBytes(key: string) {
        //     this._bytecode = [ 0x63, key ]
        //     this._method = "getBytes"
        //     this._params = `'${key}'`
        //     return new RadonBytes(this, key)
        // }
    public getFloat(key: string) {
        this._bytecode = [ 0x64, key ]
        this._method = "getFloat"
        this._params = `'${key}'`
        return new RadonFloat(this, key)
    }
    public getInteger(key: string) {
        this._bytecode = [ 0x65, key ]
        this._method = "getInteger"
        this._params = `'${key}'`
        return new RadonInteger(this, key)
    }
    public getMap(key: string) {
        this._bytecode = [ 0x66, key ]
        this._method = "getMap"
        this._params = `'${key}'`
        return new RadonMap(this, key)
    }
    public getString(key: string) {
        this._bytecode = [ 0x67, key ]
        this._method = "getString"
        this._params = `'${key}'`
        return new RadonString(this, key)
    }
    public keys() {
        this._bytecode = 0x68
        this._method = "keys"
        return new RadonArray(this)
    }
    public valuesAsArray() {
        this._bytecode = 0x69
        this._method = "values"
        return new RadonArray(this)
    }
}
export class RadonString extends Script {
    public asBoolean() {
        this._bytecode = 0x70
        this._method = "asBoolean"
        return new RadonBoolean(this)
    }
    public asFloat() {
        this._bytecode = 0x72
        this._method = "asFloat"
        return new RadonFloat(this)
    }
    public length() {
        this._bytecode = 0x74
        this._method = "length"
        return new RadonInteger(this)
    }
    public match(entries: Map<string, boolean>, match: boolean) {
        this._bytecode = [ 
            0x75,  
            entries,
            match 
        ]
        this._method = "match"
        this._params = `{ ${Object.entries(entries).map((entry: [string, any]) => `\"${entry[0]}\": ${entry[1]}, `)}}, ${match}`
        let keys: string = ""
        Object.keys(entries).map((key: string) => keys += key + ";")
        return new RadonBoolean(this, keys)
    }
    public parseJSONArray() {
        this._bytecode = 0x76
        this._method = "parseJSONArray"
        return new RadonArray(this)
    }

    /**
     * Interprets the input RadonString as a JSON-encoded Map.
     * @returns A RadonMap object.
     */
    public parseJSONMap() {
        this._bytecode = 0x77
        this._method = "parseJSONMap"
        return new RadonMap(this)
    }
    public parseXMLMap() {
        this._bytecode = 0x78
        this._method = "parseXMLMap"
        return new RadonMap(this)
    }
    public toLowercase() {
        this._bytecode = 0x79
        this._method = "toLowercase"
        return new RadonString(this)
    }
    public toUpperCase() {
        this._bytecode = 0x7a
        this._method = "toUpperCase"
        return new RadonString(this)
    }
}