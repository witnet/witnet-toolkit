import { Type as ProtoType, Root as ProtoRoot } from "protobufjs"
const protoRoot = ProtoRoot.fromJSON(require("../../../witnet/witnet.proto.json"))

import { Hash, Nanowits, UtxoMetadata, ValueTransferOutput } from "../types"
import { toHexString } from "../utils"

import { ISigner, ITransactionPayload, ITransactionPayloadMultiSig } from "./interfaces"
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
            // console.log("\nbytecode =>", bytecode)
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

    abstract consumeUtxos(signer: ISigner): Promise<number>;
    abstract prepareOutputs(change?: { value: Nanowits, sender: PublicKeyHashString }, params?: any): any;
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
    protected _inputs: Array<[PublicKeyHashString, UtxoMetadata]>
    protected _outputs: Array<ValueTransferOutput>
    
    constructor(protoTypeName: string, initialTarget?: Specs) {
        super(protoTypeName, initialTarget)
        this._inputs = []
        this._outputs = []
    }

    public get inputs(): Array<[PublicKeyHashString, UtxoMetadata]> {
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

    public async consumeUtxos(signer: ISigner, changePkh?: PublicKeyHashString): Promise<number> {
        if (!this._target) {
            throw new Error(`${this.constructor.name}: internal error: no in-flight params.`)
        } 
        const prepared = this.prepared
        if (!this.covered) {
            const utxos = await signer.selectUtxos({ cover: this.fees + this.value - this._covered })
            let index = 0
            while (index < utxos.length && !this.covered) {
                const utxo = utxos[index ++]
                if (utxo) {
                    this._inputs.push([ signer.pkh, utxo ])
                    this._covered += utxo.value
                }
            }
            signer.consumeUtxos(index)
        }
        this._change = this._covered - (this.value + this.fees)
        if (this._change >= 0 && !prepared) {
            this.prepareOutputs({ value: this._change, sender: changePkh || signer.pkh })
        }
        return this._change
    }

    public prepareOutputs(change?: { value: Nanowits, sender: PublicKeyHashString }): any {
        if (change?.value) {
            this._outputs.push({
                pkh: change.sender,
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
