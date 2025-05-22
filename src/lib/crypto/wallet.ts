import * as utils from "./utils"

import BIP32Factory from 'bip32';
import * as ecc from 'tiny-secp256k1';
const bip32 = BIP32Factory(ecc);

import { JsonRpcProvider } from "../rpc"
import { Balance, Network, QueryStakesOrder, StakeEntry, StakesOrderBy } from "../types"
import { Account } from "./account"
import { Coinbase } from "./coinbase"
import { IAccount, IBIP32, ICoinbase, IJsonRpcProvider, ISigner, IWallet } from "./interfaces"
import { Coins, PublicKey, PublicKeyHashString, Utxo, UtxoCacheInfo, UtxoSelectionStrategy } from "./types"

const DEFAULT_GAP = 20;

export class Wallet implements IWallet {
    protected root: IBIP32;
    
    protected _accounts: Array<IAccount> = [];

    public readonly coinbase: ICoinbase;
    public readonly provider: IJsonRpcProvider;
    public strategy: UtxoSelectionStrategy;

    /**
     * Create a Wallet by reading the XPRV master key from the WITNET_SDK_WALLET_MASTER_KEY environment variable.
     * @param specs Wallet creation parameters.
     */
    static async fromEnv(options: {
        /**
         * Password to decrypt the XPRV master key read from environment, in case it's encrypted.
         */
        passwd?: string,
        /**
         * Number of consecutive accounts with no funds before stopping derivation of new Wallet accounts.
         */
        gap?: number,
        /**
         * Maximum number of accounts to derive. 
         */
        limit?: number,
        /**
         * Specific Wit/RPC provider to use for interacting with the Witnet network.
         */
        provider?: IJsonRpcProvider, 
        /**
         * UTXO selection strategy when building transactions out of this wallet (default: UtxoSelectionStrategy.SmallFirst).
         */
        strategy?: UtxoSelectionStrategy, 
        /**
         * Only derive accounts that hold some unlocked balance of $WIT.
         */
        onlyWithFunds?: boolean,
    }): Promise<Wallet> {
        const xprv = process.env.WITNET_SDK_WALLET_MASTER_KEY
        if (!xprv) throw Error(`WITNET_SDK_WALLET_MASTER_KEY must be set on environment.`)
        if (xprv.length > 117) {
            if (!options.passwd) throw Error(`Missing password for WITNET_SDK_WALLET_MASTER_KEY.`)
            return Wallet.fromEncryptedXprv(xprv, options?.passwd, options)
        } else {
            return Wallet.fromXprv(xprv, options)
        }
    }
    
    /**
     * Create a Wallet by using passed XPRV master key.
     * @param xprv Decrypted XPRV master key string.
     * @param options Wallet creation parameters.
     */
    static async fromXprv(
        xprv: string,
        options?: {
            /**
             * Number of consecutive accounts with no funds before stopping derivation of new Wallet accounts.
             */
            gap?: number,
            /**
             * Maximum number of accounts to derive. 
             */
            limit?: number,
            /**
             * Specific Wit/RPC provider to use for interacting with the Witnet network.
             */
            provider?: IJsonRpcProvider, 
            /**
             * UTXO selection strategy when building transactions out of this wallet (default: UtxoSelectionStrategy.SmallFirst).
             */
            strategy?: UtxoSelectionStrategy, 
            /**
             * Only derive accounts holding some $WIT funds (either locked, staked or unlocked).
             */
            onlyWithFunds?: boolean,
        }
    ): Promise<Wallet> {
        const { chainCode, privateKey } = utils.parseXprv(xprv);
        const root = bip32.fromPrivateKey(Buffer.from(privateKey), Buffer.from(chainCode));
        const provider = options?.provider || (await JsonRpcProvider.fromEnv())
        await provider.constants()
        const wallet = new Wallet(root, provider, options?.strategy)
        if (options?.onlyWithFunds) {
            await wallet.exploreAccounts(options?.limit || 0, options?.gap)
        } else {
            wallet.deriveAccounts(options?.limit || 1)
        }
        // load up utxos cache
        await wallet.getUtxos(true)
        return wallet
    }

