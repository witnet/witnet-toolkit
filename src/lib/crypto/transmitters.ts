const promisePoller = require('promise-poller').default;

import { Root as ProtoRoot, Type as ProtoType } from "protobufjs"
const protoRoot = ProtoRoot.fromJSON(require("../../../witnet/witnet.proto.json")) 

import { isHexString } from "../../bin/helpers"

import { TransactionReport } from "../rpc/types"
import { Provider } from "../rpc"
import { Block, Hash, Network, SyncStatus } from "../types"

import { 
    ILedger,
    IProvider, 
    ITransmitter, 
    ITransactionPayload, 
    ITransactionPayloadMultiSig, 
} from "./interfaces"

import { 
    KeyedSignature, 
    PublicKey, 
    PublicKeyHashString, 
    TransactionCallback, 
    TransactionReceipt, 
    TransactionStatus, 
    Transmission,
    TransmissionError,
    Utxo,
} from "./types"


export abstract class Transmitter<Specs, Payload extends ITransactionPayload<Specs>> implements ITransmitter {
    
    public readonly ledger: ILedger;
    public readonly changePkh: PublicKeyHashString;
    
    protected _payload: Payload;
    protected _protoBuf: ProtoType;
    protected _signatures: Array<KeyedSignature> = []
    protected _transactions: Array<Hash> = []

    constructor (protoTypeName: string, payload: Payload, ledger: ILedger, changePkh?: PublicKeyHashString) {
        this._protoBuf = protoRoot.lookupType(protoTypeName)
        this._payload = payload;
        this.ledger = ledger
        if (!ledger.provider.network) {
            throw TypeError(`${this.constructor.name}: ledger's provider is not initialized.`)
        }
        this.changePkh = changePkh || ledger.changePkh
        if (!ledger.getSigner(this.changePkh)) {
            throw TypeError(`${this.constructor.name}: ledger holds no Signer for change address ${this.changePkh}.`)
        }
    }

    public get payload(): Payload | undefined {
        return this._payload.prepared ? this._payload : undefined
    }

    public get provider(): IProvider {
        return this.ledger.provider
    }

    public get network(): Network {
        return this.provider.network || "mainnet"
    }

    public get transactions(): Array<Hash> {
        return this._transactions
    }

    public get type(): string {
        return this._payload.constructor.name.split(/([a-z](?=[A-Z]))/g).slice(0, -1).join("")
    }

    protected get _from(): Array<PublicKeyHashString> | undefined {
        if (this._signatures.length > 0) {
            return this._signatures
                .map(ks => {
                    const pkh = PublicKey.fromProtobuf(ks.public_key).hash().toBech32(this.network)
                    return this.ledger.getSigner(pkh)?.pkh || this.ledger.pkh
                })
                // avoid repetitions
                .filter((pkh, index, array) => index === array.indexOf(pkh))
        
        } else {
            return undefined
        }
    }

    protected get _prepared(): boolean {
        return (
            this._payload.prepared
                && !!this._signatures
                && this._signatures.length > 0
        )
    }

    public async sendTransaction(target?: any): Promise<TransactionReceipt> {
        let receipt = this._getInflightReceipt()
        if (!receipt || target) {
            // if inflight not yet prepared, or prepared but not yet transmitted,
            // prepare a new inflight either with specified params (if any),
            // or previously prepared inflight (if known).
            receipt = await this.signTransaction(target || receipt)
        }
        if (receipt?.status && !receipt?.error) {
            // if current inflight was already transmitted and it's not yet known to fail ...
            return receipt
        }
        // if we reach this point is because an inflight transaction is 
        // ready to be transmitted
        Provider.receipts[receipt.hash].status = TransactionStatus.Pending
        delete Provider.receipts[receipt.hash].error
        return this.provider
            .sendRawTransaction(this._toJSON(false))
            .catch(err => {
                this._recoverInputUtxos();
                Provider.receipts[receipt.hash].error = err
                throw new TransmissionError(this._getInflightTransmission(), err)
            })
            .then(accepted => {
                if (accepted) {
                    this._recoverOutputUtxos()
                    Provider.receipts[receipt.hash].status = TransactionStatus.Relayed
                    return Provider.receipts[receipt.hash]
                    
                } else {
                    this._recoverInputUtxos()
                    const error = new Error(`Rejected by the RPC provider for unknown reasons.`)
                    Provider.receipts[receipt.hash].error = error
                    throw error
                }
            })
    }

