import type {
	Balance,
	HexString,
	Network,
	QueryStakesOrder,
	StakeEntry,
} from "../types.js";
import type {
	IAccount,
	IBIP32,
	IJsonRpcProvider,
	ISigner,
} from "./interfaces.js";
import { Signer } from "./signer.js";
import {
	type Coins,
	type PublicKey,
	type PublicKeyHashString,
	type Utxo,
	type UtxoCacheInfo,
	UtxoSelectionStrategy,
} from "./types.js";
import { selectUtxos } from "./utils.js";

export class Account implements IAccount {
	public readonly index: number;
	public readonly internal: ISigner;
	public readonly external: ISigner;

	public readonly provider: IJsonRpcProvider;
	public strategy: UtxoSelectionStrategy;

	constructor(
		root: IBIP32,
		provider: IJsonRpcProvider,
		index: number,
		strategy?: UtxoSelectionStrategy,
	) {
		this.index = index;
		this.internal = new Signer(
			root.derivePath(`m/3'/4919'/0'/1/${index}`),
			provider,
			strategy,
		);
		this.external = new Signer(
			root.derivePath(`m/3'/4919'/0'/0/${index}`),
			provider,
			strategy,
		);

		if (!provider.network) {
			throw new Error(`Account: uninitialized provider.`);
		}
		this.provider = provider;
		this.strategy = strategy || UtxoSelectionStrategy.SmallFirst;
	}

	public get cacheInfo(): UtxoCacheInfo {
		const internal = this.internal.cacheInfo;
		const external = this.external.cacheInfo;
		return {
			expendable: BigInt(internal.expendable) + BigInt(external.expendable),
			size: internal.size + external.size,
			timelock: Math.min(
				internal.timelock || Number.MAX_SAFE_INTEGER,
				external.timelock,
			),
		};
	}

	public get changePkh(): PublicKeyHashString {
		return this.internal.pkh;
	}

	public get pkh(): PublicKeyHashString {
		return this.external.pkh;
	}

	public get publicKey(): PublicKey {
		return this.external.publicKey;
	}

	public get privateKey(): HexString {
		return this.external.privateKey;
	}

	public get network(): Network | undefined {
		return this.provider.network;
	}

	public authorizeEvmAddress(evmAddress: HexString): any {
		return this.external.authorizeEvmAddress(evmAddress);
	}

	public addUtxos(...utxos: Array<Utxo>): {
		excluded: Array<Utxo>;
		included: Array<Utxo>;
	} {
		const internal = this.internal.addUtxos(...utxos);
		const external = this.external.addUtxos(...internal.excluded);
		return {
			excluded: external.excluded,
			included: [...internal.included, ...external.included],
		};
	}

	public consumeUtxos(...utxos: Array<Utxo>): Array<Utxo> {
		return this.external.consumeUtxos(...this.internal.consumeUtxos(...utxos));
	}

	public async getBalance(): Promise<Balance> {
		return Promise.all([
			this.internal.getBalance(),
			this.external.getBalance(),
		]).then(([internal, external]) => {
			return {
				locked: internal.locked + external.locked,
				staked: internal.staked + external.staked,
				unlocked: internal.unlocked + external.unlocked,
			};
		});
	}

	public async getDelegatees(
		order?: QueryStakesOrder,
		leftJoin = true,
	): Promise<Array<StakeEntry>> {
		return this.provider
			.stakes({
				filter: { withdrawer: this.pkh },
				params: { order },
			})
			.then((records) => {
				if (records.length === 0 && leftJoin) {
					return [
						{
							key: { validator: "", withdrawer: this.pkh },
							value: {
								coins: 0n,
								nonce: 0,
								epochs: { mining: 0, witnessing: 0 },
							},
						},
					];
				} else {
					return records;
				}
			});
	}

	public getSigner(pkh?: PublicKeyHashString): ISigner | undefined {
		if (!pkh) return this.external;
		else if (pkh === this.external.pkh) return this.external;
		else if (pkh === this.internal.pkh) return this.internal;
		else return undefined;
	}

	public async getUtxos(reload = false): Promise<Array<Utxo>> {
		return [
			...(await this.internal.getUtxos(reload)),
			...(await this.external.getUtxos(reload)),
		];
	}

	public async selectUtxos(specs?: {
		value?: Coins;
		consume?: boolean;
		reload?: boolean;
		strategy?: UtxoSelectionStrategy;
	}): Promise<Array<Utxo>> {
		return this.getUtxos(specs?.reload).then((utxos) =>
			selectUtxos({
				utxos,
				value: specs?.value,
				strategy: specs?.strategy || this.strategy,
			}),
		);
	}
}
