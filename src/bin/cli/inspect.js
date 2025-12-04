import moment from "moment";
import { utils, Witnet } from "../../../dist/src/index.js";
import * as helpers from "../helpers.js";

const { cyan, gray, green, lyellow, magenta, mgreen, mmagenta, myellow, yellow } = helpers.colors;

const _DEFAULT_LIMIT = 100;

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

export const envars = {
	WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
};

export const flags = {
	provider: {
		hint: "Public Wit/Oracle JSON-RPC provider, other than default.",
		param: "URL",
	},
	reverse: {
		hint: "List most recent data requests first (default: true).",
	},
	verbose: {
		hint: "Outputs validators' nonce and last validation epochs.",
	},
};

export const router = {
	balance: {
		hint: "Show available Wits on given address.",
		params: "WIT_ADDRESS",
	},
	block: {
		hint: "Get block data given its block hash.",
		params: "BLOCK_HASH",
	},
	dataRequest: {
		hint: "Get query parameters and result to some data request transaction.",
		params: "DR_TX_HASH",
		options: {
			force: {
				hint: "Get data even if the WIT/RPC provider is not synced.",
			},
			mode: {
				hint: "Possible report formats (default: `ethereal`).",
				param: "`ethereal` | `full``",
			},
		},
	},
	dataRequests: {
		hint: "Search for in-flight or recently solved data request transactions.",
		params: "RAD_BYTECODE | RAD_HASH",
		options: {
			limit: { hint: "Limit output records (default: 10).", param: "LIMIT" },
			offset: {
				hint: "Skips first records as found on server side (default: 0).",
				param: "SKIP",
			},
			mode: {
				hint: "Possible report formats (default: `ethereal`).",
				param: "`ethereal` | `full``",
			},
			since: {
				hint: "Number of past epochs to search for (default: -30240).",
				param: "EPOCH|MINUS_EPOCHS",
			},
		},
	},
	superblock: {
		hint: "Show superblock metadata for given epoch.",
		params: "EPOCH",
	},
	transaction: {
		hint: "Report transaction details given its transaction hash.",
		params: "TX_HASH",
	},
	validators: {
		hint: "List validators treasuring delegated stake from the specified address.",
		params: "WIT_ADDRESS",
	},
	valueTransfer: {
		hint: "Report value transfer details given its transaction hash.",
		params: "VT_TX_HASH",
		options: {
			force: {
				hint: "Get data even if the WIT/RPC provider is not synced.",
			},
			mode: {
				hint: "Possible report formats (default: `full`).",
				param: "`ethereal` | `full` | `simple`",
			},
		},
	},
	withdrawers: {
		hint: "List withdrawers currently delegating stake to the specified address.",
		params: "WIT_ADDRESS",
	},
	utxos: {
		hint: "List UTXOs available to the specified address.",
		params: "WIT_ADDRESS",
		options: {
			from: {
				hint: "Show only UTXOs that previously belonged to this other address.",
				param: "WIT_ADDRESS",
			},
			"min-value": {
				hint: "Filter out UTXOs with a value smaller than this amount.",
				param: "WITS",
			},
			strategy: {
				hint: "UTXOs listing order: `big-first`, `random`, `small-first` (default: `big-first`).",
				param: "STRATEGY",
			},
		},
	},
};

export const subcommands = {
	balance,
	block,
	dataRequest,
	dataRequests,
	superblock,
	transaction,
	validators,
	withdrawers,
	utxos,
	valueTransfer,
};

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function balance(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No WIT_ADDRESS was specified");
	}
	const pkh = args[0];
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const balance = await provider.getBalance(pkh);
	const records = [];
	records.push([
		Witnet.Coins.fromNanowits(balance.locked).wits,
		Witnet.Coins.fromNanowits(balance.staked).wits,
		Witnet.Coins.fromNanowits(balance.unlocked).wits,
		Witnet.Coins.fromNanowits(balance.locked + balance.staked + balance.unlocked).wits,
	]);
	helpers.traceTable(records, {
		headlines: ["Locked ($WIT)", "Staked ($WIT)", "Available ($WIT)", "BALANCE ($WIT)"],
		humanizers: [helpers.commas, helpers.commas, helpers.commas, helpers.commas],
		colors: [gray, yellow, myellow, lyellow],
	});
}

async function block(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No BLOCK_HASH was specified");
	}
	const blockHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0];
	if (!helpers.isHexString(blockHash)) {
		throw Error("Invalid BLOCK_HASH was provided");
	}
	const provider = await Witnet.JsonRpcProvider.fromEnv(options?.provider);
	const block = await provider.getBlock(blockHash);
	console.info(
		gray(
			JSON.stringify(
				block,
				(key, value) => {
					switch (key) {
						case "bytes":
						case "der":
						case "proof":
							return Array.isArray(value) ? helpers.toHexString(value, true) : value;

						case "public_key":
							return Array.isArray(value)
								? helpers.toHexString(value, true)
								: typeof value === "object"
									? Witnet.PublicKey.fromProtobuf(value).hash().toBech32(provider.network)
									: value;

						default:
							return value;
					}
				},
				2,
			),
		),
	);
}

