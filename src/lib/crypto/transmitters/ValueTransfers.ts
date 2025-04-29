import { ValueTransferPayload, ValueTransferParams } from "../payloads/ValueTransferPayload"
export { ValueTransferParams } from "../payloads/ValueTransferPayload"

import { ILedger } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"
import { PublicKeyHashString } from "../types"

export class ValueTransfers extends TransmitterMultiSig<ValueTransferParams, ValueTransferPayload> {
    
    public static MAX_WEIGHT = ValueTransferPayload.MAX_WEIGHT

    public static from(ledger: ILedger): ValueTransfers {
        return new ValueTransfers(ledger)
    }

    constructor (ledger: ILedger, changePkh?: PublicKeyHashString) {
        super("VTTransaction", new ValueTransferPayload("VTTransactionBody"), ledger, changePkh)
    }
}