    public async signTransaction(target?: Specs, reloadUtxos = false): Promise<TransactionReceipt> {
        target = await this._payload.validateTarget(target)
        if (!target) {
            // e.g. if called from this.send() with no params
            throw Error(`${this.constructor.name}: cannot sign a transaction if no params were previously specified.`)
        }
        
        const inflight = this._getInflightReceipt()
        if (inflight) {
            // console.log("sign.pendingReceipt =>", inflight)
            if (!inflight?.status) {
                // recover input utxos if previously signed params were not even attempted to be sent
                if (!reloadUtxos) this._recoverInputUtxos()
            
            } else if (inflight.status === TransactionStatus.Pending && !inflight.error) {
                // throw exception if a formerly signed transaction is still waiting to be relayed by a provider
                throw Error(`${this.constructor.name}: cannot sign until in-flight tx gets either relayed, or rejected: ${inflight.hash}`)
            }
        } 
        
        // clean current signatures, so new UTXOs can be consumed and therefore a new transaction hash be incepted
        this._cleanSignatures(target)
        
        // if not yet prepared, try to cover transaction expenses with existing utxos on signers:
        if (!this._payload.prepared) {
            await this._payload.consumeUtxos(this.ledger, reloadUtxos)
            .catch((err: any) => {
                throw Error(
                    `${this.constructor.name}: cannot consume UTXOs from ${this.ledger.constructor.name} ${this.ledger.pkh}: ${err}.`
                )
            })  
        }
        
        if (!this._payload.prepared) {
            // throws exeception if not enough utxos were found to cover transaction expenses:
            throw Error(
                `${this.constructor.name}: insufficient funds on ${this.ledger.constructor.name} ${this.ledger.pkh}.`
            )
        } 

        // double-check weight does not exceeds block limit...
        if (this._payload.weight > this._payload.maxWeight) {
            throw Error(
                `${this.constructor.name}: transaction weight exceeded block limit: ${this._payload.weight} > ${this._payload.maxWeight}.`
            )
        }

        // signing the transaction payload generates the transaction hash, and the receipt
        return this._upsertTransactionReceipt(this._signTransactionPayload(), target)    
    }

    public async waitTransaction(
        params?: Specs & { 
            confirmations?: number,
            onCheckpoint?: TransactionCallback,
            onStatusChange?: TransactionCallback,
            overallTimeout?: number,
        },
    ): Promise<TransactionReceipt>
    {
        const overallTimeout = (start: number, ms: number) => {
            return new Promise((_, reject) => {
                setTimeout(
                    () => reject(`${this.constructor.name}: polling timeout after ${Math.floor((Date.now() - start) / 1000)} secs).`), 
                    ms
                );
            });
        }
        return Promise.race([
            overallTimeout(Date.now(), params?.overallTimeout || 600000),
            
            this.sendTransaction(this._payload.validateTarget(params))
                .then((receipt: TransactionReceipt) => {
                    const hash = receipt.hash
                    const [confirmations, interval, timeout] = [
                        params?.confirmations || 0,
                        10000,
                        5000,
                    ];
                    if (params?.onStatusChange) {
                        params.onStatusChange(Provider.receipts[hash]);
                    }
                    return promisePoller({
                        taskFn: () => this.provider.getTransaction(receipt.hash),
                        shouldContinue: (_error: any, report: TransactionReport) => {
                            return !isHexString(report?.blockHash)
                        },
                        interval, timeout, 
                    }).then((report: TransactionReport) => {
                        Provider.receipts[hash].confirmations = 0
                        Provider.receipts[hash].blockHash = report.blockHash
                        Provider.receipts[hash].blockEpoch = report.blockEpoch
                        Provider.receipts[hash].status = TransactionStatus.Mined
                        // TBD: add blockMiner to report from provider.getTransaction
                        // TBD: add currentEpoch to report from provider.getTransaction
                        return this.provider.getBlock(report.blockHash)
                    }).then((block: Block) => {
                        Provider.receipts[hash].blockMiner = PublicKey
                            .fromProtobuf(block.block_sig.public_key)
                            .hash()
                            .toBech32(this.network);
                        if (confirmations > 0) {
                            if (params?.onStatusChange) params.onStatusChange(Provider.receipts[hash]);
                            return promisePoller({
                                taskFn: () => this.provider.syncStatus(),
                                shouldContinue: (_error: any, report: SyncStatus) => {
                                    if (Provider.receipts[hash]?.blockEpoch && report?.chain_beacon) {
                                        if (report.node_state === 'Synced') {
                                            const blockConfirmations = (
                                                report.chain_beacon.checkpoint
                                                    - Provider.receipts[hash].blockEpoch
                                            );
                                            if (blockConfirmations !== Provider.receipts[hash]?.confirmations) {
                                                Provider.receipts[hash].confirmations = blockConfirmations
                                                if (params?.onCheckpoint) params.onCheckpoint(Provider.receipts[hash])
                                            }
                                            return blockConfirmations < confirmations
                                        }
                                    }
                                    return true;
                                },
                                interval, timeout, 
                            }).then(() => {
                                return this.provider.getBlock(Provider.receipts[hash]?.blockHash || "")
                            })
                        } else {
                            return block;
                        }
                    }).then((block: Block) => {
                        Provider.receipts[hash].status = block.confirmed ? TransactionStatus.Finalized : TransactionStatus.Confirmed
                        if (params?.onStatusChange) params.onStatusChange(Provider.receipts[hash])
                        return Provider.receipts[hash]
                    })
                })
        ])
    }

