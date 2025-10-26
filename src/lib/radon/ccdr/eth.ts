import {
    checkRpcWildcards,
    isHexString,
    isHexStringOfLength,
    isWildcard,
} from "../../../bin/helpers.js"

import { 
    // CrossChainRPC, 
    BlockNumber, 
    Bytes, 
    Bytes32, 
    HexString,
    HexStringOfLength,
    Wildcard,
} from "./index.js";

export type EthAddress = HexStringOfLength<40>;
export type EthBlockHead = BlockNumber | EthBlockTag | Wildcard;
export type EthBlockTag = "latest" | "earliest" | "pending" | "finalized" 

function _isBlockHead(block: EthBlockHead): boolean {
    return (
        block === "latest" || block === "earliest" || block === "finalized" || block === "pending"
            || typeof block === 'number'
            || isHexStringOfLength(block, 32)
            || isWildcard(block)
    );
}

/**
 * Retrieve the number of most recent block.
 */ 
export const blockNumber = () => ({ method: "eth_blockNumber" });

/**
 * Invoke message call immediately without creating a transaction 
 * on the remote block chain. Often used for executing read-only smart contract 
 * functions, for example the balanceOf for an ERC-20 contract.
 * @param tx The transaction call object.
 */
export const call = (tx: {
    from?: EthAddress | Wildcard,
    to: EthAddress | Wildcard,
    gas?: number | HexString | Wildcard,
    gasPrice?: number | HexString | Wildcard,
    value?: number | HexString | Wildcard,
    data?: HexString  | Wildcard
}) => {
    checkRpcWildcards(tx)
    if (tx?.from && !isHexStringOfLength(tx?.from, 20) && !isWildcard(tx?.from)) {
        throw new TypeError("rpc.eth.call: invalid 'from' address");
    }
    if (tx?.gas && !Number.isInteger(tx.gas) && !isHexStringOfLength(tx.gas, 32) && !isWildcard(tx.gas)) {
        throw new TypeError("rpc.eth.call: invalid 'gas' value")
    }
    if (tx?.gasPrice && !Number.isInteger(tx.gasPrice) && !isHexStringOfLength(tx.gasPrice, 32) && !isWildcard(tx.gasPrice)) {
        throw new TypeError("rpc.eth.call: invalid 'gasPrice' value")
    }
    if (tx?.value && !Number.isInteger(tx.value) && !isHexStringOfLength(tx.value, 32) && !isWildcard(tx.value)) {
        throw new TypeError("rpc.eth.call: invalid transaction 'value'")
    }
    if (tx?.data && !isHexString(tx.data) && !isWildcard(tx.data)) {
        throw new TypeError("rpc.eth.call: invalid transaction 'data'")
    }
    return {
        method: "eth_call", 
        params: [ tx ]
    };
};

/**
 * Generates and returns an estimate of how much gas is necessary 
 * to allow the transaction to complete. The transaction will not be 
 * added to the blockchain. Note that the estimate may be significantly 
 * more than the amount of gas actually used by the transaction, for a 
 * variety of reasons including EVM mechanics and node performance.
 * @param tx The transaction call object.
 */
export const estimateGas = (tx: {
    from?: EthAddress | Wildcard,
    to: EthAddress | Wildcard,
    gas?: number | HexString | Wildcard,
    gasPrice?: number | HexString | Wildcard,
    value?: number | HexString | Wildcard,
    data?: HexString | Wildcard
}) => {
    checkRpcWildcards(tx)
    if (tx?.from && !isHexStringOfLength(tx?.from, 20) && !isWildcard(tx?.from)) {
        throw new TypeError("rpc.eth.estimateGas: invalid 'from' address");
    }
    if (tx?.gas && !Number.isInteger(tx.gas) && !isHexStringOfLength(tx.gas, 32) && !isWildcard(tx.gas)) {
        throw new TypeError("rpc.eth.estimateGas: invalid 'gas' value")
    }
    if (tx?.gasPrice && !Number.isInteger(tx.gasPrice) && !isHexStringOfLength(tx.gasPrice, 32) && !isWildcard(tx.gasPrice)) {
        throw new TypeError("rpc.eth.estimateGas: invalid 'gasPrice' value")
    }
    if (tx?.value && !Number.isInteger(tx.value) && !isHexStringOfLength(tx.value, 32) && !isWildcard(tx.value)) {
        throw new TypeError("rpc.eth.estimateGas: invalid transaction 'value'")
    }
    if (tx?.data && !isHexString(tx.data) && !isWildcard(tx.data)) {
        throw new TypeError("rpc.eth.estimateGas: invalid transaction 'data'")
    }
    return {
        method: "eth_estimateGas", 
        params: [ tx ]
    };
};

