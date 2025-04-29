const qrcodes = require('qrcode-terminal')
const inquirer = require('inquirer')

const { utils, Witnet } = require("../../../dist/src");

const helpers = require("../helpers");
const { loadAssets } = require("./radon")

const { whole_wits } = helpers
const { bblue, bcyan, bgreen, cyan, gray, green, lcyan, lmagenta, lyellow, magenta, mcyan, mgreen, mmagenta, myellow, normal, yellow, white, } = helpers.colors

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    envars: {
        WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
        WITNET_SDK_WALLET_MASTER_KEY: "=> Wallet's master key in XPRV format, as exported from either a node, Sheikah or myWitWallet.",
    },
    flags: {
        await: {
            hint: "Await any involved transaction to get eventually mined (default: false).",
        },
        confirmations: {
            hint: "Number of epochs to await after any involved transaction gets mined (implies --await).",
            param: "NUMBER",
        },
        // dryrun: {
        //     hint: "Prepare and sign involved transactions, without any actual transmission taking place."
        // },
        force: {
            hint: "Broadcast transaction/s without user's final confirmation.",
        },
        gap: {
            hint: "Max indexing gap when searching for funded accounts (default: 10).",
            param: "GAP",
        },
        // limit: {
        //     hint: `Number of consecutive HD-accounts to derive, even if holding no balance.`,
        //     param: "LIMIT",
        // },
        priority: {
            hint: "Transaction priority: `stingy`, `low`, `medium`, `high`, `opulent`.",
            param: "PRIORITY",
        },
        provider: {
            hint: "Public Wit/Oracle JSON-RPC provider, other than default.",
            param: "URL",
        },
        strategy: {
            hint: "UTXOs selection strategy: `big-first`, `random`, `slim-fit`, `small-first` (default: `slim-fit`).",
            param: "STRATEGY",
        },
        verbose: {
            hint: "Outputs detailed information."
        },
    },
    router: {
        accounts: {
            hint: "List wallet's HD-accounts treasuring staked, locked or unlocked Wits.",
            params: ["[WIT_ADDRESSES ...]"],
            options: {
                limit: {
                    hint: `Number of consecutive HD-accounts to derive (implies --no-funds).`,
                    param: "LIMIT",
                },
                qrcode: {
                    hint: "Prints QR codes for all accounts, or the one with highest index if using flag `limit`."
                },
                "no-funds": {
                    hint: "Derive accounts even if they hold no funds."
                },
            },
        },
        // "create*": {
        //     hint: "Create some random master key.",
        //     options: {
        //         vanity: {
        //             hint: "Vanity prefix of the resulting public key hash address (e.g. `herrer0`)",
        //             param: "BECH32_PREFIX",
        //         },
        //     }
        // },
        coinbase: {
            hint: "List withdrawers delegating stake into the coinbase address.",
            options: {
                authorize: {
                    hint: "Generate stake authorization code for the specified withdrawer address.",
                    param: "WITHDRAWER_PKH",
                },
                "node-master-key": {
                    hint: "Node's master key other than the one set up in environment",
                },
            },
        },
        decipher: {
            hint: "Decipher some master key as exported from myWitWallet.",
        },
        delegatees: {
            hint: "List validators treasuring delegated stake from any of the wallet's accounts.",
        },
        notarize: {
            hint: "Ask the Wit/Oracle to notarize and forever store the resolution to some Radon asset.",
            params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET"],
            options: {
                fees: {
                    hint: "Specific unitary reward for every involved validator (supersedes --priority).",
                    param: "WITS",
                },
                from: {
                    hint: "Authorized wallet account that will pay for the oracle query, other than wallet's default.",
                    param: "WALLET_ADDRESS",
                },
                module: {
                    hint: 'NPM package where to search for Radon assets.',
                    param: 'NPM_PACKAGE'
                },
                witnesses: { 
                    hint: "Number of witnesses in the Witnet network required to attend the oracle query (default: 3).", 
                    param: "WITNESSES"
                },
            }
        },
        provider: {
            hint: "Show the underlying Wit/Oracle RPC provider being used."
        },
        stake: {
            hint: "Stake specified amount of Wits by using some given authorization code.",
            params: "AUTH_CODE",
            options: { 
                fees: {
                    hint: "Settle total fees to pay for the transaction to get mined (default: 1 μWit).",
                    param: "WITS",
                },
                from: {
                    hint: "Authorized wallet account with rights to eventual withdraw the stake deposit, and yield.",
                    param: "WALLET_ADDRESS",
                },
                value: {
                    hint: "Amount in Wits to stake into the validator that signed the authorization (min: 10 KWits).",
                    param: "WITS | `all`",
                },
            }
        },
        transfer: {
            hint: "Transfer specified amount of Wits to given address.",
            params: "WIT_ADDRESS",
            options: {
                fees: {
                    hint: "Settle total fees to pay for the transaction to get mined (default: 1 μWit).",
                    param: "WITS",
                },
                from: {
                    hint: "Wallet address to transfer value from.",
                    param: "WALLET_ADDRESS",
                },
                value: {
                    hint: "Amount in Wits to be transfered (e.g. `0.5` Wits).",
                    param: "WITS | `all`",
                },
            },
        },
        utxos: {
            hint: "List currently available UTXOs on wallet's specified address, or on all funded accounts otherwise.",
            params: "[WALLET_ADDRESS]",
            options: {
                fees: {
                    hint: "Settle total fees to pay for involved transactions to get mined (default: 1 μWit).",
                    param: "WITS",
                },
                into: {
                    hint: "Alternative wallet address where to JOIN or SPLIT the selected UTXOs.",
                    param: "WALLET_ADDRESS"
                },
                join: { hint: "Join selected UTXOs together into a single UTXO.", },
                split: { 
                    hint: "Number of UTXOs to split the target balance into (max: 50).", 
                    param: "SPLITS"
                },
                value: {
                    hint: "Amount in Wits to be either joined or split apart.",
                    param: "WITS | `all`",
                }
            },
        },
        withdraw: {
            hint: "Withdraw specified amount of staked Wits from some given delegatee.",
            params: "DELEGATEE_PKH",
            options: {
                fees: {
                    hint: "Settle total fees to pay for the transaction to get mined (default: 1 μWit).",
                    param: "WITS",
                },
                into: {
                    hint: "Wallet address with rights to withdraw from the delegatee (default: wallet's first account).",
                    param: "WALLET_ADDRESS",
                },
                value: {
                    hint: "Amount in Wits to withdraw.",
                    param: "WITS | `all`",
                },
            }
        },
    },
    subcommands: {
        accounts, coinbase, decipher, delegatees: validators, notarize: resolve, provider, stake, transfer, withdraw: unstake, utxos,  
    },
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function accounts(flags = {}, _args = [], options = {}){
    const { coinbase, verbose } = flags
    const { qrcode } = options
    const wallet = await initializeWallet({ unlocked: options?.unlocked, limit: options?.limit, ...flags })
    
    if (qrcode) {
        if (wallet.accounts.length > 0) {
            const account = wallet.accounts[wallet.accounts.length - 1]
            qrcodes.generate(account.pkh)
            console.info(`Wallet account #${wallet.accounts.length}: ${lmagenta(account.pkh)}\n`)

        } else {
            qrcodes.generate(wallet.coinbase.pkh)
            console.info(`Wallet coinbase: ${lcyan(wallet.coinbase.pkh)}\n`)
        }
        
    } else {
        let records = []
        // if (coinbase) {
        //     records.push([ wallet.coinbase.pkh, await wallet.coinbase.countUtxos(), await wallet.coinbase.getBalance() ])
        // } else {
            records.push(
                [ wallet.coinbase.pkh, await wallet.coinbase.countUtxos(), await wallet.coinbase.getBalance() ],
                ...await Promise.all(
                    wallet.accounts.map(async account => [ 
                        account.pkh, 
                        await account.countUtxos(), 
                        await account.getBalance(),  
                    ]),
                )
            )
        // }
        let unlocked = 0
        helpers.traceTable(
            records.map(([pkh, count, balance], index) => {
                unlocked += balance.unlocked
                return [
                    index, // ...(coinbase ? [] : [ index + 1 ]),
                    index === 0 // ...(verbose && !coinbase ? [ magenta(internal) ] : []),
                        ? (balance.unlocked > 0 ? mcyan(pkh) : cyan(pkh)) 
                        : (balance.unlocked > 0 ? mmagenta(pkh) : magenta(pkh)),
                    
                    count,
                    ...(verbose
                        ? [ 
                            helpers.fromNanowits(balance.locked), 
                            helpers.fromNanowits(balance.staked), 
                            helpers.fromNanowits(balance.unlocked), 
                            helpers.fromNanowits(balance.locked + balance.staked + balance.unlocked),
                        ] : [
                            helpers.fromNanowits(balance.unlocked), 
                        ]
                    ),
                ]
            }), {
                headlines: [ 
                    "INDEX", ":WALLET ACCOUNTS", // ...(coinbase ? [ "WALLET COINBASE" ] : ["INDEX", ":WALLET ACCOUNTS"]),
                    "# UTXOs", 
                    ...(verbose 
                        ? [ "Locked ($WIT)", "Staked ($WIT)", "Unlocked ($WIT)", "BALANCE ($WIT)" ]
                        : [ "Unlocked ($WIT)"]
                    ),
                ],
                humanizers: [ 
                    helpers.commas,, //...(coinbase ? [,] : [helpers.commas,,]),
                    helpers.commas, helpers.commas, helpers.commas, helpers.commas, helpers.commas 
                ],
                colors: [ 
                    ,, //...(coinbase ? [,] : [,,]),
                    ...(verbose 
                        ? [ white, gray, yellow, myellow, lyellow ]
                        : [ white, myellow ]
                    ),
                ],
                maxColumnWidth: 48,
            }
        )
        if (verbose/* && !coinbase && wallet.accounts.length > 1*/) {
            console.info(`^ Unlocked balance: ${myellow(whole_wits(unlocked, 2))}`)
        }
    }
}

