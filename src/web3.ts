const utils = require("./utils")

type HexStringOfLength<Max> = string & {
    max: Max;
    readonly HexStringOfLength: unique symbol
};

type HexString = string & {
    readonly HexString: unique symbol
};

export type Bytes32 = HexStringOfLength<64>;
export type Bytes = HexString;
export type BlockNumber = number | Bytes32;

export type EthAddress = HexStringOfLength<40>;
export type EthBlockHead = BlockNumber | EthBlockTag;
export type EthBlockTag = "latest" | "earliest" | "pending" | "finalized" 

export type WitAddress = string & {
    readonly WitAddress: unique symbol
}

function isBlockHead(block: EthBlockHead): boolean {
    return (
        block === "latest" || block === "earliest" || block === "finalized" || block === "pending"
            || typeof block === 'number'
            || utils.isHexStringOfLength(block, 32)
            || utils.isWildcard(block)
    );
}

// enum Methods {

//     /*********************************************** */
//     /** ETHEREUM RPC METHODS *********************** */

//     // ===============================================
//     // --- GOSSIP methods ----------------------------
    
//     eth_blockNumber,
//     eth_gasPrice,
//     eth_sendRawTransaction,
    
//     // ===============================================
//     // --- STATE methods -----------------------------
    
//     eth_getBalance,
//     eth_getStorageAt,
//     eth_getTransactionCount,
//     eth_getCode,
//     eth_call,
//     eth_estimateGas,

//     // ===============================================
//     // --- HISTORY methods ---------------------------
    
//     eth_getBlockTransactionCountByHash,
//     eth_getBlockTransactionCountByNumber,
//     eth_getBlockByHash,
//     eth_getBlockByNumber,
//     eth_getLogs,
//     eth_getTransactionByHash,
//     eth_getTransactionByBlockHashAndIndex,
//     eth_getTransactionByBlockNumberAndIndex,
//     eth_getTransactionReceipt,

//     /*********************************************** */
//     /** WITNET RPC METHODS ************************* */

//     // ===============================================
//     // --- GOSSIP methods ----------------------------
    
//     wit_getBalance = "getBalance",
//     wit_getSupplyInfo = "getSupplyInfo",
//     wit_getSyncStatus = "syncStatus",

//     // ===============================================
//     // --- STATE methods -----------------------------
    
//     wit_getDataRequestReport = "dataRequestReport",

//     // ===============================================
//     // --- HISTORY methods ---------------------------
//     wit_getBlockByHash = "getBlock",
//     wit_getTransactionByHash = "getTransaction",
// }

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

/**
 * Retrieve the number of most recent block.
 */ 
export const EthBlockNumber = () => new Call("eth_blockNumber");

/**
 * Retrieve an estimate of the current price per gas in wei. 
 */ 
export const EthGasPrice = () => new Call("eth_gasPrice");

/**
 * Retrieve the balance of the account of given address.
 * @param address Web3 address on remote EVM chain.
 */
export const EthGetBalance = (address: EthAddress, block?: EthBlockHead) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetBalance: invalid Web3 address format");
    } else {
        return new Call("eth_getBalance", [ address, block ]);
    }
};

/**
 * Invoke remote call transaction, or remote contract creation. 
 * @param data The signed transaction data.
 */
export const EthSendRawTransaction = (data: Bytes) => {
    if (!utils.isHexString(data) && !utils.isWildcard(data)) {
        throw new EvalError("RPC: EthSendRawTransaction: invalid signed transaction data");
    } else {
        return new Call("eth_sendRawTransaction", [ data ]);
    }
};

/**
 * Retrieve the value from a storage position at a given address.
 * @param address EthAddress of the storage.
 * @param offset Offset within storage address.
 */
export const EthGetStorageAt = (address: EthAddress, offset: Bytes32) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetStorageAt: invalid Web3 address format");
    } 
    if (!utils.isHexStringOfLength(offset, 32) && !utils.isWildcard(offset)) {
        throw new EvalError("RPC: EthGetStorageAt: invalid storage offset value");
    }
    return new Call("eth_getStorageAt", [ address, offset ]);
};

/**
 * Retrieve the number of transactions sent from an address.
 * @param address EthAddress from where to get transaction count.
 */
export const EthGetTransactionCount = (address: EthAddress) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetTransactionCount: invalid Web3 address format");
    } else {
        return new Call("eth_getTransactionCount", [ address ]);
    }
};

/**
 * Retrieve code at a given address.
 * @param address EthAddress from where to get the code.
 */
export const EthGetCode = (address: EthAddress) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetCode: invalid Web3 address format");
    } else {
        return new Call("eth_getCode", [ address ]);
    }
};

/**
 * Invoke message call immediately without creating a transaction 
 * on the remote block chain. Often used for executing read-only smart contract 
 * functions, for example the balanceOf for an ERC-20 contract.
 * @param tx The transaction call object.
 */