/**
 * Retrieve the balance of the account of given address.
 * @param address Web3 address on remote EVM chain.
 */
export const getBalance = (address: EthAddress | Wildcard, block?: EthBlockHead | Wildcard) => {
    checkRpcWildcards([address, block])
    if (!isHexStringOfLength(address, 20) && !isWildcard(address)) {
        throw new TypeError("rpc.eth.getBalance: invalid Web3 address format");
    } 
    return {
        method: "eth_getBalance", 
        params: [ address, block ]
    }
};

/**
 * Retrieve code at a given address.
 * @param address EthAddress from where to get the code.
 */
export const getCode = (address: EthAddress | Wildcard) => {
    checkRpcWildcards(address)
    if (!isHexStringOfLength(address, 20) && !isWildcard(address)) {
        throw new TypeError("rpc.eth.getCode: invalid Web3 address format");
    } 
    return {
        method: "eth_getCode", 
        params: [ address ],
    };
};

/**
 * Retrieve an array of all logs matching a given filter object.
 * @param filter The filter options.
 */
export const getLogs = (filter: {
    fromBlock?: EthBlockHead,
    toBlock?: EthBlockHead,
    address?: EthAddress | EthAddress[] | Wildcard,
    topics?: Bytes32[],
    blockHash?: Bytes32 | Wildcard,
}) => {
    checkRpcWildcards(filter)
    if (filter?.blockHash && (filter?.fromBlock || filter?.toBlock)) {
        throw new TypeError("rpc.eth.getLogs: uncompliant use of 'blockHash'")
    }
    if (filter?.fromBlock) {
        if (!_isBlockHead(filter?.fromBlock)) {
            throw new TypeError("rpc.eth.getLogs: invalid 'fromBlock' value");
        } else if (typeof filter?.fromBlock === 'number') {
            filter.fromBlock = `0x${(filter?.fromBlock as number).toString(16)}` as EthBlockHead
        }
    }
    if (filter?.toBlock) {
        if (!_isBlockHead(filter?.toBlock)) {
            throw new TypeError("rpc.eth.getLogs: invalid 'toBlock' value");
        } else if (typeof filter?.toBlock === 'number') {
            filter.toBlock = `0x${(filter?.toBlock as number).toString(16)}` as EthBlockHead
        }
    }
    if (filter?.blockHash && !isHexStringOfLength(filter.blockHash, 32) && !isWildcard(filter.blockHash)) {
        throw new TypeError("rpc.eth.getLogs: invalid 'blockHash' value");
    }
    if (filter?.topics) {
        filter.topics.map((value: Bytes32, index: number) => {
            if (!isHexStringOfLength(value, 32) && !isWildcard(value)) {
                throw new TypeError(`rpc.eth.getLogs: topic #${index}: invalid hash`)
            }
        })
    }
    return {
        method: "eth_getLogs", 
        params: [ filter ]
    };
};

/**
 * Retrieve an estimate of the current price per gas in wei. 
 */ 
export const gasPrice = () => ({ method: "eth_gasPrice" });

/**
 * Retrieve the value from a storage position at a given address.
 * @param address EthAddress of the storage.
 * @param offset Offset within storage address.
 */
export const getStorageAt = (address: EthAddress | Wildcard, offset: Bytes32 | Wildcard) => {
    checkRpcWildcards([ address, offset ])
    if (!isHexStringOfLength(address, 20) && !isWildcard(address)) {
        throw new TypeError("rpc.eth.getStorageAt: invalid Web3 address format");
    } 
    if (!isHexStringOfLength(offset, 32) && !isWildcard(offset)) {
        throw new TypeError("rpc.eth.getStorageAt: invalid storage offset value");
    }
    return {
        method: "eth_getStorageAt", 
        params: [ address, offset ],
    };
};

