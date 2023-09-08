const utils = require("./utils")

type HexStringOfLength<Max> = string & {
    max: Max;
    readonly HexStringOfLength: unique symbol
};

type HexString = string & {
    readonly HexString: unique symbol
};

export type Address = HexStringOfLength<40>;
export type Bytes32 = HexStringOfLength<64>;
export type Bytes = HexString;
export type BlockNumber = Bytes32;
export type BlockHead = BlockNumber | BlockTag;
export type BlockTag = "latest" | "earliest" | "pending" | "finalized" 

function isBlockHead(block: BlockHead): boolean {
    return (
        block === "latest" || block === "earliest" || block === "finalized" || block === "pending"
            || utils.isHexStringOfLength(block, 32)
            || utils.isWildcard(block)
    );
}

enum Methods {
    // ===============================================
    // --- GOSSIP methods ----------------------------
    
    eth_blockNumber,
    eth_gasPrice,
    eth_sendRawTransaction,
    
    // ===============================================
    // --- STATE methods -----------------------------
    
    eth_getBalance,
    eth_getStorageAt,
    eth_getTransactionCount,
    eth_getCode,
    eth_call,
    eth_estimateGas,

    // ===============================================
    // --- HISTORY methods ---------------------------
    
    eth_getBlockTransactionCountByHash,
    eth_getBlockTransactionCountByNumber,
    eth_getBlockByHash,
    eth_getBlockByNumber,
    eth_getLogs,
    eth_getTransactionByHash,
    eth_getTransactionByBlockHashAndIndex,
    eth_getTransactionByBlockNumberAndIndex,
    eth_getTransactionReceipt,
}

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
    constructor (method: Methods, params?: any) {
        this.method = Methods[method]
        this.params = params
    }
}

/**
 * Retrieve the number of most recent block.
 */ 
export const EthBlockNumber = () => new Call(Methods.eth_blockNumber);

/**
 * Retrieve an estimate of the current price per gas in wei. 
 */ 
export const EthGasPrice = () => new Call(Methods.eth_gasPrice);

/**
 * Retrieve the balance of the account of given address.
 * @param address Web3 address on remote EVM chain.
 */
export const EthGetBalance = (address: Address, block?: BlockHead) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetBalance: invalid Web3 address format");
    } else {
        return new Call(Methods.eth_getBalance, [ address, block ]);
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
        return new Call(Methods.eth_sendRawTransaction, [ data ]);
    }
};

/**
 * Retrieve the value from a storage position at a given address.
 * @param address Address of the storage.
 * @param offset Offset within storage address.
 */
export const EthGetStorageAt = (address: Address, offset: Bytes32) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetStorageAt: invalid Web3 address format");
    } 
    if (!utils.isHexStringOfLength(offset, 32) && !utils.isWildcard(offset)) {
        throw new EvalError("RPC: EthGetStorageAt: invalid storage offset value");
    }
    return new Call(Methods.eth_getStorageAt, [ address, offset ]);
};

/**
 * Retrieve the number of transactions sent from an address.
 * @param address Address from where to get transaction count.
 */
export const EthGetTransactionCount = (address: Address) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetTransactionCount: invalid Web3 address format");
    } else {
        return new Call(Methods.eth_getTransactionCount, [ address ]);
    }
};

/**
 * Retrieve code at a given address.
 * @param address Address from where to get the code.
 */
export const EthGetCode = (address: Address) => {
    if (!utils.isHexStringOfLength(address, 20) && !utils.isWildcard(address)) {
        throw new EvalError("RPC: EthGetCode: invalid Web3 address format");
    } else {
        return new Call(Methods.eth_getCode, [ address ]);
    }
};

/**
 * Invoke message call immediately without creating a transaction 
 * on the remote block chain. Often used for executing read-only smart contract 
 * functions, for example the balanceOf for an ERC-20 contract.
 * @param tx The transaction call object.
 */
export const EthCall = (tx: {
    from?: Address,
    to: Address,
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
    return new Call(Methods.eth_call, [ tx ]);
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
    from?: Address,
    to: Address,
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
    return new Call(Methods.eth_estimateGas, [ tx ]);
};

/**
 * Retrieve an array of all logs matching a given filter object.
 * @param filter The filter options.
 */
export const EthGetLogs = (filter: {
    fromBlock?: BlockHead,
    toBlock?: BlockHead,
    address?: Address | Address[],
    topics: Bytes32[],
    blockHash?: Bytes32,
}) => {
    if (filter?.blockHash && (filter?.fromBlock || filter?.toBlock)) {
        throw new EvalError("RPC: EthGetLogs: uncompliant use of 'blockHash'")
    }
    if (filter?.fromBlock && !isBlockHead(filter?.fromBlock)) {
        throw new EvalError("RPC: EthGetLogs: invalid 'fromBlock' value");
    }
    if (filter?.toBlock && !isBlockHead(filter?.toBlock)) {
        throw new EvalError("RPC: EthGetLogs: invalid 'toBlock' value");
    }
    if (filter?.blockHash && !utils.isHexStringOfLength(filter.blockHash, 32) && !utils.isWildcard(filter.blockHash)) {
        throw new EvalError("RPC: EthGetLogs: invalid 'blockHash' value");
    }
    filter.topics.map((value: Bytes32, index: number) => {
        if (!utils.isHexStringOfLength(value, 32) && !utils.isWildcard(value)) {
            throw new EvalError(`RPC: EthGetLogs: topic #${index}: invalid hash`)
        }
    })
    return new Call(Methods.eth_getLogs, [ filter ]);
};

/**
 * Retrieve the information about a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionByHash = (txHash: Bytes32) => {
    if (!utils.isHexStringOfLength(txHash, 32) && !utils.isWildcard(txHash)) {
        throw new EvalError("RPC: EthGetTransactionByHash: invalid transaction hash value");
    } else {
        return new Call(Methods.eth_getTransactionByHash, [ txHash ]);
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
    return new Call(Methods.eth_getTransactionByBlockHashAndIndex, [ blockHash, txIndex ]);
};

/**
 * Retrieve the information about a remote transaction given a block number and a transaction index.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionByBlockNumberAndIndex = (
    blockNumber: BlockHead,
    txIndex: number | Bytes32
) => {
    if (!isBlockHead(blockNumber)) {
        throw new EvalError("RPC: EthGetTransactionByBlockNumberAndIndex: invalid block number value");
    }
    if (!Number.isInteger(txIndex) && !utils.isHexStringOfLength(txIndex, 32) && !utils.isWildcard(txIndex)) {
        throw new EvalError("RPC: EthGetTransactionByBlockNumberAndIndex: invalid transaction index value")
    }
    return new Call(Methods.eth_getTransactionByBlockHashAndIndex, [ blockNumber, txIndex ]);
};

/**
 * Retrieve the receipt of a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const EthGetTransactionReceipt = (txHash: Bytes32) => {
    if (!utils.isHexStringOfLength(txHash, 32) && !utils.isWildcard(txHash)) {
        throw new EvalError("RPC: EthGetTransactionReceipt: invalid transaction hash value");
    } else {
        return new Call(Methods.eth_getTransactionReceipt, [ txHash ]);
    }
};
