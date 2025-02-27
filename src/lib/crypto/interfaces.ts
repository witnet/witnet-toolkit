import { 
    IProvider, 
    Balance, 
    Hash, 
    HexString, 
    QueryStakesOrder,
    Nanowits, 
    Network, 
    StakeEntry, 
    UtxoMetadata, 
    ValueTransferOutput, 
} from "../types"

import { 
    KeyedSignature,
    PublicKey, 
    PublicKeyHashString,
    TransactionReceipt,
    UtxoSelectionStrategy,
} from "./types"

export { BIP32Interface as IBIP32 } from 'bip32'
export { IProvider } from "../rpc"

export interface IAccount extends IAccountable {
    index: number
    internal: ISigner
    external: ISigner
}

export interface IAccountable {
    network?: Network
    pkh: PublicKeyHashString
    provider: IProvider
    publicKey: PublicKey
    strategy: UtxoSelectionStrategy
    getBalance(): Promise<Balance>
    getDelegates(order?: QueryStakesOrder, leftJoin?: boolean): Promise<Array<StakeEntry>>
    countUtxos(reload?: boolean): Promise<number>
}

export interface ICoinbase extends ISigner {
    authorizeStake(withdrawer: PublicKeyHashString): HexString
}

export interface ISigner extends IAccountable {
    addUtxos(...utxos: Array<UtxoMetadata>): any
    consumeUtxos(index: number): any
    getDelegateNonce(validator: PublicKeyHashString): Promise<number>
    getUtxos(force?: boolean): Promise<Array<UtxoMetadata>>
    selectUtxos(strategy?: UtxoSelectionStrategy): Promise<Array<UtxoMetadata>>
    signHash(hash: any): KeyedSignature
}

export interface IWallet extends IAccountable {
    accounts?: Array<IAccount>
    coinbase: ICoinbase
    gap: number
    signers: Array<ISigner>
    deriveAccounts(index: number): Array<IAccount>
    exploreAccounts(gap?: number): Promise<Array<IAccount>>
    findAccount(pkh: PublicKeyHashString, gap?: number): IAccount | undefined
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
    sendTransaction(params?: any): Promise<TransactionReceipt>
    signTransaction(params?: any): Promise<TransactionReceipt>
    waitTransaction(params?: any): Promise<TransactionReceipt>
}

export interface ITransactionPayload<Specs> extends IHashable {
    change?: Nanowits
    covered: boolean
    fees: Nanowits
    maxWeight: number
    prepared: boolean
    outputs: Array<ValueTransferOutput>
    target?: Specs
    value: Nanowits
    weight: number
    consumeUtxos(signer: ISigner, params?: any): any
    intoReceipt(target: Specs, network?: Network): any
    prepareOutputs(params?: any): any
    resetTarget(target: Specs): any
    toJSON(humanize?: boolean, network?: Network): any
    validateTarget(target?: Specs): Specs | undefined
}

export interface ITransactionPayloadMultiSig<Specs> extends ITransactionPayload<Specs> {
    inputs: Array<[PublicKeyHashString, UtxoMetadata]>
    consumeUtxos(signer: ISigner, changePkh?: PublicKeyHashString, params?: any): any
}
