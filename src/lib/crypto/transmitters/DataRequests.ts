import { RadonRequest, RadonTemplate } from "../../radon"

import { DataRequestPayload, DataRequestParams } from "../payloads/DataRequestPayload"
import { IAccountable, ISigner } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"

import { Account } from "../account"
import { Coinbase } from "../coinbase"
import { Wallet } from "../wallet"

export { DataRequestParams } from "../payloads/DataRequestPayload"

export class DataRequests extends TransmitterMultiSig<DataRequestParams, DataRequestPayload> {
    
    public static COLLATERAL_RATIO = DataRequestPayload.COLLATERAL_RATIO;
    public static MAX_WEIGHT = DataRequestPayload.MAX_WEIGHT;

    public static from(accountable: IAccountable, artifact: RadonRequest | RadonTemplate): DataRequests {
        if (accountable instanceof Wallet) {
            return new DataRequests(accountable.signers, artifact)
        
        } else if (accountable instanceof Account) {
            return new DataRequests([accountable.internal, accountable.external], artifact)
        
        } else if (accountable instanceof Coinbase) {
            return new DataRequests([accountable], artifact)
        
        } else {
            throw TypeError(`DataRequests: cannot create from instance of ${accountable.constructor.name}.`)
        }
    }

    constructor (signers: Array<ISigner>, artifact: RadonRequest | RadonTemplate) {
        super("DRTransaction", new DataRequestPayload("DRTransactionBody", artifact), signers)
    }

    public get request(): RadonRequest | undefined {
        return this._payload.request
    }

    public get template(): RadonTemplate | undefined {
        return this._payload.template
    }
}
