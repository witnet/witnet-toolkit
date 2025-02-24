import { isHexStringOfLength, isWildcard } from "../../../bin/helpers"
import { Bytes32, CrossChainRPC } from ".";

export type WitAddress = string & {
    readonly WitAddress: unique symbol
}

/**
 * Retrieve the balance in $nanoWIT of some account in Witnet.
 * @param address Address of the account within the Witnet blockchain.
 */
export const getBalance = (address: WitAddress, simple?: boolean) => {
    if (
        !isWildcard(address) && (
            !address || typeof address !== "string" || address.length != 43 || !address.startsWith("wit")
        ) 
    ) {
        throw new EvalError("CCDR: WitGetBalance: invalid Witnet address");
    } else {
        return new CrossChainRPC("getBalance", [ address, simple ]);
    }
};

/**
 * Retrieve detailed informatinon about a mined block in the Witnet blockchain.
 * @param blockHash The hash of the block to retrieve.
 */
export const getBlockByHash = (blockHash: Bytes32) => {
    if (!isHexStringOfLength(blockHash, 32) && !isWildcard(blockHash)) {
        throw new EvalError("CCDR: WitGetBlockByHash: invalid block hash value");
    } else {
        return new CrossChainRPC("getBlock", [ blockHash ])
    }
}

/**
 * Get latest supply info about Witnet.
 * @param txHash Hash of the remote transaction.
 */
export const getSupplyInfo = () => {
    return new CrossChainRPC("getSupplyInfo");
}

/**
 * Retrieve detailed informatinon about a mined transaction in the Witnet blockchain.
 * @param txHash The hash of the transaction to retrieve.
 */
export const getTransactionByHash = (txHash: Bytes32) => {
    if (!isHexStringOfLength(txHash, 32) && !isWildcard(txHash)) {
        throw new EvalError("CCDR: WitGetTransactionByHash: invalid transaction hash value");
    } else {
        return new CrossChainRPC("getTransaction", [ txHash ])
    }
}

/**
 * Get Witnet node syncrhonization status.
 */
export const syncStatus = () => {
    return new CrossChainRPC("syncStatus");
}