async function authorize(flags = {}, [withdrawer]) {
    const wallet = await initializeWallet({ coinbase: true, ...flags })
    withdrawer = flags?.coinbase ? wallet.coinbase.pkh : withdrawer
    const authcode = wallet.coinbase.authorizeStake(withdrawer)
    console.info("Validator address: ", mcyan(wallet.coinbase.pkh))
    console.info("Withdrawer address:", mmagenta(withdrawer))
    qrcodes.generate(authcode)
    console.info(`${white(authcode)}`)
}

async function decipher() {
    const prompt = inquirer.createPromptModule()
    const user = await prompt([
        {
            message: "Enter XPRV:",
            name: "xprv",            
        }, { 
            type: "password",
            mask: "*",
            message: "Enter password:",
            name: "passwd",
        },
    ])
    console.info(utils.decipherXprv(user.xprv, user.passwd))
}

async function provider(flags = {}) {
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })
    wallet.provider.endpoints.forEach(url => {
        console.info(helpers.colors.magenta(url))
    })
}

async function resolve(flags = {}, [pattern, ...args], options ={}) {
    const { dryrun, verbose } = flags
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })
    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.findAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--from address not found in wallet."
    }
    
    const request = await loadRadonRequest(args, { legacy: options?.legacy, pattern })
    
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    const fees = utils.fromWits(options?.fees || 0.5) // 0.5 Wits as default fees
    const witnesses = parseInt(options?.witnesses || 3)

    await helpers.traceTransaction(
        Witnet.DataRequests.from(account, request), {
            confirmations, dryrun, headline: `DATA REQUEST TRANSACTION`, verbose, color: bgreen, 
            fees, witnesses,
        }
    )
}

