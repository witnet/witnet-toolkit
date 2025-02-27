import { ValueTransferPayload, ValueTransferParams } from "../payloads/ValueTransferPayload"
export { ValueTransferParams } from "../payloads/ValueTransferPayload"

import { IAccountable, ISigner } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"

import { Account } from "../account"
import { Coinbase } from "../coinbase"
import { Wallet } from "../wallet"

export class ValueTransfers extends TransmitterMultiSig<ValueTransferParams, ValueTransferPayload> {
    
    public static MAX_WEIGHT = ValueTransferPayload.MAX_WEIGHT

    public static from(accountable: IAccountable): ValueTransfers {
        if (accountable instanceof Wallet) {
            return new ValueTransfers(accountable.signers)
        
        } else if (accountable instanceof Account) {
            return new ValueTransfers([accountable.internal, accountable.external])
        
        } else if (accountable instanceof Coinbase) {
            return new ValueTransfers([accountable])
        
        } else {
            throw TypeError(`ValueTransfers: cannot create from instance of ${accountable.constructor.name}.`)
        }
    }

    constructor (signers: Array<ISigner>) {
        super("VTTransaction", new ValueTransferPayload("VTTransactionBody"), signers)
    }
}
