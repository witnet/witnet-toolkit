const cron = require("node-cron");
require("dotenv").config({ quiet: true, path: _spliceFromArgs(process.argv, `--config-path`) });
const { Command } = require("commander");
const moment = require("moment")
const program = new Command();

const { utils, Witnet } = require("../../../dist/src/index.js");
const { version } = require("../../../package.json");

const CHECK_BALANCE_SCHEDULE =
	process.env.WITNET_SDK_WATCHER_BALANCE_SCHEDULE || "*/15 * * * *"; // every 15 minutes
const DRY_RUN_SCHEDULE = process.env.WITNET_SDK_WATCHER_DRY_RUN_SCHEDULE || "* * * * *" // every minute
const WIT_WALLET_MASTER_KEY = process.env.WITNET_SDK_WALLET_MASTER_KEY;

const lastUpdate = {}

main();

async function main() {
	const headline = `WITNET WATCHER BOT v${version}`;
	console.info("=".repeat(120));
	console.info(headline);

	program
		.name("npx --package @witnet/sdk watcher")
		.description("Watcher bot for polling and notarizing data feed updates in Witnet.")
		.version(version);

	program
        .option(
			"--cooldown <secs>",
			"Min. amount of seconds that must elapse before notarizing the next data update in Witnet.",
			process.env.WITNET_SDK_WATCHER_WIT_COOLDOWN_SECS || 900
		)
        .option(
			"--deviation <percentage>",
			"Deviation percentage threshold that will force notarizing a data update in Witnet (numeric data feeds only).",
			process.env.WITNET_SDK_WATCHER_WIT_DEVIATION_PERCENTAGE
		)
        .option(
            "--heartbeat <secs>",
            "If set, max. amount of seconds between data feed updates in Witnet.",
            process.env.WITNET_SDK_WATCHER_WIT_HEARTBEAT_SECS
        )
        .option(
			"--min-balance <wits>",
			"Min. balance threshold",
			process.env.WITNET_SDK_WATCHER_WIT_MIN_BALANCE || 1000.0,
		)
        .option(
			"--network <mainnet|testnet|url>",
			"The name of the Witnet network, or the WIT/RPC provider URL, to connect to.",
			process.env.WITNET_SDK_WATCHER_WIT_NETWORK
                || process.env.WITNET_SDK_PROVIDER_URL
                || "mainnet"
		)
        .option(
			"--priority <priority>",
			"Network priority when notarizing data updates in Witnet.",
			process.env.WITNET_SDK_WATCHER_WIT_NETWORK_PRIORITY ||
				Witnet.TransactionPriority.Medium,
		)
        .option(
            "--notarize-errors",
            "If set, eventual data retrieving errors will also get notarized."
        )
		.option(
			"--signer <wit_pkh>",
			"Witnet public key hash in charge of notarizing data updates.",
			process.env.WITNET_SDK_WATCHER_WIT_SIGNER,
		)
		.option(
            "--target <hex>", 
            "Either the RAD hash or the actual bytecode of the Radon Request used for detecting data updates.", 
            process.env.WITNET_SDK_WATCHER_WIT_RADON_REQUEST
        )
        .option(
			"--witnesses <number>",
			"Size of the witnessing committee when notarizing data updates in Witnet.",
			process.env.WITNET_SDK_WATCHER_WIT_WITNESSES || undefined,
		)
		
	program.parse();

    let { deviation, minBalance } = program.opts();
	const {
		debug,
        target,
        cooldown,
        heartbeat,
		network,
        notarizeErrors,
		priority,
		signer,
        witnesses
	} = program.opts();

	if (!debug) console.debug = () => {};

	if (!WIT_WALLET_MASTER_KEY) {
		console.error(
			`❌ Fatal: a Witnet wallet's master key is not settled on  this environment.`,
		);
		process.exit(0);
	}

    const provider = network === "mainnet" ? "https://rpc-01.witnet.io" : (network === "testnet" ? "https://rpc-testnet.witnet.io" : network)
	const wallet = await Witnet.Wallet.fromXprv(WIT_WALLET_MASTER_KEY, {
		limit: 1,
		provider: await Witnet.JsonRpcProvider.fromURL(provider),
	});
	const ledger = wallet.getSigner(signer || wallet.coinbase.pkh);
	if (!ledger) {
		console.error(
			`❌ Fatal: hot wallet address ${signer} not found in wallet!`,
		);
		process.exit(0);
	}

    console.info(`Wit/RPC provider:  ${provider}`);
	console.info(
		`Witnet network:    WITNET:${wallet.provider.network.toUpperCase()} (${wallet.provider.networkId.toString(16)})`,
	);
	console.info(`Witnet hot wallet: ${ledger.pkh}`);
	console.info(`Network priority:  ${priority.toUpperCase()}`);
	console.info(
		`Balance threshold: ${Witnet.Coins.fromWits(minBalance).toString(2)}`,
	);
    
    if (!target || !utils.isHexString(target)) {
        console.error(
			`❌ Fatal: a valid hex string must be provided as --target.`,
		);
		process.exit(0);
    }

	let request
	try {
		request = Witnet.Radon.RadonRequest.fromBytecode(target)
	} catch {
		const txs = await wallet.provider.searchDataRequests(target, { limit: 1, mode: "ethereal" })
		if (txs.length > 0 && txs[0]?.query) {
			const bytecode = txs[0].query.rad_bytecode
			request = Witnet.Radon.RadonRequest.fromBytecode(bytecode)
			
		} else {
			console.error(
				`❌ Fatal: provided --target is not a valid Radon Request bytecode nor a known Radon Request hash.`
			)
			process.exit(0)
		}
	}
    
    const dataType = request.dataType
    const authorities = request.sources.map(source => source.authority.split(".").slice(-2)[0].toUpperCase())
    console.info(`Radon bytecode:    ${request.toBytecode()}`)
    console.info(`Radon RAD hash:    ${request.radHash}`)
    console.info(`Radon data type:   ${dataType}`)
    console.info(`Data authorities:  ${authorities}`)
	if (heartbeat) console.info(`Update heartbeat:  ${_commas(heartbeat)} "`);
	if (cooldown) console.info(`Update cool-down:  ${_commas(cooldown)} "`);

    // validate deviation parameter, only on integer or float data feeds
    if (["RadonInteger", "RadonFloat"].includes(request.dataType)) {
        deviation = parseFloat(deviation || 0.0)
        console.info(`Update deviation:  ${deviation.toFixed(2)} %`)
    }

	// create DR transaction factory
    const DRs = Witnet.DataRequests.from(ledger, request);
    
    // schedule signer's balance check
	let balance = Witnet.Coins.fromPedros((await ledger.getBalance()).unlocked);
	minBalance = Witnet.Coins.fromWits(minBalance)
	console.info(
		`Initial balance:   ${balance.toString(2)}`,
	);
	if (balance.pedros < minBalance.pedros) {
		console.error(
			`❌ Fatal: hot wallet must be funded with at least ${minBalance.toString(2)}.`,
		);
		process.exit(0);
	} else {
		if (!cron.validate(CHECK_BALANCE_SCHEDULE)) {
			console.error(
				`❌ Fatal: invalid check balance schedule: ${CHECK_BALANCE_SCHEDULE}`,
			);
			process.exit(0);
		}
		console.info(`Checking balance schedule: ${CHECK_BALANCE_SCHEDULE}`);
		cron.schedule(CHECK_BALANCE_SCHEDULE, async () => checkWitnetBalance());
	}

    // schedule data feeding dry runs
    if (!cron.validate(DRY_RUN_SCHEDULE)) {
        console.error(
            `❌ Fatal: invalid dry-run schedule: ${DRY_RUN_SCHEDULE}`,
        )
        process.exit(0)
    }
    console.info(`Dry running schedule: ${DRY_RUN_SCHEDULE}`)
    cron.schedule(DRY_RUN_SCHEDULE, async () => dryRunRadonRequest(), { noOverlap: true })

    // ----------------------------------------------------------------------------------------------------------------
    async function dryRunRadonRequest() {
        const tag = `[@witnet/sdk/watcher][witnet:${wallet.provider.network}]`
        try {
            let notarize = false
            let dryrun = JSON.parse(await request.execDryRun())
            let result 
            if (Object.keys(dryrun).includes("RadonError")) {
                if (notarizeErrors) {
                    notarize = true
                    result = dryrun.RadonError
                } else {
                    throw `Unexpected dry run error: ${JSON.stringify(result)}`
                }
            
            } else if (["RadonInteger", "RadonFloat"].includes(dataType) && Object.keys(dryrun).includes(`${dataType}`)) {
                result = parseFloat(dryrun[`${dataType}`])
                if (deviation && lastUpdate?.value) {
                    notarize = (Math.abs(result - lastUpdate.value) / lastUpdate.value) >= deviation
                } else {
                    notarize = true
                }

            } else if (!lastUpdate?.value || lastUpdate.value !== result) {
                notarize = true
            }
            console.info(`${tag} Dry run result => ${JSON.stringify(dryrun)}`)
            const clock = Math.floor(Date.now() / 1000)
            const elapsed = clock - (lastUpdate?.timestamp || (clock - cooldown - 1))
            if (!notarize && heartbeat && elapsed >= heartbeat) {
                console.info(`${tag} Notarizing data due to heartbeat after ${elapsed} secs ...`)
                notarize = true
            } else if (notarize) {
                if (!cooldown || elapsed >= cooldown) {
                    console.info(`${tag} Notarizing possible data update as provided by ${authorities} ...`)
                } else {
                    throw `Postponing possible data update as only ${elapsed} out of ${cooldown} secs elapsed since the last notarized update.`
                }
            }
            if (notarize) {
                lastUpdate.timestamp = clock
                lastUpdate.value = result
                return notarizeRadonRequest(tag)
            }
        } catch (err)  {
            console.warn(`${tag} ${err}`)
        }
    }

    // ----------------------------------------------------------------------------------------------------------------
	async function notarizeRadonRequest(tag) {
		try {
			// create, sign and send new data request transaction
			let tx = await DRs.sendTransaction({ witnesses, fees: priority })
			console.info(`${tag} RAD hash   =>`, tx.radHash);
			console.info(`${tag} DRT hash   =>`, tx.hash);
			console.info(`${tag} DRT weight =>`, _commas(tx.weight));
			console.info(`${tag} DRT wtnsss =>`, tx.witnesses);
			console.debug(
				`${tag} DRT inputs =>`,
				tx.tx?.DataRequest?.signatures.length,
			);
			console.info(
				`${tag} DRT cost   =>`,
				Witnet.Coins.fromNanowits(
					tx.fees.nanowits + tx.value?.nanowits,
				).toString(2),
			);

			// await inclusion in Witnet
			tx = await DRs.confirmTransaction(tx.hash, {
				onStatusChange: () => console.info(`${tag} DRT status =>`, tx.status),
			}).catch((err) => {
				throw err;
			});

			console.debug(
				`${tag} Cache info after confirmation =>`,
				ledger.cacheInfo,
			);

			// await resolution in Witnet
			let status = tx.status;
			do {
				const report = await ledger.provider.getDataRequest(
					tx.hash,
					"ethereal",
				);
				if (report.status !== status) {
					status = report.status;
					console.info(`${tag} DRT status =>`, report.status);
				}
				if (report.status === "solved" && report?.result) {
                    lastUpdate.cborBytes = report.result.cbor_bytes
					const result = utils.cbor.decode(
						utils.fromHexString(report.result.cbor_bytes),
					);
                    console.info(`${tag} DRT result =>`, result);
					console.info(`${tag} DRT tmstmp =>`, moment.unix(report.result.timestamp));
                    lastUpdate.value = result
					break;
				}
				const delay = (ms) =>
					new Promise((_resolve) => setTimeout(_resolve, ms));
				await delay(5000);
			} while (status !== "solved");
		} catch (err) {
			console.warn(`${tag} ${err}`);
		}
	}

    // ----------------------------------------------------------------------------------------------------------------
	async function checkWitnetBalance() {
        const tag = `[@witnet/sdk/watcher][witnet:${wallet.provider.network}:${ledger.pkh}]`
		try {
			balance = Witnet.Coins.fromPedros(
				(await ledger.getBalance()).unlocked,
			);
		} catch (err) {
			console.error(
				`${tag} Cannot check balance: ${err}`,
			);
		}
		console.info(
			`${tag} Balance: ${balance.toString(2)}`,
		);
		if (balance.pedros < minBalance.pedros)
			console.warn(
				`${tag} Low funds !!!`,
			);
		return balance;
	}
}

const _commas = (number) => {
	const parts = number.toString().split(".");
	const result =
		parts.length <= 1
			? `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`
			: `${parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${parts[1]}`;
	return result;
};

function _spliceFromArgs(args, flag) {
	const argIndex = args.indexOf(flag)
	if (argIndex >= 0 && args.length > argIndex + 1) {
		const value = args[argIndex + 1]
		args.splice(argIndex, 2)
		return value
	}
}
