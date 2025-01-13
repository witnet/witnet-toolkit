import { RadonRequest, RadonSLA, } from "../radon"
import { Node, } from "./node"
import { IProvider, } from "./provider"
import { Reporter, } from "./reporter"

import { 
    Balance, 
    Hash, 
    HexString,
    PublicKeyHashString, 
    Stake, 
    StakingCapability, 
    StakingPower, 
    UtxoInfo, Nanowits,
    u64,
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
    getBalance(path?: string): Promise<Balance>;
    getStake(path?: string): Promise<Stake>;
    getStakingPowers(path?: string, capability?: StakingCapability): Promise<Array<StakingPower>>;
    getUtxoInfo(path?: string): Promise<UtxoInfo>;
    sendDataRequest(request: RadonRequest, sla: RadonSLA): Promise<Hash>;
    sendValueTransfer(value: Nanowits, to: PublicKeyHashString, options?: ValueTransferTransactionOptions): Promise<Hash>;
    sendStakeTransaction(value: Nanowits, authCode: HexString, options?: StakeTransactionOptions): Promise<Hash>;
    sendUnstakeTransaction(value: Nanowits, options?: UnstakeTransactionOptions): Promise<Hash>;
}

export class Wallet implements IWallet {
    public static async from(node: Node) {
        return new Wallet(await node.getMasterKey(), node)
    }
    readonly coinbase: PublicKeyHashString
    readonly provider: IProvider
    // private sk: string
    constructor(_sk: string, provider?: IProvider) {
        // this.sk = sk
        if (!provider) this.provider = new Reporter() 
        else this.provider = provider
        this.coinbase ="wit"
    }
    public getPkh(_path?: string): PublicKeyHashString {
        // todo
        return ""
    }
    public getBalance(path?: string): Promise<Balance> {
        return this.provider.getBalance(this.getPkh(path))
    }
    public getStake(path?: string): Promise<Stake> {
        return this.provider.getStake(this.getPkh(path))
    }
    public getStakingPowers(path?: string, capability = StakingCapability.Mining): Promise<Array<StakingPower>> {
        return this.provider.getStakingPowers(this.getPkh(path), capability)
    }
    public getUtxoInfo(path?: string): Promise<UtxoInfo> {
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