/**
 * Retrieve the information about a remote transaction given a block hash and a transaction index.
 * @param txHash Hash of the remote transaction.
 */
export const getTransactionByBlockHashAndIndex = (blockHash: Bytes32 | Wildcard, txIndex: number | Bytes32 | Wildcard) => {
    checkRpcWildcards([ blockHash, txIndex ])
    if (!isHexStringOfLength(blockHash, 32) && !isWildcard(blockHash)) {
        throw new TypeError("rpc.eth.getTransactionByBlockHashAndIndex: invalid block hash value");
    }
    if (!Number.isInteger(txIndex) && !isHexStringOfLength(txIndex, 32) && !isWildcard(txIndex)) {
        throw new TypeError("rpc.eth.getTransactionByBlockHashAndIndex: invalid transaction index value")
    }
    return {
        method: "eth_getTransactionByBlockHashAndIndex", 
        params: [ blockHash, txIndex ]
    };
};

/**
 * Retrieve the information about a remote transaction given a block number and a transaction index.
 * @param txHash Hash of the remote transaction.
 */
export const getTransactionByBlockNumberAndIndex = (
    blockNumber: EthBlockHead,
    txIndex: number | Bytes32 | Wildcard
) => {
    checkRpcWildcards([ blockNumber, txIndex ])
    if (!_isBlockHead(blockNumber)) {
        throw new TypeError("rpc.eth.getTransactionByBlockNumberAndIndex: invalid block number value");
    } else {
        if (typeof blockNumber === 'number') {
            blockNumber = `0x${(blockNumber as number).toString(16)}` as EthBlockHead
        }
    }
    if (!Number.isInteger(txIndex) && !isHexStringOfLength(txIndex, 32) && !isWildcard(txIndex)) {
        throw new TypeError("rpc.eth.getTransactionByBlockNumberAndIndex: invalid transaction index value")
    }
    return {
        method: "eth_getTransactionByBlockHashAndIndex", 
        params: [ blockNumber, txIndex ],
    };
};

/**
 * Retrieve the information about a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const getTransactionByHash = (txHash: Bytes32 | Wildcard) => {
    checkRpcWildcards(txHash)
    if (!isHexStringOfLength(txHash, 32) && !isWildcard(txHash)) {
        throw new TypeError("rpc.eth.getTransactionByHash: invalid transaction hash value");
    }
    return { 
        method: "eth_getTransactionByHash", 
        params: [ txHash ],
    };
};

/**
 * Retrieve the number of transactions sent from an address.
 * @param address EthAddress from where to get transaction count.
 */
export const getTransactionCount = (address: EthAddress | Wildcard) => {
    checkRpcWildcards(address)
    if (!isHexStringOfLength(address, 20) && !isWildcard(address)) {
        throw new TypeError("rpc.eth.getTransactionCount: invalid Web3 address format");
    }
    return {
        method: "eth_getTransactionCount", 
        params: [ address ],
    };
};

/**
 * Retrieve the receipt of a remote transaction given its transaction hash.
 * @param txHash Hash of the remote transaction.
 */
export const getTransactionReceipt = (txHash: Bytes32 | Wildcard) => {
    checkRpcWildcards(txHash)
    if (!isHexStringOfLength(txHash, 32) && !isWildcard(txHash)) {
        throw new TypeError("rpc.eth.getTransactionReceipt: invalid transaction hash value");
    }
    return {
        method: "eth_getTransactionReceipt", 
        params: [ txHash ],
    };
};

/**
 * Invoke remote call transaction, or remote contract creation. 
 * @param data The signed transaction data.
 */
export const sendRawTransaction = (data: Bytes | Wildcard) => {
    checkRpcWildcards(data)
    if (!isHexString(data) && !isWildcard(data)) {
        throw new TypeError("rpc.eth.sendRawTransaction: invalid signed transaction data");
    }
    return {
        method: "eth_sendRawTransaction", 
        params: [ data ]
    };
};
