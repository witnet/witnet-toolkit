import type { GetDataRequestEtherealReport, HexString } from "../types.js";

export type DataPushReport = GetDataRequestEtherealReport & {
	evm_proof?: HexString;
};
