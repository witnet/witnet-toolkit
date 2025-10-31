import type { ILedger } from "../interfaces.js";
import {
	type StakeDepositParams,
	StakePayload,
} from "../payloads/StakePayload.js";
import { TransmitterMultiSig } from "../transmitters.js";
import type { PublicKeyHashString } from "../types.js";

export { StakeDepositParams } from "../payloads/StakePayload.js";

export class StakeDeposits extends TransmitterMultiSig<
	StakeDepositParams,
	StakePayload
> {
	public static MAX_WEIGHT = StakePayload.MAX_WEIGHT;
	public static MIN_VALUE = StakePayload.MIN_VALUE;

	public static from(ledger: ILedger): StakeDeposits {
		return new StakeDeposits(ledger);
	}

	constructor(ledger: ILedger, changePkh?: PublicKeyHashString) {
		super(
			"StakeTransaction",
			new StakePayload("StakeTransactionBody"),
			ledger,
			changePkh,
		);
	}
}
