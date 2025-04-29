import { RadonRequest, RadonTemplate } from "../../radon"

import { DataRequestPayload, DataRequestParams } from "../payloads/DataRequestPayload"
import { ILedger } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"
import { PublicKeyHashString } from "../types"

export { DataRequestParams } from "../payloads/DataRequestPayload"

export class DataRequests extends TransmitterMultiSig<DataRequestParams, DataRequestPayload> {
    
    public static COLLATERAL_RATIO = DataRequestPayload.COLLATERAL_RATIO;
    public static MAX_WEIGHT = DataRequestPayload.MAX_WEIGHT;

    public static from(ledger: ILedger, artifact: RadonRequest | RadonTemplate) : DataRequests {
        return new DataRequests(artifact, ledger)
    }

    constructor (artifact: RadonRequest | RadonTemplate, ledger: ILedger, changePkh?: PublicKeyHashString) {
        super("DRTransaction", new DataRequestPayload("DRTransactionBody", artifact), ledger, changePkh)
    }

    public get request(): RadonRequest | undefined {
        return this._payload.request
    }

    public get template(): RadonTemplate | undefined {
        return this._payload.template
    }
}
