import { StakePayload, StakeDepositParams } from "../payloads/StakePayload"

import { IAccountable, ISigner } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"

import { Account } from "../account"
import { Coinbase } from "../coinbase"
import { Wallet } from "../wallet"

export { StakeDepositParams } from "../payloads/StakePayload"

export class StakeDeposits extends TransmitterMultiSig<StakeDepositParams, StakePayload> {
    
    public static MAX_WEIGHT = StakePayload.MAX_WEIGHT;
    public static MIN_VALUE = StakePayload.MIN_VALUE;

    public static from(accountable: IAccountable): StakeDeposits {
        if (accountable instanceof Wallet) {
            return new StakeDeposits(accountable.signers)
        
        } else if (accountable instanceof Account) {
            return new StakeDeposits([accountable.internal, accountable.external])
        
        } else if (accountable instanceof Coinbase) {
            return new StakeDeposits([accountable])
        
        } else {
            throw TypeError(`StakeDeposits: cannot create from instance of ${accountable.constructor.name}.`)
        }
    }

    constructor (signers: Array<ISigner>) {
        super("StakeTransaction", new StakePayload("StakeTransactionBody"), signers)
    }
}
