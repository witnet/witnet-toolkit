export * as eth from "./eth.js"
export * as wit from "./wit.js"

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