    /**
     * Create a Wallet by using passed XPRV master key.
     * @param xprv Encrypted XPRV master key string.
     * @param passwd Password to decipher the XPRV master key.
     * @param options Wallet creation parameters.
     */
    static async fromEncryptedXprv(
        xprv: string,
        passwd: string,
        options?: {
            /**
             * Number of consecutive accounts with no funds before stopping derivation of new Wallet accounts.
             */
            gap?: number,
            /**
             * Maximum number of accounts to derive. 
             */
            limit?: number,
            /**
             * Specific Wit/RPC provider to use for interacting with the Witnet network.
             */
            provider?: IJsonRpcProvider, 
            /**
             * UTXO selection strategy when building transactions out of this wallet (default: UtxoSelectionStrategy.SmallFirst).
             */
            strategy?: UtxoSelectionStrategy, 
            /**
             * Only derive accounts holding some $WIT funds (either locked, staked or unlocked).
             */
            onlyWithFunds?: boolean,
        }
    ): Promise<Wallet> {
        return Wallet.fromXprv(utils.decipherXprv(xprv, passwd), options)
    }
    
    constructor(root: IBIP32, provider: IJsonRpcProvider, strategy?: UtxoSelectionStrategy) {
        this.provider = provider
        this.coinbase = new Coinbase(root, provider, strategy)
        this.root = root
        this.strategy = strategy || UtxoSelectionStrategy.SmallFirst
        this.deriveAccounts(1)
    }

    public get accounts(): Array<IAccount> {
        return this._accounts
    }

    public get cacheInfo(): UtxoCacheInfo {
        const info: UtxoCacheInfo = { expendable: 0n, size: 0, timelock: Number.MAX_SAFE_INTEGER }
        this.accounts?.forEach(account => {
            const accountInfo = account.cacheInfo
            info.expendable += accountInfo.expendable
            info.size += accountInfo.size
            if (accountInfo.timelock !== 0 && accountInfo.timelock < info.timelock) {
                info.timelock = accountInfo.timelock
            }
        })
        if (info.timelock === Number.MAX_SAFE_INTEGER) info.timelock = 0;
        return info;
    }

    public get changePkh(): PublicKeyHashString {
        return this.accounts.length > 0 ? this.accounts[0].changePkh : this.coinbase.pkh
    }

    public get network(): Network | undefined {
        return this.provider.network
    }

    public get pkh(): PublicKeyHashString {
        return this.accounts.length > 0 ? this.accounts[0].pkh : this.coinbase.pkh
    }

    public get publicKey(): PublicKey {
        return this.accounts.length > 0 ? this.accounts[0].publicKey : this.coinbase.publicKey
    }

    public addUtxos(...utxos: Array<Utxo>): { excluded: Array<Utxo>, included: Array<Utxo> } {
        const included: Array<Utxo> = []
        this.accounts.forEach(account => {
            const _utxos = account.addUtxos(...utxos)
            utxos = _utxos.excluded
            included.push(..._utxos.included)
        })
        return {
            excluded: utxos,
            included
        }
    }

    public consumeUtxos(...utxos: Array<Utxo>): Array<Utxo> {
        this.accounts.forEach(account => {
            utxos = account.consumeUtxos(...utxos)
        })
        return utxos
    }

    public async getBalance(): Promise<Balance> {
        if (this._accounts.length > 0) {
            return Promise
                .all(this._accounts.map(async (acc: IAccount) => { 
                    const balance = await acc.getBalance()
                    return balance }))
                .then((balances: Array<Balance>) => {
                    return balances.reduce((prev, curr) => {
                        return {
                            locked: prev.locked + curr.locked,
                            staked: prev.staked + curr.staked,
                            unlocked: prev.unlocked + curr.unlocked,
                        }
                    }, { locked: 0n, staked: 0n, unlocked: 0n })
                })
        } else {
            return this.coinbase.getBalance()
        }
    }

