import type { HexString, QueryStakesOrder, StakeEntry } from "../types.js";
import type { IBIP32, ICoinbase, IJsonRpcProvider } from "./interfaces.js";
import { Signer } from "./signer.js";
import {
	PublicKeyHash,
	type PublicKeyHashString,
	RecoverableSignature,
	type UtxoSelectionStrategy,
} from "./types.js";

export class Coinbase extends Signer implements ICoinbase {
	constructor(
		node: IBIP32,
		provider: IJsonRpcProvider,
		strategy?: UtxoSelectionStrategy,
	) {
		super(node, provider, strategy);
		if (node.depth !== 0) {
			throw Error(`Coinbase: invalid BIP32 node depth: ${node.depth} > 0`);
		}
	}

	public authorizeStake(withdrawer: PublicKeyHashString): HexString {
		const msg = PublicKeyHash.fromBech32(withdrawer).toBytes32();
		const ks = this.signHash(msg);
		const signature = RecoverableSignature.fromKeyedSignature(ks, msg);
		return signature.pubKey.hash().toHexString() + signature.toHexString();
	}

	public getWithdrawers(order?: QueryStakesOrder): Promise<Array<StakeEntry>> {
		return this.provider.stakes({
			filter: { validator: this.pkh },
			params: { order },
		});
	}
}
