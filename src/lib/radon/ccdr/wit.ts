import { checkRpcWildcards, isHexStringOfLength, isWildcard } from "../../../bin/helpers.js";
import type { Bytes32, Wildcard } from "./index.js";

export type WitAddress = string & {
	readonly WitAddress: unique symbol;
};

/**
 * Retrieve the balance in $nanoWIT of some account in Witnet.
 * @param address Address of the account within the Witnet blockchain.
 */
export const getBalance = (address: WitAddress | Wildcard) => {
	checkRpcWildcards(address);
	if (
		!isWildcard(address) &&
		(!address || typeof address !== "string" || address.length !== 43 || !address.startsWith("wit"))
	) {
		throw new EvalError("rpc.wit.getBalance: invalid address");
	}
	return {
		method: "getBalance2",
		params: { pkh: address },
	};
};

/**
 * Retrieve detailed informatinon about a mined transaction in the Witnet blockchain.
 * @param txHash The hash of the transaction to retrieve.
 */
export const getTransaction = (txHash: Bytes32 | Wildcard) => {
	checkRpcWildcards(txHash);
	if (!isHexStringOfLength(txHash, 32) && !isWildcard(txHash)) {
		throw new EvalError("rpc.wit.getTransaction: invalid transaction hash value");
	}
	return {
		method: "getTransaction",
		params: [txHash],
	};
};

/**
 * Retrieve detailed informatinon about a mined transaction in the Witnet blockchain.
 * @param txHash The hash of the transaction to retrieve.
 */
export const getValueTransfer = (hash: Bytes32 | Wildcard, mode: "ethereal" | "simple" | "full") => {
	checkRpcWildcards(hash);
	if (!isHexStringOfLength(hash, 32) && !isWildcard(hash)) {
		throw new EvalError("rpc.wit.getValueTransfer: invalid transaction hash value");
	}
	return {
		method: "getValueTransfer",
		params: { hash, mode },
	};
};
