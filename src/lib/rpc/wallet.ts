import { RadonRequest, RadonSLA, } from "../radon"
import { IProvider, } from "./provider"
import { Reporter, } from "./reporter"

import { 
    Balance2, 
    Hash, 
    HexString,
    PublicKeyHashString, 
    Nanowits,
    u64,
    UtxoMetadata,
} from "./types"

export type ValueTransferTransactionOptions = {
    fee?: Nanowits,
    from?: PublicKeyHashString,
}

export type StakeTransactionOptions = {
    fee?: Nanowits,
    from?: PublicKeyHashString,
    nonce?: u64,
    withdrawer?: PublicKeyHashString,
}

export type UnstakeTransactionOptions = {
    fee?: Nanowits,
    from?: PublicKeyHashString,
    nonce?: u64,
    withdrawer?: PublicKeyHashString,
    validator?: PublicKeyHashString,
}

export interface IWallet {
    getPkh(path?: string): PublicKeyHashString;
    getBalance(path?: string): Promise<Balance2>;
    getUtxoInfo(path?: string): Promise<Array<UtxoMetadata>>;
    sendDataRequest(request: RadonRequest, sla: RadonSLA): Promise<Hash>;
    sendValueTransfer(value: Nanowits, to: PublicKeyHashString, options?: ValueTransferTransactionOptions): Promise<Hash>;
    sendStakeTransaction(value: Nanowits, authCode: HexString, options?: StakeTransactionOptions): Promise<Hash>;
    sendUnstakeTransaction(value: Nanowits, options?: UnstakeTransactionOptions): Promise<Hash>;
}

export class Wallet implements IWallet {
    readonly coinbase: PublicKeyHashString
    readonly provider: IProvider
    // private sk: string
    constructor(_sk: string, provider?: IProvider) {
        // this.sk = sk
        if (!provider) this.provider = new Reporter() 
        else this.provider = provider
        this.coinbase ="wit" + _sk
    }
    public getPkh(_path?: string): PublicKeyHashString {
        // todo
        return ""
    }
    public getBalance(path?: string): Promise<Balance2> {
        return this.provider.getBalance(this.getPkh(path))
    }
    
    public getUtxoInfo(path?: string): Promise<Array<UtxoMetadata>> {
        return this.provider.getUtxoInfo(this.getPkh(path))
    }
    sendDataRequest(_request: RadonRequest, _sla: RadonSLA): Promise<Hash> {
        // TODO
        throw "Not implemented"
    }
    sendValueTransfer(_value: Nanowits, _to: PublicKeyHashString, _options?: ValueTransferTransactionOptions): Promise<Hash> {
        // TODO
        throw "Not implemented"
    }
    sendStakeTransaction(_value: Nanowits, _authCode: HexString, _options?: StakeTransactionOptions): Promise<Hash> {
        // TODO
        throw "Not implemented"
    }
    sendUnstakeTransaction(_value: Nanowits, _options?: UnstakeTransactionOptions): Promise<Hash> {
        // TODO
        throw "Not implemented"
    }
}
