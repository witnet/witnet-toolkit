// import { RadonRetrieval, retrievals } from "../index"
// import { RadonAny } from "../types"

export * as eth from "./eth"
export * as wit from "./wit"

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
export type Wildcard = string

// /**
//  * Base container type for JSON Remote Procedure Calls.
//  */ 
// export type RPC = {
//     method: string;
//     params?: any;
// }

// /**
//  * Base container class for JSON Remote Procedure Calls.
//  */ 
// export class RadonCCDR extends RadonRetrieval {
//     public readonly rpc: RPC;
//     constructor (specs: {
//         rpc: RPC, 
//         script?: RadonAny,
//         argsKeys?: Array<string>,
//     }) {
//         super({
//             method: retrievals.Methods.HttpPost,
//             url: "\\0\\",
//             body: JSON.stringify({
//                 jsonrpc: "2.0",
//                 methods: specs.rpc.method,
//                 params: specs.rpc?.params,
//                 id: 1,
//             }).replaceAll('\\\\', '\\'),
//             headers: { "Content-Type": "application/json;charset=UTF-8" },
//             script: specs?.script,
//             argsKeys: specs?.argsKeys,
//         })
//         this.rpc = specs.rpc
//     }
// }

// /**
//  * Base container class for JSON Remote Procedure Calls.
//  */ 
// export class CrossChainRPC {
//     method: string;
//     params?: any;
//     /**
//      * Creates unmanaged container class for Web3 Remote Procedure Calls.
//      * @param method ETH/RPC method enum value
//      * @param params ETH/RPC input params
//      */
//     constructor (method: string, params?: any) {
//         this.method = method
//         this.params = params
//     }
// }


// /**
//  * Creates a Cross Chain Data Retrievals retrieval on top of a HTTP/POST request.
//  */
// export function CrossChainDataRetrieval(specs : {
//     /**
//      * CrossChainRPC object encapsulating RPC method and parameters.
//      */
//     rpc: CrossChainRPC,
//     /**
//      * RadonScript to reduce returned value.
//      */
//     script?: RadonAny
// }) {
//     return new RadonCCDR(specs.rpc, specs.script)
// }

