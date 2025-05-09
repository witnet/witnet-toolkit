import { 
    IProvider, 
    Balance, 
    Hash, 
    HexString, 
    QueryStakesOrder,
    Network, 
    StakeEntry, 
    ValueTransferOutput, 
} from "../types"

import { 
    Coins,
    KeyedSignature,
    PublicKey, 
    PublicKeyHashString,
    TransactionReceipt,
    Utxo, UtxoCacheInfo, UtxoSelectionStrategy,
} from "./types"

export { BIP32Interface as IBIP32 } from 'bip32'
export { IProvider } from "../rpc"

export interface IAccount extends ILedger {
    index: number
    internal: ISigner
    external: ISigner
}

export interface ILedger {
    
    cacheInfo: UtxoCacheInfo
    changePkh: PublicKeyHashString,
    network?: Network
    pkh: PublicKeyHashString
    provider: IProvider
    publicKey: PublicKey
    strategy: UtxoSelectionStrategy
    
    addUtxos(...utxos: Array<Utxo>): { excluded: Array<Utxo>, included: Array<Utxo> }
    consumeUtxos(...utxos: Array<Utxo>): any
    selectUtxos(specs?: { 
        value?: Coins, 
        reload?: boolean, 
        strategy?: UtxoSelectionStrategy,
    }): Promise<Array<Utxo>>

    getBalance(): Promise<Balance>
    getDelegatees(order?: QueryStakesOrder, leftJoin?: boolean): Promise<Array<StakeEntry>>
    getSigner(pkh?: PublicKeyHashString): ISigner | undefined
    getUtxos(specs?: any): Promise<Array<Utxo>>
}

export interface ICoinbase extends ISigner {
    authorizeStake(withdrawer: PublicKeyHashString): HexString
    getWithdrawers(order?: QueryStakesOrder): Promise<Array<StakeEntry>>
}

export interface ISigner extends ILedger {
    getStakeEntryNonce(validator: PublicKeyHashString): Promise<number>
    signHash(hash: any): KeyedSignature
}

export interface IWallet extends ILedger {
    accounts?: Array<IAccount>
    coinbase: ICoinbase
    deriveAccounts(index: number): Array<IAccount>
    exploreAccounts(params?: any): Promise<Array<IAccount>>
    getAccount(pkh: PublicKeyHashString, gap?: number): IAccount | undefined
    getSigner(pkh?: PublicKeyHashString, gap?: number): ISigner | undefined
}

interface IHashable {
    bytecode?: Uint8Array
    hash?: Hash
    toJSON(humanize?: boolean, params?: any): any
    toProtobuf(): any
}

export interface ITransmitter {
    network: Network
    payload?: any
    provider: IProvider
    transactions: Array<Hash>,
    type: string
    confirmTransaction(params?: any): Promise<TransactionReceipt>
    sendTransaction(params?: any): Promise<TransactionReceipt>
    signTransaction(params?: any, reload?: boolean): Promise<TransactionReceipt>
}

export interface ITransactionPayload<Specs> extends IHashable {
    change?: Coins
    covered: boolean
    fees?: Coins
    maxWeight: number
    prepared: boolean
    outputs: Array<ValueTransferOutput>
    target?: Specs
    value?: Coins
    weight: number
    consumeUtxos(ledger: ILedger, params?: any): any
    intoReceipt(target: Specs, network?: Network): any
    prepareOutputs(params?: any): any
    resetTarget(target: Specs): any
    toJSON(humanize?: boolean, network?: Network): any
    validateTarget(target?: Specs): Specs | undefined
}

export interface ITransactionPayloadMultiSig<Specs> extends ITransactionPayload<Specs> {
    inputs: Array<Utxo>
}