async function stake(flags = {}, [authorization], options = {}) {
    if (!authorization) {
        throw "No authorization code was provided."
    } else if (!options?.value) {
        throw "No --value was specified."
    }
    const { dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })

    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.findAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--from address not found in wallet."
    }

    const fees = utils.fromWits(options?.fees || 0.000001) // 1 microWit as default fee
    const value = options.value.toLowerCase() === 'all' ? (await account.getBalance()).unlocked - fees : utils.fromWits(options.value)

    await helpers.traceTransaction(
        Witnet.StakeDeposits.from(account), {
            confirmations, dryrun, headline: `STAKE DEPOSIT TRANSACTION`, verbose, color: bcyan, 
            authorization, fees, value, withdrawer: account.pkh,
        }
    )
}

async function transfer(flags, args = [], options = {}) {
    if (args.length === 0) {
        throw "No recipient address was specified."
    } else if (!options?.value) {
        throw "No transfer value was specified."
    }
    const { coinbase, dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })
    
    const account = coinbase 
        ? wallet.coinbase
        : (options?.from ? wallet.findAccount(options.from) : wallet.accounts[0])
    
    if (!account) {
        throw "--from address not found in wallet."
    }

    const fees = utils.fromWits(options?.fees || 0.000001) // 1 microWit as default fee
    const value = options.value.toLowerCase() === 'all' ? (await account.getBalance()).unlocked - fees : utils.fromWits(options.value)
    const recipients = [[ Witnet.PublicKeyHash.fromBech32(args[0]).toBech32(wallet.network), value ]]
    
    await helpers.traceTransaction(
        Witnet.ValueTransfers.from(account), { 
            confirmations, dryrun, headline: `VALUE TRANSFER TRANSACTION`, verbose, color: bblue,
            fees, recipients,
        }
    )
}

