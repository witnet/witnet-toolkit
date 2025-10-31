export { default as cbor } from "cbor";

export {
	fromHexString,
	ipIsPrivateOrLocalhost,
	isHexString,
	isHexStringOfLength,
	parseURL,
	toHexString,
	toUtf8Array,
	toUtf16Bytes,
	utf8ArrayToStr,
} from "../bin/helpers.js";

export {
	decipherXprv,
	ecdsaVerify,
	parseXprv,
	selectUtxos,
	sha256,
	totalCoins,
} from "./crypto/utils.js";

export {
	execRadonBytecode,
	parseRadonScript,
	searchRadonAssets,
} from "./radon/utils.js";

import { toHexString, toUtf16Bytes } from "../bin/helpers.js";
import { sha256 } from "./crypto/utils.js";
import { RadonModal, RadonRequest, RadonTemplate } from "./radon/index.js";
import { flattenRadonAssets, requireRadonAsset } from "./radon/utils.js";

export function digestMessage(text: string): Buffer<ArrayBufferLike> {
	return sha256(new Uint8Array(toUtf16Bytes(text)));
}

export function flattenRadonRequests(
	assets: any,
): Record<string, RadonRequest> {
	return Object.fromEntries(
		flattenRadonAssets(assets, RadonRequest).map((asset) =>
			Object.entries(asset),
		),
	);
}

export function flattenRadonTemplates(
	assets: any,
): Record<string, RadonTemplate> {
	return Object.fromEntries(
		flattenRadonAssets(assets, RadonTemplate).map((asset) => [
			asset.key,
			asset.artifact,
		]),
	);
}

export function flattenRadonModals(assets: any): Record<string, RadonModal> {
	return Object.fromEntries(
		flattenRadonAssets(assets, RadonModal).map((asset) =>
			Object.entries(asset),
		),
	);
}

export function requireRadonRequest(
	artifact: string,
	assets?: any,
): RadonRequest | undefined {
	return requireRadonAsset({ artifact, assets, type: RadonRequest });
}

export function requireRadonTemplate(
	artifact: string,
	assets?: any,
): RadonTemplate | undefined {
	return requireRadonAsset({ artifact, assets, type: RadonTemplate });
}

export function requireRadonModal(
	artifact: string,
	assets?: any,
): RadonModal | undefined {
	return requireRadonAsset({ artifact, assets, type: RadonModal });
}

export function txJsonReplacer(key: string, value: string) {
	switch (key) {
		case "bytes":
		case "der":
			return toHexString(value, true);
		case "tx":
			return JSON.stringify(value, txJsonReplacer);
		case "data_request":
			return RadonRequest.fromProtobuf(value);
		default:
			return value;
	}
}
