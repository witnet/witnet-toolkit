import { StakePayload, StakeDepositParams } from "../payloads/StakePayload"

import { ILedger } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"
import { PublicKeyHashString } from "../types"

export { StakeDepositParams } from "../payloads/StakePayload"

export class StakeDeposits extends TransmitterMultiSig<StakeDepositParams, StakePayload> {
    
    public static MAX_WEIGHT = StakePayload.MAX_WEIGHT;
    public static MIN_VALUE = StakePayload.MIN_VALUE;

    public static from(ledger: ILedger): StakeDeposits {
        return new StakeDeposits(ledger)
    }

    constructor (ledger: ILedger, changePkh?: PublicKeyHashString) {
        super("StakeTransaction", new StakePayload("StakeTransactionBody"), ledger, changePkh)
    }
}