    public async getDelegatees(order?: QueryStakesOrder, leftJoin = true): Promise<Array<StakeEntry>> {
        const records: Array<StakeEntry> = []
        records.push(...await this.coinbase.getDelegatees(order))
        await Promise.all(this._accounts.map(account => account.getDelegatees(order, leftJoin).then(entries => records.push(...entries))))
        if (order) {
            const reverse = order?.reverse ? (+1) : (-1)
            return records.sort((a, b) => {
                switch (order.by) {
                    case StakesOrderBy.Coins: return ((a.value.coins < b.value.coins) ? 1 : ((a.value.coins > b.value.coins) ? -1 : 0)) * reverse;
                    case StakesOrderBy.Mining: return (b.value.epochs.mining - a.value.epochs.mining) * reverse;
                    case StakesOrderBy.Witnessing: return (b.value.epochs.witnessing - a.value.epochs.witnessing) * reverse;
                    case StakesOrderBy.Nonce: return (b.value.nonce - a.value.nonce) * reverse;
                }
            })
        }
        return records
    }

    public async getUtxos(reload?: boolean): Promise<Array<Utxo>> {
        return Promise
            .all(this.accounts.map(account => account.getUtxos(reload)))
            .then(async (utxoss: Array<Array<Utxo>>) => {
                utxoss.push(await this.coinbase.getUtxos(reload))
                return utxoss.flat()
            })
    }

    public async selectUtxos(specs?: {
        value?: Coins,
        reload?: boolean
        strategy?: UtxoSelectionStrategy
    }): Promise<Array<Utxo>> {
        return this
            .getUtxos(specs?.reload)
            .then(utxos => utils.selectUtxos({ utxos, value: specs?.value, strategy: specs?.strategy || this.strategy }))
    }

    // ================================================================================================================
    // --- IWallet ----------------------------------------------------------------------------------------------------

    public deriveAccounts(limit: number): Array<IAccount> {
        if (limit > this._accounts.length) {
            const startIndex = this._accounts.length > 0 ? this.accounts[this.accounts.length - 1].index + 1 : 0
            limit = limit - this._accounts.length
            for (let ix = 0; ix < limit; ix ++) {
                this._accounts.push(new Account(
                    this.root,
                    this.provider,
                    startIndex + ix,
                    this.strategy
                ))
            }
        }
        return this._accounts
    }

    public async exploreAccounts(limit = 0, gap = DEFAULT_GAP): Promise<Array<IAccount>> {
        if (limit === 0 || limit > this.accounts.length) {
            const lastIndex = (x: Array<IAccount>) => x.length > 0 ? x[x.length - 1].index + 1 : 0
            const startIndex = lastIndex(this.accounts)
            for (let index = startIndex; index < lastIndex(this.accounts) + gap; index ++) {
                const account = new Account(this.root, this.provider, index, this.strategy)
                if (utils.totalCoins(await account.getBalance()).pedros > 0n) {
                    this.accounts.push(account)
                    if (limit && this.accounts.length >= limit) break;
                }
            }
        }
        return this._accounts
    }

    public getAccount(pkh: PublicKeyHashString, gap?: number): IAccount | undefined {
        let account = this._accounts.find(account => account.internal.pkh === pkh || account.pkh === pkh)
        if (!account) {
            for (let index = 0; index < (gap || DEFAULT_GAP); index ++) {
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

    public getSigner(pkh?: PublicKeyHashString, gap?: number): ISigner | undefined {
        if (!pkh) return this.accounts[0]?.getSigner() || this.coinbase.getSigner(pkh);
        const account = this.getAccount(pkh, gap)
        return account?.getSigner(pkh) || this.coinbase.getSigner(pkh)
    }
}