async function dataRequests(options = {}, [arg]) {
	// if (!args || args.length === 0) {
	if (!arg) {
		throw new Error("No RAD_HASH or RAD_RAD_BYTECODE was specified.");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	// const radHashes = args.map(arg => {
	if (!helpers.isHexString(arg)) {
		throw new Error(`Invalid hex string was provided: '${arg}'`);
	}
	let radHash;
	if (helpers.isHexStringOfLength(arg, 32)) {
		radHash = arg;
	} else {
		const request = Witnet.Radon.RadonRequest.fromBytecode(arg);
		radHash = request.radHash;
	}
	// return radHash
	// })
	// let results = await helpers.prompter(
	//   Promise.all(
	//     [...new Set(radHashes)].map(radHash => provider.searchDataRequests(radHash, {
	//       limit: options?.limit ? parseInt(options.limit) : undefined,
	//       offset: options?.offset ? parseInt(options.offset) : undefined,
	//       reverse: options?.reverse,
	//     }))
	//   ).then(results => results
	//     .flat()
	//     .sort((a, b) => options?.reverse ? b.block_epoch - a.block_epoch : a.block_epoch - b.block_epoch)
	//     .slice(options?.offset)
	//     .slice(0, options?.limit || DEFAULT_LIMIT)
	//   )
	// )
	const results = await helpers.prompter(
		provider.searchDataRequests(radHash, {
			limit: options?.limit ? parseInt(options.limit, 10) : 10,
			offset: options?.offset ? parseInt(options.offset, 10) : undefined,
			mode: options?.mode,
			reverse: options?.reverse,
		}),
	);
	helpers.traceTable(
		results.map((record) => {
			let result = record?.result.cbor_bytes ? utils.cbor.decode(record?.result.cbor_bytes, { encoding: "hex" }) : "";
			const request = Witnet.Radon.RadonRequest.fromBytecode(record.query.rad_bytecode);
			const dataType = result !== "" && result.constructor.name === "Tagged" ? "RadonError" : request.dataType;
			if (result !== "" && !["RadonError", "RadonInteger", "RadonFloat"].includes(dataType))
				result = Buffer.from(utils.fromHexString(record?.result.cbor_bytes)).toString("base64");
			else if (result?.constructor.name === "Buffer") result = result.toString("base64");
			return [
				record.block_epoch,
				record.hash,
				record.query.witnesses,
				Witnet.Coins.fromPedros(record.query.unitary_reward).toString(2),
				dataType === "RadonError" ? helpers.colors.mred("RadonError") : helpers.colors.mgreen(dataType),
				...(options?.verbose 
					? [
							dataType === "RadonError"
								? helpers.colors.red(result)
								: record?.result.finalized
									? helpers.colors.mcyan(result)
									: helpers.colors.cyan(result),
						]
					: [
							result !== "" && record?.result ? `${record.result.cbor_bytes.length / 2} bytes` : "",
							result !== "" && record?.result.timestamp ? moment.unix(record.result.timestamp).fromNow() : "",
						]),
			];
		}),
		{
			headlines: [
				"EPOCH:",
				"DATA REQUEST TRANSACION HASH",
				"witnesses",
				"total fees",
				":data type",
				...(options?.verbose ? [":DATA REQUEST RESULT"] : ["CBOR SIZE:", "DATA FRESHNESS:"]),
			],
			humanizers: [helpers.commas],
			colors: [
				undefined,
				helpers.colors.gray,
				helpers.colors.green,
				helpers.colors.green,
				undefined,
				helpers.colors.cyan,
				helpers.colors.mcyan,
			],
		},
	);
}

async function dataRequest(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No DR_TX_HASH was specified");
	}
	const drTxHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0];
	if (!helpers.isHexString(drTxHash)) {
		throw Error("Invalid DR_TX_HASH was provided");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);

	const drTxJsonReplacer = (key, value) => {
		switch (key) {
			case "proof":
			case "public_key":
			case "signature":
			case "signatures":
				return undefined;

			case "reveal":
			case "tally":
				if (Array.isArray(value)) {
					const result = utils.cbor.decode(Uint8Array.from(value));
					return Buffer.isBuffer(result) ? utils.toHexString(value) : result;
				}

			default:
				return value;
		}
	};

	const mode = options?.mode || `ethereal`;
	if (!["ethereal", "full"].includes(mode)) {
		throw Error(`Invalid mode value: "${options.mode}"`);
	}

	const report = await provider.getDataRequest(drTxHash, mode, options?.force);
	console.info(JSON.stringify(report, drTxJsonReplacer, 4));
}

async function superblock(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No EPOCH was specified");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const superblock = await provider.getSuperblock(args[0]);
	console.info(superblock);
}

async function transaction(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No TX_HASH was specified");
	}
	const txHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0];
	if (!helpers.isHexString(txHash)) {
		throw Error("Invalid TX_HASH was provided");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const transaction = await provider.getTransaction(txHash);
	console.info(`${yellow(JSON.stringify(transaction, utils.txJsonReplacer, 2))}`);
}