export const EthCall = (tx: {
    from?: EthAddress,
    to: EthAddress,
    gas?: number | HexString,
    gasPrice?: number | HexString,
    value?: number | HexString,
    data?: HexString
}) => {
    if (tx?.from && !utils.isHexStringOfLength(tx?.from, 20) && !utils.isWildcard(tx?.from)) {
        throw new EvalError("RPC: EthCall: invalid 'from' address");
    }
    if (tx?.gas && !Number.isInteger(tx.gas) && !utils.isHexStringOfLength(tx.gas, 32) && !utils.isWildcard(tx.gas)) {
        throw new EvalError("RPC: EthCall: invalid 'gas' value")
    }
    if (tx?.gasPrice && !Number.isInteger(tx.gasPrice) && !utils.isHexStringOfLength(tx.gasPrice, 32) && !utils.isWildcard(tx.gasPrice)) {
        throw new EvalError("RPC: EthCall: invalid 'gasPrice' value")
    }
    if (tx?.value && !Number.isInteger(tx.value) && !utils.isHexStringOfLength(tx.value, 32) && !utils.isWildcard(tx.value)) {
        throw new EvalError("RPC: EthCall: invalid transaction 'value'")
    }
    if (tx?.data && !utils.isHexString(tx.data) && !utils.isWildcard(tx.data)) {
        throw new EvalError("RPC: EthCall: invalid transaction 'data'")
    }
    return new Call("eth_call", [ tx ]);
};

/**
 * Generates and returns an estimate of how much gas is necessary 
 * to allow the transaction to complete. The transaction will not be 
 * added to the blockchain. Note that the estimate may be significantly 
 * more than the amount of gas actually used by the transaction, for a 
 * variety of reasons including EVM mechanics and node performance.
 * @param tx The transaction call object.
 */
export const EthEstimateGas = (tx: {
    from?: EthAddress,
    to: EthAddress,
    gas?: number | HexString,
    gasPrice?: number | HexString,
    value?: number | HexString,
    data?: HexString
}) => {
    if (tx?.from && !utils.isHexStringOfLength(tx?.from, 20) && !utils.isWildcard(tx?.from)) {
        throw new EvalError("RPC: EthEstimateGas: invalid 'from' address");
    }
    if (tx?.gas && !Number.isInteger(tx.gas) && !utils.isHexStringOfLength(tx.gas, 32) && !utils.isWildcard(tx.gas)) {
        throw new EvalError("RPC: EthEstimateGas: invalid 'gas' value")
    }
    if (tx?.gasPrice && !Number.isInteger(tx.gasPrice) && !utils.isHexStringOfLength(tx.gasPrice, 32) && !utils.isWildcard(tx.gasPrice)) {
        throw new EvalError("RPC: EthEstimateGas: invalid 'gasPrice' value")
    }
    if (tx?.value && !Number.isInteger(tx.value) && !utils.isHexStringOfLength(tx.value, 32) && !utils.isWildcard(tx.value)) {
        throw new EvalError("RPC: EthEstimateGas: invalid transaction 'value'")
    }
    if (tx?.data && !utils.isHexString(tx.data) && !utils.isWildcard(tx.data)) {
        throw new EvalError("RPC: EthEstimateGas: invalid transaction 'data'")
    }
    return new Call("eth_estimateGas", [ tx ]);
};

/**
 * Retrieve an array of all logs matching a given filter object.
 * @param filter The filter options.
 */
export const EthGetLogs = (filter: {
    fromBlock?: EthBlockHead,
    toBlock?: EthBlockHead,
    address?: EthAddress | EthAddress[],
    topics?: Bytes32[],
    blockHash?: Bytes32,
}) => {
    if (filter?.blockHash && (filter?.fromBlock || filter?.toBlock)) {
        throw new EvalError("RPC: EthGetLogs: uncompliant use of 'blockHash'")
    }
    if (filter?.fromBlock) {
        if (!isBlockHead(filter?.fromBlock)) {
            throw new EvalError("RPC: EthGetLogs: invalid 'fromBlock' value");
        } else if (typeof filter?.fromBlock === 'number') {
            filter.fromBlock = `0x${(filter?.fromBlock as number).toString(16)}` as EthBlockHead
        }
    }
    if (filter?.toBlock) {
        if (!isBlockHead(filter?.toBlock)) {
            throw new EvalError("RPC: EthGetLogs: invalid 'toBlock' value");
        } else if (typeof filter?.toBlock === 'number') {
            filter.toBlock = `0x${(filter?.toBlock as number).toString(16)}` as EthBlockHead
        }
    }
    if (filter?.blockHash && !utils.isHexStringOfLength(filter.blockHash, 32) && !utils.isWildcard(filter.blockHash)) {
        throw new EvalError("RPC: EthGetLogs: invalid 'blockHash' value");
    }
    if (filter?.topics) {
        filter.topics.map((value: Bytes32, index: number) => {
            if (!utils.isHexStringOfLength(value, 32) && !utils.isWildcard(value)) {
                throw new EvalError(`RPC: EthGetLogs: topic #${index}: invalid hash`)
            }
        })
    }
    return new Call("eth_getLogs", [ filter ]);
};

