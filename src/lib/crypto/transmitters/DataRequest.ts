import { RadonRequest, RadonTemplate } from "../../radon"

import { DataRequestPayload, DataRequestParams } from "../payloads/DataRequestPayload"
import { IAccountable, ISigner } from "../interfaces"
import { TransmitterMultiSig } from "../transmitters"

import { Account } from "../account"
import { Coinbase } from "../coinbase"
import { Wallet } from "../wallet"

export { DataRequestParams } from "../payloads/DataRequestPayload"

export class DataRequest extends TransmitterMultiSig<DataRequestParams, DataRequestPayload> {
    
    public static COLLATERAL_RATIO = DataRequestPayload.COLLATERAL_RATIO;
    public static MAX_WEIGHT = DataRequestPayload.MAX_WEIGHT;

    public static from(accountable: IAccountable, artifact: RadonRequest | RadonTemplate): DataRequest {
        if (accountable instanceof Wallet) {
            return new DataRequest(accountable.signers, artifact)
        
        } else if (accountable instanceof Account) {
            return new DataRequest([accountable.internal, accountable.external], artifact)
        
        } else if (accountable instanceof Coinbase) {
            return new DataRequest([accountable], artifact)
        
        } else {
            throw TypeError(`DataRequest: cannot create from instance of ${accountable.constructor.name}.`)
        }
    }

    constructor (signers: Array<ISigner>, artifact: any) {
        super("DRTransaction", new DataRequestPayload("DRTransactionBody", artifact), signers)
    }

    public get request(): any| undefined {
        return this._payload.request
    }

    public get template(): any | undefined {
        return this._payload.template
    }
}