async function utxos(options = {}, args = []) {
	if (args.length < 1) {
		throw Error("No WIT_ADDRESS was specified");
	}
	const now = Math.floor(Date.now() / 1000);
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	let utxos = await provider.getUtxos(args[0], {
		minValue: options["min-value"] ? Witnet.Coins.fromWits(Number(options["min-value"])).pedros : undefined,
		fromSigner: options.from,
	});
	let totalBalance = 0n;
	if (!options?.verbose) {
		utxos = utils
			.selectUtxos({ utxos, strategy: options?.strategy || "big-first" })
			.filter((utxo) => utxo.timelock <= now)
			.map((utxo) => {
				totalBalance += utxo.value;
				return [utxo.output_pointer, utxo.value];
			});
		helpers.traceTable(utxos, {
			headlines: [":UTXOs", "Value ($pedros)"],
			humanizers: [undefined, helpers.commas],
			colors: [undefined, myellow],
		});
	} else {
		utxos = utxos.map((utxo) => {
			totalBalance += utxo.value;
			return [
				utxo.output_pointer,
				utxo.timelock > now ? gray(moment.unix(utxo.timelock).fromNow()) : "",
				utxo.timelock > now ? gray(helpers.commas(utxo.value)) : myellow(helpers.commas(utxo.value)),
			];
		});
		helpers.traceTable(utxos, {
			headlines: [":UTXOs", "Timelock", "Value ($pedros)"],
		});
	}
	console.info(`^ Showing ${utxos.length} UTXOs: ${lyellow(helpers.whole_wits(totalBalance, 2))}.`);
}

async function validators(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No WIT_ADDRESS was specified");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const query = {
		filter: { withdrawer: args[0] },
	};
	const records = await provider.stakes(query);
	let nanowits = 0;
	if (records.length > 0) {
		helpers.traceTable(
			records.map((record, index) => {
				nanowits += record.value.coins;
				return [
					1 + index,
					record.key.validator,
					...(options?.verbose ? [record.value.nonce, record.value.epochs.witnessing, record.value.epochs.mining] : []),
					Witnet.Coins.fromNanowits(record.value.coins).wits,
				];
			}),
			{
				headlines: [
					"RANK",
					"VALIDATORS",
					...(options?.verbose ? ["Nonce", "LW_Epoch", "LM_Epoch"] : []),
					"STAKED ($WIT)",
				],
				humanizers: [
					undefined,
					undefined,
					...(options?.verbose ? [helpers.commas, helpers.commas, helpers.commas] : []),
					helpers.commas,
				],
				colors: [undefined, green, ...(options?.verbose ? [undefined, magenta, cyan, myellow] : [myellow])],
			},
		);
		console.info(
			`^ ${records.length} validators for withdrawer ${mgreen(args[0])}: ${lyellow(helpers.whole_wits(nanowits, 2))}`,
		);
	} else {
		console.info(`> No validators found for withdrawer ${mmagenta(args[0])}.`);
	}
}

async function valueTransfer(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No VT_TX_HASH was specified");
	}
	const txHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0];
	if (!helpers.isHexString(txHash)) {
		throw Error("Invalid VT_TX_HASH was provided");
	}
	const mode = options?.mode || `full`;
	if (!["ethereal", "full", "simple"].includes(mode)) {
		throw Error(`Invalid mode value: "${options.mode}"`);
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const transaction = await provider.getValueTransfer(txHash, mode, options?.force);
	console.info(`${yellow(JSON.stringify(transaction, utils.txJsonReplacer, 2))}`);
}

async function withdrawers(options = {}, args = []) {
	if (args.length === 0) {
		throw Error("No WIT_ADDRESS was specified");
	}
	const provider = new Witnet.JsonRpcProvider(options?.provider);
	const query = {
		filter: { validator: args[0] },
	};
	const records = await provider.stakes(query);
	let nanowits = 0;
	if (records.length > 0) {
		helpers.traceTable(
			records.map((record, index) => {
				nanowits += record.value.coins;
				return [
					1 + index,
					record.key.withdrawer,
					...(options?.verbose ? [record.value.nonce, record.value.epochs.witnessing, record.value.epochs.mining] : []),
					Witnet.Coins.fromNanowits(record.value.coins).wits,
				];
			}),
			{
				headlines: [
					"RANK",
					"WITHDRAWERS",
					...(options?.verbose ? ["Nonce", "LW_Epoch", "LM_Epoch"] : []),
					"STAKED ($WIT)",
				],
				humanizers: [
					undefined,
					undefined,
					...(options?.verbose ? [helpers.commas, helpers.commas, helpers.commas] : []),
					helpers.commas,
				],
				colors: [undefined, green, ...(options?.verbose ? [undefined, magenta, cyan, myellow] : [myellow])],
			},
		);
		console.info(
			`^ ${records.length} withdrawers for validator ${mgreen(args[0])}: ${lyellow(helpers.whole_wits(nanowits, 2))}`,
		);
	} else {
		console.info(`> No withdrawers found for validator ${mmagenta(args[0])}.`);
	}
}