/**
 * Retrieve the information about a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionByHash = (txHash: Bytes32) => {
    if (!utils.isHexStringOfLength(txHash, 32) && !utils.isWildcard(txHash)) {
        throw new EvalError("RPC: EthGetTransactionByHash: invalid transaction hash value");
    } else {
        return new Call("eth_getTransactionByHash", [ txHash ]);
    }
};

/**
 * Retrieve the information about a remote transaction given a block hash and a transaction index.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionByBlockHashAndIndex = (blockHash: Bytes32, txIndex: number | Bytes32) => {
    if (!utils.isHexStringOfLength(blockHash, 32) && !utils.isWildcard(blockHash)) {
        throw new EvalError("RPC: EthGetTransactionByBlockHashAndIndex: invalid block hash value");
    }
    if (!Number.isInteger(txIndex) && !utils.isHexStringOfLength(txIndex, 32) && !utils.isWildcard(txIndex)) {
        throw new EvalError("RPC: EthGetTransactionByBlockHashAndIndex: invalid transaction index value")
    }
    return new Call("eth_getTransactionByBlockHashAndIndex", [ blockHash, txIndex ]);
};

/**
 * Retrieve the information about a remote transaction given a block number and a transaction index.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionByBlockNumberAndIndex = (
    blockNumber: EthBlockHead,
    txIndex: number | Bytes32
) => {
    if (!isBlockHead(blockNumber)) {
        throw new EvalError("RPC: EthGetTransactionByBlockNumberAndIndex: invalid block number value");
    } else {
        if (typeof blockNumber === 'number') {
            blockNumber = `0x${(blockNumber as number).toString(16)}` as EthBlockHead
        }
    }
    if (!Number.isInteger(txIndex) && !utils.isHexStringOfLength(txIndex, 32) && !utils.isWildcard(txIndex)) {
        throw new EvalError("RPC: EthGetTransactionByBlockNumberAndIndex: invalid transaction index value")
    }
    return new Call("eth_getTransactionByBlockHashAndIndex", [ blockNumber, txIndex ]);
};

/**
 * Retrieve the receipt of a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionReceipt = (txHash: Bytes32) => {
    if (!utils.isHexStringOfLength(txHash, 32) && !utils.isWildcard(txHash)) {
        throw new EvalError("RPC: EthGetTransactionReceipt: invalid transaction hash value");
    } else {
        return new Call("eth_getTransactionReceipt", [ txHash ]);
    }
};

/**
 * Get latest supply info about Witnet.
 * @param txHash Hash of the remote transaction.
 */
export const WitGetSupplyInfo = () => {
    return new Call("getSupplyInfo");
}

/**
 * Get Witnet node syncrhonization status.
 */
export const WitSyncStatus = () => {
    return new Call("syncStatus");
}

/**
 * Retrieve the balance in $nanoWIT of some account in Witnet.
 * @param address Address of the account within the Witnet blockchain.
 */
export const WitGetBalance = (address: WitAddress, simple?: boolean) => {
    if (
        !utils.isWildcard(address) && (
            !address || typeof address !== "string" || address.length != 43 || !address.startsWith("wit")
        ) 
    ) {
        throw new EvalError("RPC: WitGetBalance: invalid Witnet address");
    } else {
        return new Call("getBalance", [ address, simple ]);
    }
};

/**
 * Retrieve detailed informatinon about a mined block in the Witnet blockchain.
 * @param blockHash The hash of the block to retrieve.
 */
export const WitGetBlockByHash = (blockHash: Bytes32) => {
    if (!utils.isHexStringOfLength(blockHash, 32) && !utils.isWildcard(blockHash)) {
        throw new EvalError("RPC: WitGetBlockByHash: invalid block hash value");
    } else {
        return new Call("getBlock", [ blockHash ])
    }
}

/**
 * Retrieve detailed informatinon about a mined transaction in the Witnet blockchain.
 * @param txHash The hash of the transaction to retrieve.
 */
export const WitGetTransactionByHash = (txHash: Bytes32) => {
    if (!utils.isHexStringOfLength(txHash, 32) && !utils.isWildcard(txHash)) {
        throw new EvalError("RPC: WitGetTransactionByHash: invalid transaction hash value");
    } else {
        return new Call("getTransaction", [ txHash ])
    }
}
