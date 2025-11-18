import type { RadonRequest, RadonTemplate } from "../../radon/index.js";
import type { ILedger } from "../interfaces.js";
import { type DataRequestParams, DataRequestPayload } from "../payloads/DataRequestPayload.js";
import { TransmitterMultiSig } from "../transmitters.js";
import type { PublicKeyHashString } from "../types.js";

export { DataRequestParams } from "../payloads/DataRequestPayload.js";

export class DataRequests extends TransmitterMultiSig<DataRequestParams, DataRequestPayload> {
	public static MAX_WEIGHT = DataRequestPayload.MAX_WEIGHT;

	public static from(ledger: ILedger, artifact: RadonRequest | RadonTemplate): DataRequests {
		return new DataRequests(artifact, ledger);
	}

	constructor(artifact: RadonRequest | RadonTemplate, ledger: ILedger, changePkh?: PublicKeyHashString) {
		super("DRTransaction", new DataRequestPayload("DRTransactionBody", artifact), ledger, changePkh);
	}

	public get request(): RadonRequest | undefined {
		return this._payload.request;
	}

	public get template(): RadonTemplate | undefined {
		return this._payload.template;
	}
}
