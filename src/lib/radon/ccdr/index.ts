import * as _ETH from "./eth"
import * as _WIT from "./wit"

/**
 * JSON ETH/RPC precompiled methods. 
 */
export const ETH = _ETH;

/**
 * JSON WIT/RPC precompiled methods.
 */
export const WIT = _WIT;

export type HexStringOfLength<Max> = string & {
    max: Max;
    readonly HexStringOfLength: unique symbol
};

export type HexString = string & {
    readonly HexString: unique symbol
};

export type Bytes32 = HexStringOfLength<64>;
export type Bytes = HexString;
export type BlockNumber = number | Bytes32;

/**
 * Base container class for Web3 Remote Procedure Calls.
 */ 
export class Call {
    method: string;
    params?: any;
    /**
     * Creates unmanaged container class for Web3 Remote Procedure Calls.
     * @param method ETH/RPC method enum value
     * @param params ETH/RPC input params
     */
    constructor (method: string, params?: any) {
        this.method = method
        this.params = params
    }
}
