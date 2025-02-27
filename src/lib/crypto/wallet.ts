import * as utils from "./utils"

import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
const bip32 = BIP32Factory(ecc);

import { Balance, Network, QueryStakesOrder, StakeEntry, StakesOrderBy } from "../types"
import { Account } from "./account"
import { Coinbase } from "./coinbase"
import { IAccount, IBIP32, ICoinbase, IProvider, ISigner, IWallet } from "./interfaces"
import { PublicKey, PublicKeyHashString, UtxoSelectionStrategy } from "./types"

export class Wallet implements IWallet {
    protected root: IBIP32;
    
    protected _accounts: Array<IAccount> = [];

    public readonly coinbase: ICoinbase;
    public gap: number;
    public readonly provider: IProvider;
    public strategy: UtxoSelectionStrategy;
    
    static async fromXprv(xprv: string, provider: IProvider, strategy?: UtxoSelectionStrategy, gap?: number): Promise<Wallet> {
        const { chainCode, privateKey } = utils.parseXprv(xprv);
        const root = bip32.fromPrivateKey(Buffer.from(privateKey), Buffer.from(chainCode));
        return provider.constants() // assure provider the network connecting to is known
            .then(() => new Wallet(root, provider, strategy, gap))
            .catch(err => {
                throw Error(`Wallet: cannot read consensus constants from the provider: ${err}`)
            });
    }

    static async fromEncryptedXprv(xprv: string, passwd: string, provider: IProvider, strategy?: UtxoSelectionStrategy, gap?: number): Promise<Wallet> {
        return Wallet.fromXprv(utils.decipherXprv(xprv, passwd), provider, strategy, gap)
    }
    
    constructor(root: IBIP32, provider: IProvider, strategy?: UtxoSelectionStrategy, gap?: number) {
        this.gap = gap || 20
        this.provider = provider
        this.coinbase = new Coinbase(root, provider, strategy)
        this.root = root
        this.strategy = strategy || UtxoSelectionStrategy.SmallFirst
    }

    public get accounts(): Array<IAccount> | undefined {
        return this._accounts
    }

    public get network(): Network | undefined {
        return this.provider.network
    }

    public get pkh(): PublicKeyHashString {
        return this.coinbase.pkh
    }

    public get publicKey(): PublicKey {
        return this.coinbase.publicKey
    }

    public get signers(): Array<ISigner> {
        const signers: Array<ISigner> = []
        if (this.accounts) {
            this.accounts.reverse().forEach(account => signers.push(account.internal, account.external))
        } else {
            signers.push(this.coinbase)
        }
        return signers
    }

    public deriveAccounts(limit: number): Array<IAccount> {
        if (limit > this._accounts.length) {
            for (let ix = this._accounts.length; ix < limit; ix ++) {
                this._accounts[ix] = new Account(
                    this.root, 
                    this.provider, 
                    ix,
                    this.strategy,
                )
            }
        }
        return this._accounts
    }

    public async exploreAccounts(limit: number, gap?: number): Promise<Array<IAccount>> {
        const extras: Array<IAccount> = []
        let current_gap = gap || this.gap
        let index = this._accounts.length
        // add all accounts with funds in the next `gap`
        for (; index < this._accounts.length + current_gap; index ++) {
            const account = new Account(this.root, this.provider, index, this.strategy)
            if ((await account.getBalance()).unlocked > 0) {
                extras.push(account)
                current_gap = extras.length + (gap || this.gap)
                if (limit && extras.length >= limit) break;
            }
        }
        if (extras.length > 0) {
            this._accounts.push(...extras)
        } else if (this._accounts.length === 0) {
            // if no accounts yet in the wallet, 
            // and no  accounts with funds were found, 
            // derive wallet's first account:
            return this.deriveAccounts(0)
        }
        return this._accounts
    }

    public findAccount(pkh: PublicKeyHashString, gap?: number): IAccount | undefined {
        let account = this._accounts.find(account => account.internal.pkh === pkh || account.pkh === pkh)
        if (!account) {
            for (let index = 0; index < (gap || this.gap); index ++) {
                account = new Account(this.root, this.provider, index, this.strategy)
                if (account.pkh === pkh || account.internal.pkh === pkh) {
                    this._accounts.push(account)
                    return account
                }
            }
            return undefined
        } else {
            return account
        }
    }


    /// IAccountable ----------------------------------------------------------

    public async countUtxos(reload?: boolean): Promise<number> {
        if (this._accounts.length > 0) {
            return Promise
                .all(this._accounts.map((acc: IAccount) => acc.countUtxos()))
                .then((counts: Array<number>) => {
                    return counts.reduce((prev, curr) => prev + curr, 0)
                })
        
            } else {
            return this.coinbase.countUtxos(reload)
        }
    }

    public async getBalance(): Promise<Balance> {
        if (this._accounts.length > 0) {
            return Promise
                .all(this._accounts.map((acc: IAccount) => acc.getBalance()))
                .then((balances: Array<Balance>) => {
                    return balances.reduce((prev, curr) => {
                        return {
                            locked: prev.locked + curr.locked,
                            staked: prev.staked + curr.staked,
                            unlocked: prev.unlocked + curr.unlocked,
                        }
                    })
                })
        
            } else {
            return this.coinbase.getBalance()
        }
    }

    public async getDelegates(order?: QueryStakesOrder, leftJoin = true): Promise<Array<StakeEntry>> {
        // if (this._accounts.length > 0) {
            const records: Array<StakeEntry> = []
            records.push(...await this.coinbase.getDelegates(order))
            await Promise.all(this._accounts.map(account => account.getDelegates(order, leftJoin).then(entries => records.push(...entries))))
            if (order) {
                const reverse = order?.reverse ? (+1) : (-1)
                return records.sort((a, b) => {
                    switch (order.by) {
                        case StakesOrderBy.Coins: return (b.value.coins - a.value.coins) * reverse;
                        case StakesOrderBy.Mining: return (b.value.epochs.mining - a.value.epochs.mining) * reverse;
                        case StakesOrderBy.Witnessing: return (b.value.epochs.witnessing - a.value.epochs.witnessing) * reverse;
                        case StakesOrderBy.Nonce: return (b.value.nonce - a.value.nonce) * reverse;
                    }
                })
            }
            return records
        // } else {
        //     return this.coinbase.getDelegates(order)
        // }
    }
}