async function unstake(flags, [validator], options = {}) {
    if (!options.value) {
        throw "No --value was specified."
    } else if (!flags?.coinbase && !options?.into) {
        throw "No --into was specified."
    }
    Witnet.PublicKeyHash.fromBech32(validator)
    const { coinbase, dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })

    const account = coinbase
        ? wallet.coinbase
        : (options?.into ? wallet.findAccount(options.into) : wallet.accounts[0])

    if (!account) {
        throw "--into address not found in wallet."
    }

    const fees = utils.fromWits(options?.fees || 0.000001) // 1 microWit as default fee
    const value = utils.fromWits(options.value) // options.value.toLowerCase() === 'all' ? (await account.getStakedOn(validator)) - fees : utils.fromWits(options.value)

    await helpers.traceTransaction(
        Witnet.StakeWithdrawals.from(account), {
            confirmations, dryrun, headline: `STAKE WITHDRAWAL TRANSACTION`, verbose, 
            fees, value, validator,
        }
    )
}

async function utxos(flags, [from, ], options = {}) {
    const { dryrun, verbose } = flags
    const wallet = await initializeWallet({ unlocked: true, limit: 1, ...flags })
    const account = (
        from
            ? (from === wallet.coinbase.pkh ? wallet.coinbase : wallet.findAccount(from))
            : ((await wallet.coinbase.getBalance()).unlocked > 0 ? wallet.coinbase : wallet.accounts[0])
    )
    if (!account)  {
        throw `Address ${from} does not belong to the wallet.`
    } else {
        from = account.pkh
    }
    const coinbase = account.pkh === wallet.coinbase.pkh

    // query total unlocked
    let totalUnlocked = 0
    if (coinbase) {
        totalUnlocked = (await wallet.coinbase.getBalance()).unlocked
    } else {
        totalUnlocked = (await account.getBalance()).unlocked
    }

    // extract confirmations and fees from CLI 
    const confirmations = flags?.confirmations ? parseInt(flags.confirmations) : (flags?.await ? 0 : (options?.join && options?.split ? 0 : undefined))
    const fees = utils.fromWits(options?.fees || 0.000001) // 1 microWit as default fee

    // extract target value, if any, from CLI
    let targetValue = 0
    if (options?.value) {
        if (options.value.toLowerCase() === 'all') {
            targetValue = totalUnlocked - fees
        
        } else {
            targetValue = helpers.fromWits(parseFloat(options.value))
        }
    }

    // select utxos based on selected strategy, and target value (which might be relevant on some strategies)
    let utxos = []
    if (coinbase) {
        // from = wallet.coinbase.pkh
        utxos = (await wallet.coinbase.selectUtxos({ cover: targetValue })).map(utxo => ({ pkh: mcyan(from), ...utxo }))
        
    } else {
        // from = account.pkh
        let intPkh = account.internal.pkh
        utxos = [
            ...(await account.internal.selectUtxos({ cover: targetValue })).map(utxo => ({ pkh: magenta(intPkh), internal: true, ...utxo })),
            ...(await account.external.selectUtxos({ cover: targetValue })).map(utxo => ({ pkh: mmagenta(from), ...utxo }))
        ]
    }

    // determine into address, other than from, if specified
    const into = options?.into
    if (into) {
        if (into !== from && !wallet.findAccount(into) && into !== wallet.coinbase.pkh) {
            const prompt = inquirer.createPromptModule()
            const user = await prompt([{ 
                message: `Into-account ${into} does not belong to the wallet. Proceed anyway?`, 
                name: "continue", 
                type: "input", 
            }])
            if (!user.continue.toLowerCase().startsWith("y")) {
                throw `Into-account ${into} not found in wallet.`
            }
        }
    }
    
    // select actual utxos to operate with:
    let coveredValue = 0
    if (targetValue > 0) {
        let targetIndex = 0
        for (; targetIndex < utxos.length && coveredValue < targetValue + fees; targetIndex ++) {
            coveredValue += utxos[targetIndex].value
        }
        if (coveredValue < targetValue + fees) {
            throw `Not enough unlocked UTXOs on ${coinbase ? mcyan(from) : mmagenta(from)} (${whole_wits(coveredValue)} < ${myellow(whole_wits(targetValue + fees))}.`
        } else {
            utxos.splice(targetIndex)
        }
    } else {
        utxos.forEach(utxo => coveredValue += utxo.value)
    }
    
    // only if at least one utxo is selected, proceed with report and other operations, if any
    if (utxos.length > 0) {
        if (verbose || (!options?.join && !options?.split)) {
            helpers.traceTable(
                utxos.map((utxo, index) => [
                    index + 1,
                    utxo?.internal ? green(utxo.output_pointer) : mgreen(utxo.output_pointer),
                    utxo.value
                ]), {
                    headlines: [ "INDEX", ":Unlocked UTXOs", "Value ($nanoWIT)", ],
                    humanizers: [ helpers.commas,, helpers.commas ],
                    colors: [ ,, myellow, ]
                }
            )
            if (coinbase) {
                console.info(`^ Wallet coinbase: ${mcyan(from)}`)
            } else {
                console.info(`^ Wallet account: ${mmagenta(from)}`)
            }
        }

        const valueTransfer = coinbase
            ? Witnet.ValueTransfers.from(wallet.coinbase) 
            : Witnet.ValueTransfers.from(wallet.findAccount(from))
        
        if (options?.join) {
            if (!options?.value) {
                throw `--value must be specified for a JOIN operation.`
            }
            const recipients = [[ options?.split ? from : (into || from), targetValue ]]
            await helpers.traceTransaction(valueTransfer, { 
                confirmations, dryrun, verbose, headline: `JOINING UTXOs: ${utxos.length} -> ${targetValue < coveredValue ? 2 : 1}` ,
                fees, recipients,
            })
        }
        if (options?.split) {
            if (!options?.value) {
                throw `--value must be specified for a SPLIT operation.`
            }
            const recipients = []
            const splits = parseInt(options.split)
            if (splits > 50) {
                throw "Sorry, not possible to split into more than 50 UTXOs."
            }
            const splitBalance = Math.floor(targetValue / splits)
            recipients.push(...Array(splits).fill([ into || from, splitBalance ])) 
            await helpers.traceTransaction(valueTransfer, {
                confirmations, dryrun, verbose, 
                headline: `SPLITTING UTXOs: ${utxos.length} -> ${splitBalance * splits < coveredValue ? splits + 1 : splits}`,
                fees, recipients,
            })
        }

    } else {
        console.info(`> No unlocked UTXOs on ${coinbase ? mcyan(from) : mmagenta(from)} at the moment.`)
    }
}

