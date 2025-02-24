import { Epoch, Nanowits, ValueTransferOutput } from "../../types"

import { ISigner } from "../interfaces"
import { TransactionPayload } from "../payloads"
import { PublicKeyHash, PublicKeyHashString, TransactionParams } from "../types"


export type StakeWithdrawalParams = TransactionParams & {
    nonce?: Epoch,
    validator: PublicKeyHashString,
    value: Nanowits,
}

export class UnstakePayload extends TransactionPayload<StakeWithdrawalParams> {

    public static MIN_TIMELOCK_SECS = 1_209_600;
    public static WEIGHT = 153;

    protected _outputs: Array<ValueTransferOutput> = []

    constructor (protoTypeName: string, specs?: any) {
        super(protoTypeName, specs)
    }

    public get covered(): boolean {
        return this._covered > 0
            && this.outputs.length > 0 
    }

    public get maxWeight(): number {
        return UnstakePayload.WEIGHT
    }

    public get outputs(): Array<ValueTransferOutput> {
        return this._outputs
    }

    public get prepared(): boolean {
        return (
            this._target !== undefined
                && this._outputs.length > 0
        )
    }

    public get value(): Nanowits {
        return this._target?.value || 0
    }

    public get weight(): Nanowits {
        return UnstakePayload.WEIGHT
    }
    
    public async consumeUtxos(signer: ISigner): Promise<number> {
        if (!this._target) {
            throw new Error(`${this.constructor.name}: internal error: no in-flight params.`)
        
        } else if (!this._covered) {
            this._covered = this._target?.nonce || (await signer.getDelegateNonce(this._target.validator))
            this._outputs.push({
                pkh: signer.pkh,
                value: this.value,
                time_lock: UnstakePayload.MIN_TIMELOCK_SECS
            })
        }
        return 0
    }

    public intoReceipt(target: StakeWithdrawalParams) {
        return {
            nonce: target.nonce,
            outputLock: UnstakePayload.MIN_TIMELOCK_SECS,
            validator: target.validator,
            ...(this._outputs ? { withdrawer: this._outputs[0].pkh } : {}),
        }
    }

    public prepareOutputs(): any {}

    public resetTarget(target: StakeWithdrawalParams): any {
        this._covered = 0
        this._outputs = []
        this._target = target
    }

    public toJSON(_humanize = false): any {
        return {
            fee: this._target?.fees,
            nonce: this._covered,
            operator: this._target?.validator,
            withdrawal: {
                pkh: this.outputs[0].pkh,
                value: this.outputs[0].value,
                time_lock: UnstakePayload.MIN_TIMELOCK_SECS,
            },
        }
    }   

    public toProtobuf(): any {
        if (this.prepared && this._target) {
            return {
                fee: this._target.fees,
                nonce: this._covered,
                operator: { hash: Array.from(PublicKeyHash.fromBech32(this._target.validator).toBytes20()) },
                withdrawal: {
                    pkh: { hash: Array.from(PublicKeyHash.fromBech32(this.outputs[0].pkh).toBytes20()) },
                    value: this.outputs[0].value,
                    timeLock: this.outputs[0].time_lock,
                },
            }
        }
    }

    public validateTarget(target?: any): StakeWithdrawalParams | undefined {
        target = this._cleanTargetExtras(target)
        if (target && Object.keys(target).length > 0) {
            if (!(
                target
                    && target?.fees
                    && parseInt(target.fees) > 0
                    && target?.value
                    && parseInt(target.value) > 0
                    && target?.validator
            )) {
                throw new TypeError(`${this.constructor.name}: invalid specs were provided: ${JSON.stringify(target)}`)
            } else {
                if (target?.nonce || parseInt(target.nonce) <= 0) {
                    throw new TypeError(`${this.constructor.name}: nonce must be positive if provided.`)
                }
                return target as StakeWithdrawalParams
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
                    'nonce',
                    'value',
                    'validator',
                ].includes(key))
            )
        }
    }
}
