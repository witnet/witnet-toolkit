import { Type as ProtoType, Root as ProtoRoot } from "protobufjs"
const protoRoot = ProtoRoot.fromJSON(require("../../../witnet/witnet.proto.json"))

import { Hash, Nanowits, UtxoMetadata, ValueTransferOutput } from "../types"
import { toHexString } from "../utils"

import { ILedger, IProvider, ITransactionPayload, ITransactionPayloadMultiSig } from "./interfaces"
import { sha256 } from "./utils"
import { PublicKeyHashString } from "./types";

export abstract class TransactionPayload<Specs> implements ITransactionPayload<Specs> {
 
    protected _change: Nanowits;
    protected _covered: Nanowits;
    protected _protoType: ProtoType;
    protected _target?: Specs;
    
    constructor(protoTypeName: string, initialTarget?: Specs) {
        this._protoType = protoRoot.lookupType(protoTypeName)
        this._target = this.validateTarget(initialTarget)
        this._change = 0
        this._covered = 0
    }

    public get bytecode(): Uint8Array | undefined {
        // make toProtobuf return Protobuf's deserialized message
        const obj = this.toProtobuf()
        
        if (!obj) return undefined
        
        const err = this._protoType.verify(obj)
        if (err) {
            throw TypeError(err)
        } else {
            // console.log("\nobj =>", JSON.stringify(obj))
            const message = this._protoType.fromObject(obj)
            // console.log("\nmessage =>", JSON.stringify(message))
            const bytecode = this._protoType.encode(message).finish()
            // console.log("\nbytecode =>", toHexString(bytecode))
            return bytecode
        }
    }

    public get change(): Nanowits | undefined {
        return this._change > 0 ? this._change : undefined
    }

    public get covered(): boolean {
        return (
            !!this.fees
                && this._covered >= this.value + this.fees
        )
    }

    public get fees(): Nanowits {
        return (this._target as any)?.fees || 0
    }

    public get hash(): Hash | undefined {
        const _bytecode = this.bytecode
        if (_bytecode instanceof Uint8Array) {
            return toHexString(sha256(_bytecode))
        } else {
            return undefined
        }
    }

    public intoReceipt(target: Specs): any {
        return {
            ...target
        }
    }

    abstract consumeUtxos(ledger: ILedger): Promise<number>;
    abstract prepareOutputs(change?: { value: Nanowits, pkh: PublicKeyHashString }, params?: any): any;
    abstract resetTarget(target: Specs): any;
    abstract toJSON(humanize: boolean): any;
    abstract toProtobuf(): any;
    abstract validateTarget(target?: any): Specs | undefined;

    abstract get outputs(): Array<ValueTransferOutput>;
    abstract get maxWeight(): number;
    abstract get prepared(): boolean;
    abstract get value(): Nanowits;
    abstract get weight(): number;

    protected abstract _cleanTargetExtras(params?: any): any;
}

export abstract class TransactionPayloadMultiSig<Specs> 
    extends TransactionPayload<Specs>
    implements ITransactionPayloadMultiSig<Specs>
{
    protected _inputs: Array<Utxo>
    protected _outputs: Array<ValueTransferOutput>
    
    constructor(protoTypeName: string, initialTarget?: Specs) {
        super(protoTypeName, initialTarget)
        this._inputs = []
        this._outputs = []
    }

    public get inputs(): Array<Utxo> {
        return this._inputs
    }

    public get outputs(): Array<ValueTransferOutput> {
        return this._outputs
    }

    public get prepared(): boolean {
        return (
            this._inputs.length > 0 
                && this._outputs.length > 0
        )
    }

    public async consumeUtxos(ledger: ILedger, reload?: boolean): Promise<number> {
        if (!this._target) {
            throw new Error(`${this.constructor.name}: internal error: no in-flight params.`)
        } 
        const prepared = this.prepared
        if (!this.covered) {
            
            // consume utxos as to cover this.value, at least
            const utxos = await ledger.selectUtxos({ 
                value: this.value.pedros - this._covered, 
                reload,
            })
            this._covered += utxos.map(utxo => utxo.value).reduce((prev, curr) => prev + curr)
            this._inputs.push(...utxos)
            ledger.consumeUtxos(...utxos)

            // try to cover fees only if this.value is covered first
            if (this._covered >= this.value.pedros) {
                if ((this._target as any)?.fees instanceof Coins) {
                    this._fees = (this._target as any).fees.pedros;
                    if (this._covered < this.value.pedros + this._fees) {
                        const extras = await ledger.selectUtxos({ 
                            value: this.value.pedros + this._fees  - this._covered,
                        })
                        ledger.consumeUtxos(...extras)
                        this._inputs.push(...extras)
                    }
                    this._change = this._covered - (this.value.pedros + this._fees)
                } else {
                    const priority = (this._target as any)?.fees as TransactionPriority || TransactionPriority.Opulent
                    let estimatedFees = await this._estimateNetworkFees(ledger.provider, priority);
                    while (this._fees < estimatedFees) {
                        this._fees = estimatedFees
                        this._outputs = []
                        // add more utxos only if the ones selected for covering the value and the estimate fees don't suffice:
                        if (this._covered < this.value.pedros + this._fees) {
                            const extras = await ledger.selectUtxos({ 
                                value: this.value.pedros + this._fees - this._covered 
                            })
                            ledger.consumeUtxos(...extras)
                            this._covered += extras.map(utxo => utxo.value).reduce((prev, curr) => prev + curr)
                            this._inputs.push(...extras)
                        }
                        this._change = this._covered - (this.value.pedros + this._fees)
                        if (this._change < 0) {
                            // insufficient funds ...
                            break
                        } else {
                            this.prepareOutputs({ value: this._change, pkh: ledger.changePkh })
                            // iterate until actual fees match estimated fees
                            estimatedFees = await this._estimateNetworkFees(ledger.provider, priority)
                        }
                    }
                }
            }
        }
        // prepare outputs, only if value and fees got fully covered for the first time:
        if (this._change >= 0 && !prepared) {
            this.prepareOutputs({ value: this._change, pkh: ledger.changePkh })
        }
        return this._change
    }

    public prepareOutputs(change?: { value: Nanowits, pkh: PublicKeyHashString }): any {
        if (change?.value) {
            this._outputs.push({
                pkh: change.pkh,
                value: change.value,
                time_lock: 0,
            })
        }
    }

    public resetTarget(target: Specs): any {
        this._change = 0
        this._covered = 0
        this._inputs = []
        this._outputs = []
        this._target = target
    }

    abstract toJSON(humanize: boolean): any;
    abstract toProtobuf(): any;
    abstract validateTarget(target?: any): Specs | undefined;

    abstract get maxWeight(): number;
    abstract get value(): Nanowits;
    abstract get weight(): number;
    
    protected abstract _cleanTargetExtras(params?: any): any;
}
