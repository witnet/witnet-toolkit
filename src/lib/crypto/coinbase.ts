import { HexString } from "../types"
import { IBIP32, ICoinbase, IProvider } from "./interfaces"
import { PublicKeyHash, PublicKeyHashString, RecoverableSignature, UtxoSelectionStrategy } from "./types"

import { Signer } from "./signer"

export class Coinbase extends Signer implements ICoinbase {

    constructor(node: IBIP32, provider: IProvider, strategy?: UtxoSelectionStrategy) {
        super(node, provider, strategy)
        if (node.depth !== 0) {
            throw Error(`Coinbase: invalid BIP32 node depth: ${node.depth} > 0`)
        }
    }

    public authorizeStake(withdrawer: PublicKeyHashString): HexString {
        const msg = PublicKeyHash.fromBech32(withdrawer).toBytes32()
        const ks = this.signHash(msg)
        const signature = RecoverableSignature.fromKeyedSignature(ks, msg)
        return signature.pubKey.hash().toHexString() + signature.toHexString()
    }

}
