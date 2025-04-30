import { fromHexString } from "../../../bin/helpers"
import { IProvider, Nanowits } from "../../types"

import { TransactionPayloadMultiSig } from "../payloads"
import { Coins, PublicKeyHash, PublicKeyHashString, TransactionParams, TransactionPriority } from "../types"

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
        return Coins.fromPedros(this._target?.recipients.reduce((prev, [,curr]) => prev + curr.pedros, 0) || 0)
    }

    public get weight(): number {
        return (
            this._inputs.length * TX_WEIGHT_INPUT_SIZE 
                + this._outputs.length * TX_WEIGHT_OUTPUT_SIZE * TX_WEIGHT_GAMMA
        );
    }

    public prepareOutputs(change?: { value: Nanowits, pkh: PublicKeyHashString }): any {
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
                value: vto.value,
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
                    value: vto.value,
                    ...(vto.time_lock > 0 ? { timeLock: vto.time_lock } : {}),
                }))
            }
        }
    }

    public validateTarget(target?: any): ValueTransferParams | undefined {
        target = this._cleanTargetExtras(target)
        if (target && Object.keys(target).length > 0) {
            if (!(
                target
                    && (
                        !target?.fees 
                        || (
                            target.fees instanceof Coins && (target.fees as Coins).pedros > 0 
                            || Object.values(TransactionPriority).includes(target.fees)
                        )
                    )
                    && target?.recipients
                    && target?.recipients.length > 0
                    && (!target?.timelock || target.timelock >= 0)
            )) {
                throw new TypeError(`${this.constructor.name}: invalid specs were provided: ${JSON.stringify(target)}`)
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

    protected async _estimateNetworkFees(provider: IProvider, priority = TransactionPriority.Medium): Promise<Nanowits> {
        if (!this._priorities) {
            this._priorities = await provider.priorities()
        }
        return (
            this._priorities[`vtt_${priority}`].priority * (
                this.covered ? this.weight : this.weight
                    // estimate one more input as to cover for network fees
                    + TX_WEIGHT_INPUT_SIZE 
                    // estimate as many outputs as recipients plus one, as to cover for eventual change output
                    + TX_WEIGHT_OUTPUT_SIZE * (this._target?.recipients.length || 1 + 1) * TX_WEIGHT_GAMMA
            )
        );
    }
}
