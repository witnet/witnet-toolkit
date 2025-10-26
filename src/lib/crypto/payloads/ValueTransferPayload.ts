import Long from "long"

import { fromHexString } from "../../../bin/helpers.js"
import { IJsonRpcProvider } from "../../types.js"

import { TransactionPayloadMultiSig } from "../payloads.js"
import { Coins, PublicKeyHash, PublicKeyHashString, TransactionParams, TransactionPriority } from "../types.js"

export type ValueTransferParams = TransactionParams & {
    recipients: Array<[pkh: PublicKeyHashString, value: Coins]>,
    timelock?: number,
}

const TX_WEIGHT_INPUT_SIZE = 133;
const TX_WEIGHT_OUTPUT_SIZE = 36;
const TX_WEIGHT_GAMMA = 10;

export class ValueTransferPayload extends TransactionPayloadMultiSig<ValueTransferParams> {

    public static MAX_WEIGHT = 20000;
    
    constructor (protoTypeName: string, initialTarget?: ValueTransferParams) {
        super(protoTypeName, initialTarget)
    }

    public get maxWeight(): number {
        return ValueTransferPayload.MAX_WEIGHT
    }

    public get value(): Coins {
        return Coins.fromPedros(this._target?.recipients.reduce((prev, [,curr]) => prev + curr.pedros, 0n) || 0n)
    }

    public get weight(): number {
        return (
            this._inputs.length * TX_WEIGHT_INPUT_SIZE 
                + this._outputs.length * TX_WEIGHT_OUTPUT_SIZE * TX_WEIGHT_GAMMA
        );
    }

    public prepareOutputs(change?: { value: bigint, pkh: PublicKeyHashString }): any {
        if (this._target && this._outputs.length === 0) {
            this._outputs.push(...this._target.recipients.map(([pkh, value]) => ({
                pkh, 
                value: value.pedros, 
                time_lock: this._target?.timelock || 0
            })));
            super.prepareOutputs(change)
        }
    }

    public intoReceipt(target: ValueTransferParams): any {
        return {
            outputLock: target.timelock,
            recipients: target.recipients.map(([pkh,]) => pkh).filter((pkh, index, array) => index === array.indexOf(pkh)),
        }
    }

    public toJSON(): any {
        return {
            inputs: this.inputs
                .map(utxo => {
                    return { output_pointer: utxo.output_pointer }
                }),
            outputs: this.outputs.map(vto => ({
                pkh: vto.pkh,
                time_lock: vto.time_lock,
                value: vto.value.toString(),
            }))
        }
    }   

    public toProtobuf(): any {
        if (this.prepared) {
            return {    
                inputs: this.inputs
                    .map(utxo => { 
                        const transactionId = utxo.output_pointer.split(':')[0]
                        const outputIndex = parseInt(utxo.output_pointer.split(':')[1])
                        return {
                            outputPointer: {
                                transactionId: { SHA256: Array.from(fromHexString(transactionId)) },
                                ...(outputIndex > 0 ? { outputIndex } : {}),
                            },
                        }
                    }),
                outputs: this.outputs.map(vto => ({
                    pkh: { hash: Array.from(PublicKeyHash.fromBech32(vto.pkh).toBytes20()), },
                    value: Long.fromValue(vto.value),
                    ...(vto.time_lock > 0 ? { timeLock: vto.time_lock } : {}),
                }))
            }
        }
    }

    public validateTarget(target?: any): ValueTransferParams | undefined {
        target = this._cleanTargetExtras(target)
        if (target && Object.keys(target).length > 0) {
            if (!target) {
                throw new TypeError(`${this.constructor.name}: no options passed.`)
            
            } else if (!(
                !target?.fees 
                || (
                    (target.fees instanceof Coins && (target.fees as Coins).pedros > 0)
                    || Object.values(TransactionPriority).includes(target.fees)
                )
            )) {
                throw new TypeError(`${this.constructor.name}: invalid fees: ${target.fees}`)
            
            } else if (!target?.recipients) {
                throw new TypeError(`${this.constructor.name}: no recipients.`)
            
            } else if (!(
                Array.isArray(target.recipients)
                && target.recipients.length > 0
                && (target.recipients as [[PublicKeyHashString, Coins]]).filter(([, value]) => value instanceof Coins)
            )) {
                throw new TypeError(`${this.constructor.name}: invalid recipients: ${target.recipients}`)
            
            } else if(!(
                !target?.timelock || target.timelock >= 0
            )) {
                throw new TypeError(`${this.constructor.name}: invalid timelock: ${target.timelock}`)
            
            } else {
                return target as ValueTransferParams
            }
        } else {
            return undefined
        }
    }

    protected _cleanTargetExtras(target?: any): any {
        if (target) {
            return Object.fromEntries(
                Object.entries(target).filter(([key,]) => [
                    'fees',
                    'recipients',
                    'timelock',
                ].includes(key))
            )
        }
    }

    protected async _estimateNetworkFees(provider: IJsonRpcProvider, priority = TransactionPriority.Medium): Promise<bigint> {
        if (!this._priorities) {
            this._priorities = await provider.priorities()
        }
        return BigInt(Math.floor(
            this._priorities[`vtt_${priority}`].priority * (
                this.covered ? this.weight : this.weight
                    // estimate one more input as to cover for network fees
                    + TX_WEIGHT_INPUT_SIZE 
                    // estimate as many outputs as recipients plus one, as to cover for eventual change output
                    + TX_WEIGHT_OUTPUT_SIZE * (this._target?.recipients.length || 1 + 1) * TX_WEIGHT_GAMMA
            )
        ));
    }
}