async function validators(flags = {}, [], options = {}) {
    const { coinbase, verbose } = flags
    const wallet = await initializeWallet({ unlocked: options?.unlocked, limit: options?.limit, ...flags })
    const order = { by: Witnet.StakesOrderBy.Coins, reverse: true }
    let records, staked = 0
    if (coinbase) {
        records = await wallet.coinbase.getDelegates(order)
    } else {
        records = await wallet.getDelegates(order)
    }
    if (records.length > 0) {
        helpers.traceTable(
            records.map((record, index) => {
                staked += record.value.coins
                return [
                    // 1 + index,
                    record.key.withdrawer === wallet.coinbase.pkh
                        ? (record.key.validator !== "" ? mcyan(record.key.withdrawer) : cyan(record.key.withdrawer))
                        : (record.key.validator !== "" ? mmagenta(record.key.withdrawer) : magenta(record.key.withdrawer)),
                    ...(record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
                        ? [ mcyan(record.key.validator), record.value.nonce ]
                        : [ cyan(record.key.validator), gray(record.value.nonce || "") ]
                    ),
                    ...(verbose
                        ? [ record.value.epochs.witnessing || "", record.value.epochs.mining || "" ]
                        : [ ]
                    ),
                    yellow(helpers.fromNanowits(record.value.coins)),
                ]
            }), {
                headlines: [
                    // "INDEX",
                    coinbase ? "WALLET COINBASE" : "WALLET ACCOUNTS",
                    "DELEGATED STAKE OPERATORS",
                    ...(verbose
                        ? [ "Nonce", "LW_Epoch", "LM_Epoch" ]
                        : [ "Nonce" ]
                    ),
                    "STAKED ($WIT)"
                ],
                humanizers: [
                    ,, ...(verbose
                        ? [ helpers.commas, helpers.commas, helpers.commas ]
                        : [ helpers.commas ]
                    ),
                    helpers.commas,
                ],
                colors: [ 
                    ,,, ...(verbose
                        ? [ magenta, cyan, myellow, ]
                        : [ myellow, ]
                    )
                ],
            }
        )
        if (verbose) {
            console.info(`^ Delegated stake: ${myellow(whole_wits(staked, 2))}`)
        }
    } else {
        console.info(`> No validators found.`)
    }
}


