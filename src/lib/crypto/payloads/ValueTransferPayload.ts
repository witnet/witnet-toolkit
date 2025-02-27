import { fromHexString } from "../../../bin/helpers"
import { Nanowits } from "../../types"

import { TransactionPayloadMultiSig } from "../payloads"
import { PublicKeyHash, PublicKeyHashString, TransactionParams } from "../types"

export type ValueTransferParams = TransactionParams & {
    recipients: Array<[pkh: PublicKeyHashString, value: Nanowits]>,
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

    public get value(): Nanowits {
        return this._target?.recipients.reduce((prev, [,curr]) => prev + curr, 0) || 0
    }

    public get weight(): Nanowits {
        return (
            this._inputs.length * TX_WEIGHT_INPUT_SIZE 
                + this._outputs.length * TX_WEIGHT_OUTPUT_SIZE * TX_WEIGHT_GAMMA
        );
    }
    
    // public async consumeUtxos(
    //     signer: ISigner, 
    //     changePkh?: PublicKeyHashString,
    // ): Promise<number> {
    //     if (!this._target) {
    //         throw new Error(`${this.constructor.name}: internal error: no in-flight params.`)
        
    //     } else {
    //         if (!this._covered) {
    //             const utxos = await signer.selectUtxos()
    //             let index = 0
    //             while (index < utxos.length && !this.covered) {
    //                 const utxo = utxos[index ++]
    //                 if (utxo) {
    //                     this._inputs.push([ signer.pkh, utxo ])
    //                     this._covered += utxo.value
    //                 }
    //             }
    //             signer.consumeUtxos(index)
    //         }
    //         const change = this._covered - (this.value + this._target.fees)
    //         if (change >= 0) {
    //             if (this._outputs.length === 0) {
    //                 this._outputs.push(...this._target.recipients.map(([pkh, value]) => { return {
    //                     pkh, 
    //                     value, 
    //                     time_lock: this._target?.timelock || 0
    //                 }}));
    //                 if (change > 0) {
    //                     // change goes to signer of last added UTXO:
    //                     this._outputs.push({
    //                         pkh: changePkh || signer.pkh,
    //                         value: change,
    //                         time_lock: 0
    //                     })
    //                 }
    //             }
    //         }
    //         this._change = change
    //         return change
    //     }
    // }

    public prepareOutputs(change?: { value: Nanowits, sender: PublicKeyHashString }): any {
        if (this._target && this._outputs.length === 0) {
            this._outputs.push(...this._target.recipients.map(([pkh, value]) => ({
                pkh, 
                value, 
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
                .map(([, utxo]) => {
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
                    .map(([, utxo]) => { 
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
                    && target?.fees
                    && parseInt(target?.fees) > 0
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
}
