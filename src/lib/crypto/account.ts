import { Balance, Network, QueryStakesOrder, StakeEntry } from "../types"
import { IAccount, IBIP32, IProvider, ISigner } from "./interfaces"
import { PublicKey, PublicKeyHashString, UtxoSelectionStrategy } from "./types"

import { Signer } from "./signer"

export class Account implements IAccount {    
    
    public readonly index: number
    public readonly internal: ISigner
    public readonly external: ISigner

    public readonly provider: IProvider
    public strategy: UtxoSelectionStrategy

    constructor(root: IBIP32, provider: IProvider, index: number, strategy?: UtxoSelectionStrategy) {
        this.index = index
        this.external = new Signer(root.derivePath(`m/3'/4919'/0'/0/${index}`), provider, strategy)
        this.internal = new Signer(root.derivePath(`m/3'/4919'/0'/1/${index}`), provider, strategy)
        if (!provider.network) {
            throw new Error(`Account: uninitialized provider.`)
        }
        this.provider = provider
        this.strategy = strategy || UtxoSelectionStrategy.SmallFirst
    }

    public get pkh(): PublicKeyHashString {
        return this.external.pkh
    }

    public get publicKey(): PublicKey {
        return this.external.publicKey
    }

    public get network(): Network | undefined {
        return this.provider.network
    }

    public async countUtxos(reload = false): Promise<number> {
        return Promise.all([
            this.internal.getUtxos(reload),
            this.external.getUtxos(reload),
        ]).then(([internal, external]) => {
            return (
                internal.length 
                    + external.length
            )
        })
    }

    public async getBalance(): Promise<Balance> {
        return Promise.all([
            this.internal.getBalance(),
            this.external.getBalance(),
        ]).then(([internal, external]) => {
            return {
                locked: internal.locked + external.locked,
                staked: internal.staked + external.staked,
                unlocked: internal.unlocked + external.unlocked
            }
        })
    }

    public async getDelegates(order?: QueryStakesOrder, leftJoin = true): Promise<Array<StakeEntry>> {
        return this.provider
            .stakes({
                filter: { withdrawer: this.pkh },
                params: { order }
            }).then(records => {
                if (records.length  === 0 && leftJoin) {
                    return [{ 
                        key: { validator: "", withdrawer: this.pkh }, 
                        value: { 
                            coins: 0, 
                            nonce: 0, 
                            epochs: { mining: 0, witnessing: 0 }
                        } 
                    }]
                } else {
                    return records
                }
            })
    }
}
