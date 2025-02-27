import { UnstakePayload, StakeWithdrawalParams } from "../payloads/UnstakePayload"

import { TransactionReceipt } from "../types"
import { IAccountable, ISigner } from "../interfaces"
import { Transmitter } from "../transmitters"

import { Account } from "../account"
import { Coinbase } from "../coinbase"
import { Hash } from "../../types"

export { StakeWithdrawalParams } from "../payloads/UnstakePayload"

export class StakeWithdrawals extends Transmitter<StakeWithdrawalParams, UnstakePayload> {
    
    public static MIN_TIMELOCK_SECS = UnstakePayload.MIN_TIMELOCK_SECS
    public static WEIGHT = UnstakePayload.WEIGHT

    public static from(accountable: IAccountable): StakeWithdrawals {
        if (accountable instanceof Account) {
            return new StakeWithdrawals(accountable.external)
        
        } else if (accountable instanceof Coinbase) {
            return new StakeWithdrawals(accountable)
        
        } else {
            throw TypeError(`StakeWithdrawals: cannot create from instance of ${accountable.constructor.name}.`)
        }
    }

    constructor (signer: ISigner) {
        super("UnstakeTransaction", new UnstakePayload("UnstakeTransactionBody"), [signer])
    }

    public async signTransaction(params?: StakeWithdrawalParams): Promise<TransactionReceipt> {
        return super.signTransaction(params, false)
    }

    public _signTransactionPayload(): Hash {
        const hash = this._payload.hash
        if (!hash) {
            throw Error(
                `${this.constructor.name}: internal error: unable to hashify payload: ${this._payload.toJSON(true)}}.`
            )
        } else {
            this._signatures.push(this.signers[0].signHash(hash))
            return hash
        }
        
    }

    protected _toJSON(humanize: boolean): any {
        return {
            [this.type]: {
                body: this._payload.toJSON(humanize),
                signature: this._signatures[0],
            }
        }
    }

    protected _toProtobuf(): any {
        const body = this._payload.toProtobuf()
        if (body && this._signatures.length > 0) {
            return {
                body,
                signature: this._signatures[0]
            }
        }
    }
}
