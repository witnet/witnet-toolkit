import Long from "long";

import { fromHexString } from "../../../bin/helpers.js";

import type { HexString, IJsonRpcProvider, Network } from "../../types.js";

import { TransactionPayloadMultiSig } from "../payloads.js";
import {
	Coins,
	PublicKey,
	PublicKeyHash,
	type PublicKeyHashString,
	RecoverableSignature,
	type TransactionParams,
	TransactionPriority,
} from "../types.js";

export type StakeDepositParams = TransactionParams & {
	authorization: HexString;
	value: Coins;
	withdrawer: PublicKeyHashString;
};

const TX_WEIGHT_BASE = 105;
const TX_WEIGHT_INPUT_SIZE = 133;
const TX_WEIGHT_OUTPUT_SIZE = 36;

export class StakePayload extends TransactionPayloadMultiSig<StakeDepositParams> {
	public static MAX_WEIGHT = 10000; // 10,000
	public static MIN_VALUE = 10000 * 10 ** 9; // 10,000.00 $WIT

	public get maxWeight(): number {
		return StakePayload.MAX_WEIGHT;
	}

	public get prepared(): boolean {
		return (
			!!this._target &&
			this._covered >= this._target.value.pedros &&
			this._inputs.length > 0
		);
	}

	public get value(): Coins {
		return this._target?.value || Coins.zero();
	}

	public get weight(): number {
		return (
			TX_WEIGHT_BASE +
			this._inputs.length * TX_WEIGHT_INPUT_SIZE +
			this._outputs.length * TX_WEIGHT_OUTPUT_SIZE
		);
	}

	public intoReceipt(target: StakeDepositParams, network?: Network) {
		return {
			authorization: target.authorization,
			withdrawer: target.withdrawer,
			validator: PublicKeyHash.fromHexString(
				target.authorization.substring(0, 40),
			).toBech32(network),
		};
	}

	public toJSON(_humanize = false, network?: Network): any {
		return {
			inputs: this.inputs.map((utxo) => {
				return { output_pointer: utxo.output_pointer };
			}),
			...(this._target
				? {
						output: {
							authorization: RecoverableSignature.from(
								this._target.authorization.substring(40),
								PublicKeyHash.fromBech32(this._target.withdrawer).toBytes32(),
							).toKeyedSignature(),
							key: {
								validator: PublicKeyHash.fromHexString(
									this._target.authorization.substring(0, 40),
								).toBech32(network),
								withdrawer: this._target.withdrawer,
							},
							value: this._target.value.pedros.toString(),
						},
					}
				: {}),
			...(this.outputs.length > 0
				? {
						change: {
							pkh: this.outputs[0].pkh,
							value: this.outputs[0].value.toString(),
							time_lock: 0,
						},
					}
				: {}),
		};
	}

	public toProtobuf(): any {
		if (this.prepared && this._target) {
			return {
				inputs: this.inputs.map((utxo) => {
					const transactionId = utxo.output_pointer.split(":")[0];
					const outputIndex = parseInt(utxo.output_pointer.split(":")[1], 10);
					return {
						outputPointer: {
							transactionId: {
								SHA256: Array.from(fromHexString(transactionId)),
							},
							...(outputIndex > 0 ? { outputIndex } : {}),
						},
					};
				}),
				output: {
					authorization: RecoverableSignature.from(
						this._target.authorization.substring(40),
						PublicKeyHash.fromBech32(this._target.withdrawer).toBytes32(),
					).toProtobuf(),
					key: {
						validator: {
							hash: Array.from(
								PublicKeyHash.fromHexString(
									this._target.authorization.substring(0, 40),
								).toBytes20(),
							),
						},
						withdrawer: {
							hash: Array.from(
								PublicKeyHash.fromBech32(this._target.withdrawer).toBytes20(),
							),
						},
					},
					value: Long.fromValue(this._target.value.pedros),
				},
				...(this._outputs.length > 0
					? {
							change: {
								pkh: {
									hash: Array.from(
										PublicKeyHash.fromBech32(this.outputs[0].pkh).toBytes20(),
									),
								},
								value: Long.fromValue(this.outputs[0].value.toString()),
								// timeLock: 0,
							},
						}
					: { change: { pkh: { hash: Array(20).fill(0) } } }),
			};
		}
	}

	public validateTarget(target?: any): StakeDepositParams | undefined {
		target = this._cleanTargetExtras(target);
		if (target && Object.keys(target).length > 0) {
			if (
				!(
					target?.authorization &&
					(!target?.fees ||
						(target.fees instanceof Coins &&
							(target.fees as Coins).pedros > 0) ||
						Object.values(TransactionPriority).includes(target.fees)) &&
					target?.value &&
					(target.value as Coins).pedros > 0 &&
					target?.withdrawer
				)
			) {
				throw new TypeError(
					`${this.constructor.name}: invalid options: ${JSON.stringify(target)}`,
				);
			} else {
				if ((target.value as Coins).pedros < StakePayload.MIN_VALUE) {
					throw new TypeError(
						`${this.constructor.name}: value below minimum stake: ${
							(target.value as Coins).wits
						} < ${
							Coins.fromNanowits(BigInt(StakePayload.MIN_VALUE)).wits
						} $WIT`,
					);
				}
				const pubKey = PublicKey.recoverFrom(
					target.authorization.substring(40),
					PublicKeyHash.fromBech32(target.withdrawer).toBytes32(),
				);
				if (
					pubKey.hash().toHexString() !== target.authorization.substring(0, 40)
				) {
					throw new TypeError(
						`${this.constructor.name}: authorization code not valid for withdrawer ${target.withdrawer}.`,
					);
				}
				return target as StakeDepositParams;
			}
		} else {
			return undefined;
		}
	}

	protected _cleanTargetExtras(target?: any): any {
		if (target) {
			return Object.fromEntries(
				Object.entries(target).filter(([key]) =>
					["authorization", "fees", "value", "withdrawer"].includes(key),
				),
			);
		}
	}

	protected async _estimateNetworkFees(
		provider: IJsonRpcProvider,
		priority = TransactionPriority.Medium,
	): Promise<bigint> {
		if (!this._priorities) {
			this._priorities = await provider.priorities();
		}
		return BigInt(
			Math.floor(
				// todo: replace `vtt_` for `st_`
				this._priorities[`vtt_${priority}`].priority *
					(this.covered
						? this.weight
						: this.weight +
							// estimate one more input as to cover for network fees
							TX_WEIGHT_INPUT_SIZE +
							// estimate weight of one single output in case there was change to pay back
							TX_WEIGHT_OUTPUT_SIZE),
			),
		);
	}
}