/// ===================================================================================================================
/// --- Internal functions --------------------------------------------------------------------------------------------

async function loadRadonRequest(args = [], options = {}) {    
  
    // TODO:
    // if (options?.pattern && typeof options.pattern === 'string' && utils.isHexString(options.pattern)) {
    //     if (utils.isHexStringOfLength(options.pattern, 32)) {
    //         throw `Searching RADON_BYTECODE by RAD_HASH not yet supported.`
    //     } else try {
    //         return Witnet.RadonRequest.fromHexString(pattern)
    //     } catch {
    //         throw `Invalid RADON_BYTECODE.`
    //     }
    // }   
    
    // load Radon assets from environment
    let assets = utils.searchRadonAssets(
        {
            assets: loadAssets(options),
            pattern: options?.pattern,
        }, 
        (key, pattern) => key.toLowerCase().indexOf(pattern.toLowerCase()) >= 0
    );
    
    if (args.length > 0) {
        // ignore RadonRequests if args were passed from the CLI
        assets = assets.filter(([,artifact]) => !(artifact instanceof Witnet.Radon.RadonRequest));
    }
    
    // sort Radon assets alphabetically 
    assets = assets.sort((a, b) => {
        if (a[0] < b[0]) return -1;
        else if (a[0] > b[0]) return 1;
        else return 0;
    })
    
    let artifact, key
    if (Object.keys(assets).length === 0) {
        if (options?.pattern) {
            throw `No Radon assets named after "${options.pattern}".`
        } else {
            throw `No Radon assets declared yet.`
        }

    } else if (Object.keys(assets).length > 1) {
        const prompt = inquirer.createPromptModule()
        const user = await prompt([{ 
            choices: assets.map(([key,]) => key),
            message: "Please, select one Radon asset:", 
            name: "key", 
            type: "list", 
            pageSize: 24,
        }]);
        [key, artifact] = assets.find(([key,]) => key === user.key)
    
    } else {
        [key, artifact] = Object.values(assets)[0]
    }

    if (!(artifact instanceof Witnet.Radon.RadonRequest)) {
        let templateArgs = []
        if (args.length === 0 && artifact?.samples) {
            const prompt = inquirer.createPromptModule()
            const sample = await prompt([{
                choices: Object.keys(artifact.samples),
                message: "Select pre-settled Radon args: ",
                name: "key",
                type: "list",
            }])
            templateArgs = artifact.samples[sample.key] 
        
        } else if (args.length === 1 && artifact?.samples) {
            const sample = Object.keys(artifact.samples).find(sample => sample.toLowerCase() === args[0].toLowerCase())
            if (sample) templateArgs = artifact.samples[sample]
        }
        
        if (artifact instanceof Witnet.Radon.RadonRetrieval) {
            if (templateArgs.length === 0) templateArgs = [ ...args ]
            if (templateArgs.length < artifact.argsCount) {
                throw `${key}: missing ${artifact.argsCount - templateArgs.length} out of ${artifact.argsCount} parameters.`
            }
            artifact = new Witnet.Radon.RadonRequest({ sources: artifact.foldArgs(templateArgs) })
        
        } else {
            if (artifact instanceof Witnet.Radon.RadonModal) {
                if (templateArgs.length === 0) templateArgs = [ ...args ]
                if (templateArgs.length === 0 && templateArgs.length < artifact.argsCount + 1) {
                    throw `${key}: missing ${artifact.argsCount + 1 - templateArgs.length} out of ${artifact.argsCount + 1} parameters.`
                }
                artifact.providers = templateArgs.splice(0, 1)[0].split(';')
                artifact = artifact.buildRadonRequest(templateArgs)
            
            } else if (artifact instanceof Witnet.Radon.RadonTemplate) {
                if (templateArgs.length === 0) {
                    templateArgs = new Array(artifact.sources.length)
                    artifact.sources.forEach((retrieval, index) => {
                        templateArgs[index] = args.splice(0, retrieval.argsCount)
                        if (templateArgs[index].length < retrieval.argsCount) {
                            throw `${key}: missing ${
                                retrieval.argsCount - templateArgs[index].length
                            } out of ${
                                retrieval.argsCount
                            } expected args for template source #${index + 1}.`
                        }
                    })
                }
                artifact = artifact.buildRadonRequest(templateArgs)
            
            } else {
                throw `${key}: unsupported Radon asset type ${artifact?.constructor.name}` 
            }
        }
    }
    return artifact
}

    if (!process.env.WITNET_SDK_WALLET_MASTER_KEY) {
        throw "No WITNET_SDK_WALLET_MASTER_KEY is settled in environment."
    } else {
        const provider = new Witnet.Provider(flags?.provider)
        const strategies = {
            'small-first': Witnet.UtxoSelectionStrategy.SmallFirst,
            'slim-fit': Witnet.UtxoSelectionStrategy.SlimFit,
            'big-first': Witnet.UtxoSelectionStrategy.BigFirst,
            'random': Witnet.UtxoSelectionStrategy.Random,
        }
        if (flags?.strategy && !strategies[flags.strategy]) {
            throw `Unrecognised UTXO selection strategy "${flags.strategy}"`
        }
        const strategy = strategies[flags?.strategy || 'small-first'] || Witnet.UtxoSelectionStrategy.SmallFirst
        const gap = flags['gap'] || 32
        let wallet, xprv = flags?.xprv || process.env.WITNET_SDK_WALLET_MASTER_KEY
        if (xprv.length === 293) {
            const prompt = inquirer.createPromptModule()
            const user = await prompt([{ type: "password", mask: "*", message: "Enter password:", name: "passwd"}])
            wallet = await Witnet.Wallet.fromEncryptedXprv(xprv, user.passwd, { 
                gap, provider, strategy,
                limit: flags?.limit,
                unlocked: flags?.unlocked, 
            })
        } else {
            wallet = await Witnet.Wallet.fromXprv(xprv, {
                gap, provider, strategy, 
                limit: flags?.limit || 1,
                unlocked: flags?.unlocked,
            })
        }
        return wallet
    }
}