    protected _cleanSignatures(newTarget: Specs): any {
        this._payload.resetTarget(newTarget)
        this._signatures = []
    }

    protected _getInflightBytecode(): Uint8Array | undefined {
        const obj = this._toProtobuf()
        const err = this._protoBuf.verify(obj)
        if (!err) {
            const message = this._protoBuf.fromObject(obj)
            return this._protoBuf.encode(message).finish()
        } else {
            return undefined
        }
    }

    protected _getInflightReceipt(): TransactionReceipt | undefined {
        const hash = this._payload.hash
        if (hash) {
            return Provider.receipts[hash]
        } else {
            return undefined
        }
    }

    protected _getInflightTransmission(): Transmission {
        return {
            bytecode: this._getInflightBytecode(),
            hash: this._payload.hash,
            message: this._toJSON(true),
        }
    }

    protected _recoverInputUtxos(): any {}
    protected _recoverOutputUtxos(): any {}

    protected _upsertTransactionReceipt(hash: Hash, target: Specs): TransactionReceipt {
        Provider.receipts[hash] = {
            ...this._payload.intoReceipt(target, this.network),
            hash,
            change: this._payload.change,
            fees: this._payload.fees,
            from: this._from,
            timestamp: Date.now(),
            tx: this._toJSON(true),
            type: this.type,
            value: this._payload.value,
            weight: this._payload.weight,
        }
        return Provider.receipts[hash]
    }

    protected abstract _signTransactionPayload(): Hash;
    protected abstract _toJSON(_humanize: boolean): any;
    protected abstract _toProtobuf(): any;

    // abstract signTransaction(target?: any, params?: any): Promise<TransactionReceipt>;
    // protected abstract get _from(): Array<PublicKeyHashString> | PublicKeyHashString | undefined;
    // protected abstract _prepared: boolean;
}


export abstract class TransmitterMultiSig<Specs, Payload extends ITransactionPayloadMultiSig<Specs>> 
    extends Transmitter<Specs, Payload> 
{
    constructor (protoTypeName: string, payload: Payload, ledger: ILedger, changePkh?: PublicKeyHashString) {
        super(protoTypeName, payload, ledger, changePkh)
        this._payload = payload;
    }

    /// Recover formerly consumed UTXOs by a failing transaction back to their respective signer's UTXO pool
    protected _recoverInputUtxos(): any {
        if (this._payload.inputs) {    
            this.ledger.addUtxos(...this._payload.inputs)
        }
    }

    /// Recover self-targeted outputs as expendable utxos on their respective signer's memoized cache
    protected _recoverOutputUtxos(): any {
        if (this._payload.hash && this._payload.outputs) {
            const utxos: Array<Utxo> = []
            this._payload.outputs.forEach((vto, index) => {    
                if (this.ledger.getSigner(vto.pkh)) utxos.push({
                    signer: vto.pkh,
                    output_pointer: `${this._payload.hash}:${index}`,
                    timelock: vto.time_lock,
                    value: vto.value,
                })
            })
            this.ledger.addUtxos(...utxos)
        }
    }

    protected _signTransactionPayload(): Hash {
        const hash = this._payload.hash
        if (!hash) {
            throw Error(
                `${this.constructor.name}: internal error: unable to hashify payload: ${this._payload.toJSON(true, this.network)}}.`
            )
        } else {
            this._payload.inputs.forEach(utxo => { 
                const signer = this.ledger.getSigner(utxo.signer)
                if (!signer) throw Error(
                    `${this.constructor.name}: internal error: cannot find Signer ${utxo.signer} in ${this.ledger.constructor.name} ${this.ledger.pkh}.`    
                ); else {
                    // console.log(`...signer ${signer.pkh} signing hash ${hash}...`)
                    this._signatures.push(signer.signHash(hash)) 
                }
            })
            return hash
        }
    }

    protected _toJSON(humanize: boolean): any {
        return { 
            [this.type]: { 
                body: this._payload.toJSON(humanize, this.network),
                signatures: this._signatures,
            },
        }
    }

    protected _toProtobuf(): any {
        const body = this._payload.toProtobuf()
        if (body && this._signatures) {
            return {
                body,
                signatures: this._signatures,
            }
        }
    }
}
