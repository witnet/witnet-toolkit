import { ValueTransferPayload, ValueTransferParams } from "../payloads/ValueTransferPayload.js"
export { ValueTransferParams } from "../payloads/ValueTransferPayload.js"

import { ILedger } from "../interfaces.js"
import { TransmitterMultiSig } from "../transmitters.js"
import { PublicKeyHashString } from "../types.js"

export class ValueTransfers extends TransmitterMultiSig<ValueTransferParams, ValueTransferPayload> {
    
    public static MAX_WEIGHT = ValueTransferPayload.MAX_WEIGHT

    public static from(ledger: ILedger): ValueTransfers {
        return new ValueTransfers(ledger)
    }

    constructor (ledger: ILedger, changePkh?: PublicKeyHashString) {
        super("VTTransaction", new ValueTransferPayload("VTTransactionBody"), ledger, changePkh)
    }
}
