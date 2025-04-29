const qrcodes = require('qrcode-terminal')
const inquirer = require('inquirer')

const { utils, Witnet } = require("../../../dist/src");

const helpers = require("../helpers");
const { loadAssets } = require("./radon")

const { whole_wits } = helpers
const { bblue, bcyan, bgreen, cyan, gray, green, lcyan, lmagenta, lyellow, magenta, mcyan, mgreen, mmagenta, mred, myellow, red, yellow, white, } = helpers.colors

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

async function accounts(flags = {}, args = [], options = {}) {
    const { verbose } = flags
    
    let wallet
    if (args.length === 0) wallet = await _loadWallet({ 
        ...flags, 
        limit: options?.limit || (options['no-funds'] && 10),
        'no-funds': options['no-funds']
    });
    else {
        wallet = await _loadWallet({ provider: flags?.provider, limit: 1 })
        args.forEach(pkh => {
            if (!wallet.getSigner(pkh)) {
                throw `Input address ${pkh} doesn't belong to the wallet.`
            }
        })
    }

    if (options?.qrcode) {
        if (args.length > 0) {
            accounts = wallet.accounts.filter(account => args.includes(account.pkh))
        } else {
            accounts = wallet.accounts
        }
        accounts.forEach(account =>{
            qrcodes.generate(account.pkh)
            console.info(`Wallet account #${account.index + 1}: ${lmagenta(account.pkh)}\n`)
        })
        return
    } 
    
    const coinbaseWithdrawers = await wallet.coinbase.getWithdrawers()
    const coinbaseBalance = await wallet.coinbase.getBalance()
    const coinbaseColor = utils.totalBalance(coinbaseBalance) > 0 ? mred : (coinbaseWithdrawers.length > 0 ? mcyan : cyan)
    const coinbase = coinbaseWithdrawers.length > 0 || utils.totalBalance(coinbaseBalance) > 0
    
    let records = []

    if (coinbase) {
        const coinbaseUtxos = await wallet.coinbase.getUtxos()
        records.push([ 0, coinbaseColor(wallet.coinbase.pkh), coinbaseUtxos.length, coinbaseBalance ])
    } 
    records.push(
        ...await Promise.all(
            wallet.accounts.map(async account => {
                const balance = await account.getBalance()
                const utxos = await account.getUtxos()
                return [ 
                    account.index + 1,
                    balance.unlocked > 0 ? mmagenta(account.pkh) : magenta(account.pkh), 
                    utxos.length, 
                    balance,
                ]
            }),
        )
    )

    let unlocked = 0
    helpers.traceTable(
        records.map(([index, pkh, count, balance]) => {
            unlocked += balance.unlocked
            return [
                index,
                pkh, 
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
                    ? [ "Locked ($WIT)", "Staked ($WIT)", "Available ($WIT)", "BALANCE ($WIT)" ]
                    : [ "Available ($WIT)"]
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
    console.info(`^ Available balance: ${myellow(whole_wits(unlocked, 2))}`)
}

async function coinbase(flags = {}, _args = [], options = {}) {
    const masterWallet = await _loadWallet({ ...flags })
    let wallet
    if (options['node-master-key']) {
        utils.parseXprv(options['node-master-key']);
        wallet = await _loadWallet({ provider: flags?.provider, limit: 1, xprv: options['node-master-key'] })
    } else {
        wallet = masterWallet
    }

    const coinbaseColor = utils.totalBalance(await wallet.coinbase.getBalance()) > 0 ? mred: lcyan
    console.info(`> ${options['node-master-key'] ? "Coinbase ": "Wallet's coinbase"} address: ${coinbaseColor(wallet.coinbase.pkh)}`)
    
    if (options?.authorize) {
        const withdrawer = options.authorize
        const authcode = wallet.coinbase.authorizeStake(withdrawer)
        qrcodes.generate(authcode)
        console.info(`${white(authcode)}`)
        console.info("^ Withdrawer address:", mmagenta(withdrawer))

    } else {
        const records = await wallet.coinbase.getWithdrawers({ by: Witnet.StakesOrderBy.Coins, reverse: true })
        if (records.length > 0) {
            const { verbose } = flags
            let staked = 0
            helpers.traceTable(
                records.map((record, index) => {
                    staked += record.value.coins
                    const withdrawer = (record.key.withdrawer === wallet.coinbase.pkh || record.key.withdrawer === masterWallet.coinbase.PublicKeyHash
                            ? (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
                                ? mred(record.key.withdrawer)
                                : red(record.key.withdrawer)
                            ) : (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
                                ? (masterWallet.getSigner(record.key.withdrawer) ? mgreen(record.key.withdrawer) : mmagenta(record.key.withdrawer))
                                : (masterWallet.getSigner(record.key.withdrawer) ? green(record.key.withdrawer) : magenta(record.key.withdrawer))
                            )
                    );
                    const nonce = (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
                        ? record.value.nonce 
                        : gray(record.value.nonce || "")
                    );
                    return [
                        index + 1,
                        withdrawer,
                        nonce, 
                        ...(verbose
                            ? [ record.value.epochs.witnessing || "", record.value.epochs.mining || "" ]
                            : [ ]
                        ),
                        yellow(helpers.fromNanowits(record.value.coins)),
                    ]
                }), {
                    headlines: [
                        "RANK",
                        "STAKE WITHDRAWERS",
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
            );
            console.info(`^ Total stake: ${myellow(whole_wits(staked, 2))}`)
            
        } else {
            console.info(`> Holds no delegated stake.`)
            return
        }
    }
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
    const wallet = await _loadWallet({ unlocked: true, limit: 1, ...flags })
    wallet.provider.endpoints.forEach(url => {
        console.info(helpers.colors.magenta(url))
    })
}

async function resolve(flags = {}, [pattern, ...args], options = {}) {
    const wallet = await _loadWallet({ ...flags })
    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--from address not found in wallet."
    }
    const request = await _loadRadonRequest(args, { legacy: options?.legacy, pattern })
    await helpers.traceTransaction(
        Witnet.DataRequests.from(account, request), {
            headline: `DATA REQUEST TRANSACTION`, color: bgreen, 
            ...await _loadTransactionParams(flags, options),
        }
    )
}

async function stake(flags = {}, [authorization], options = {}) {
    
    if (!authorization) {
        throw "No authorization code was provided."
    } else if (!options?.value) {
        throw "No --value was specified."
    }

    const wallet = await _loadWallet({ ...flags, "no-funds": options?.from !== undefined })
    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--from address not found in wallet."
    }

    const { force, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    const fees = options?.fees ? utils.fromWits(options.fees) : undefined 
    if (fees === undefined && options.value.toLowerCase() === 'all') {
        throw "--fees must be specified if value is `all`."
    }
    const value = (options.value.toLowerCase() === 'all'
        ? Witnet.Value.fromPedros((await account.getBalance()).unlocked - fees)
        : Witnet.Value.fromWits(options.value)
    )
    await helpers.traceTransaction(
        Witnet.StakeDeposits.from(account), {
            confirmations, force, headline: `STAKE DEPOSIT TRANSACTION`, verbose, color: bcyan, 
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
    
    const wallet = await _loadWallet({ unlocked: true, limit: 1, ...flags })
    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--from address not found in wallet."
    }

    const { dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
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
    const wallet = await _loadWallet({ ...flags })
    const account = (
        options?.from 
            ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from))
            : wallet.accounts[0]
    );
    if (!account) {
        throw "--into address not found in wallet."
    }

    const { dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
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
    
    const wallet = await _loadWallet({ ...flags })

    // determine from account
    const account = (
        from
            ? (from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(from))
            : ((await wallet.coinbase.getBalance()).unlocked > 0 ? wallet.coinbase : wallet.accounts[0])
    )
    if (!account)  {
        throw `Address ${from} doesn't belong to the wallet.`
    }

    const accountBalance = await account.getBalance()
    const coinbaseBalance = await wallet.coinbase.getBalance()
    const walletBalance = await wallet.getBalance()

    // determine into address
    let into = options?.into
    if (into) {
        if (into !== from && !wallet.getAccount(into) && into !== wallet.coinbase.pkh) {
            const prompt = inquirer.createPromptModule()
            const user = await prompt([{ 
                message: `Into-account ${into} doesn't belong to the wallet. Proceed anyway?`, 
                name: "continue", 
                type: "input", 
            }])
            if (!user.continue.toLowerCase().startsWith("y")) {
                throw `Into-account ${into} not found in wallet.`
            }
        }
    } else {
        into = account.pkh
    }

    // extract CLI flags
    const { dryrun, verbose } = flags
    const confirmations = flags?.confirmations ? parseInt(flags.confirmations) : (flags?.await ? 0 : (options?.join && options?.split ? 0 : undefined))
    const fees = utils.fromWits(options?.fees || 0.000001) // 1 microWit as default fee

    // extract target value, if any, from CLI
    let targetValue = 0
    let totalUnlocked = from ? accountBalance.unlocked : walletBalance.unlocked + coinbaseBalance.unlocked
    if (options?.value) {
        if (options.value.toLowerCase() === 'all') {
            targetValue = totalUnlocked - fees
        
        } else {
            targetValue = helpers.fromWits(parseFloat(options.value))
        }
    }

    // select utxos of either the from account (if specified) or from all funded accounts in the wallet (including the coinbase)
    const utxos = await helpers.prompter(from ? account.selectUtxos({ value: targetValue }) : wallet.selectUtxos({ value: targetValue }))
    
    // verify that selected utxos actually cover the target value (if specified):
    let coveredValue = 0
    if (targetValue > 0) {
        let targetIndex = 0
        for (; targetIndex < utxos.length && coveredValue < targetValue + fees; targetIndex ++) {
            coveredValue += utxos[targetIndex].value
        }
        if (coveredValue < targetValue + fees) {
            throw `Not enough unlocked UTXOs on ${from ? `account ${account.pkh}` : `wallet ${wallet.pkh}`}: ${whole_wits(coveredValue)} < ${whole_wits(targetValue + fees)}.`
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
                    utxo.signer === wallet.coinbase.pkh ? mcyan(utxo.signer) : mmagenta(utxo.signer),
                    utxo?.internal ? green(utxo.output_pointer) : mgreen(utxo.output_pointer),
                    utxo.value
                ]), {
                    headlines: [ "INDEX", "WALLET ADDRESS", ":Unlocked UTXO pointers", "Value ($nanoWIT)", ],
                    humanizers: [ helpers.commas,,, helpers.commas ],
                    colors: [ ,,, myellow, ]
                }
            )
        }

        const valueTransfer = from ? Witnet.ValueTransfers.from(account) : Witnet.ValueTransfers.from(wallet)
        
        if (options?.join) {
            if (!options?.value) {
                throw `--value must be specified for a JOIN operation.`
            }
            const recipients = [[ 
                // if a split is expected, join utxos into default `account`, so they can then be reused afterwards
                options?.split ? account.pkh : into, 
                targetValue 
            ]]
            await helpers.traceTransaction(valueTransfer, { 
                confirmations, dryrun, verbose, 
                headline: `JOINING UTXOs: ${utxos.length} -> ${targetValue < coveredValue ? 2 : 1}` ,
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
            recipients.push(...Array(splits).fill([ into, splitBalance ])) 
            await helpers.traceTransaction(
                valueTransfer, {
                    confirmations, dryrun, verbose, 
                    headline: `SPLITTING UTXOs: ${utxos.length} -> ${splitBalance * splits < coveredValue ? splits + 1 : splits}`,
                    fees, recipients, 
                    reload: options?.join,
            })
        }

    } else {
        console.info(`> No available UTXOs at the moment.`)
    }
}

async function validators(flags = {}, []) {
    
    const { verbose } = flags
    const wallet = await _loadWallet({ ...flags })
    const order = { by: Witnet.StakesOrderBy.Coins, reverse: true }

    const coinbaseBalance = await wallet.coinbase.getBalance()
    const coinbase = coinbaseBalance.staked > 0

    const records = await wallet.getDelegatees(order, true)
    if (records.length > 0) {
        let staked = 0
        helpers.traceTable(
            records.map(record => {
                staked += record.value.coins
                return [
                    record.key.withdrawer === wallet.coinbase.pkh
                        ? mred(record.key.withdrawer)
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
                    "STAKE DELEGATEES",
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
        console.info(`^ Total deposit: ${myellow(whole_wits(staked, 2))}`)
        
    } else {
        console.info(`> No delegatees found.`)
    }
}


/// ===================================================================================================================
/// --- Internal functions --------------------------------------------------------------------------------------------

async function _loadRadonRequest(args = [], options = {}) {    
  
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
        const user = await inquirer.createPromptModule()([{
            choices: assets.map(([key,]) => key),
            message: "Please, select a Radon asset:", 
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

async function _loadTransactionParams(flags = {}, options = {}) {
    const confirmations = flags?.confirmations ? parseInt(flags?.confirmations) : (flags?.await ? 0 : undefined)
    let fees = options?.fees ? Witnet.Value.fromWits(options.fees) : undefined 
    if (fees === undefined) {
        if (options?.value?.toLowerCase() === 'all') {
            throw "--fees must be specified if value is `all`."
        }
        let priority = (flags?.priority 
            ? Witnet.TransactionPriority[flags.priority.charAt(0).toUpperCase() + flags.priority.slice(1)] 
            : undefined
        );
        if (!priority) {
            const priorities = {
                "< 60 seconds": Witnet.TransactionPriority.Opulent,
                "< 5 minutes": Witnet.TransactionPriority.High,
                "< 15 minutes": Witnet.TransactionPriority.Medium,
                "< 1 hour": Witnet.TransactionPriority.Low,
                "< 6 hours": Witnet.TransactionPriority.Stingy
            }
            const user = await inquirer.createPromptModule()([{ 
                choices: Object.keys(priorities),
                message: "Please, select time to block expectancy:", 
                name: "priority", 
                type: "list", 
            }]);
            priority = user.priority
        }
        fees = Witnet.TransactionPriority[priority]
    }
    const witnesses = flags?.witnesses ? parseInt(flags?.witnesses) : 3
    return {
        confirmations,
        fees,
        force: flags?.force,
        verbose: flags?.verbose, 
        witnesses,
    }
}

async function _loadWallet(flags = {}) {
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
        const strategy = strategies[flags?.strategy || 'slim-fit'] || Witnet.UtxoSelectionStrategy.SlimFit
        const gap = flags['gap'] || 10
        let wallet, xprv = flags?.xprv || process.env.WITNET_SDK_WALLET_MASTER_KEY
        if (xprv.length === 293) {
            const prompt = inquirer.createPromptModule()
            const user = await prompt([{ type: "password", mask: "*", message: "Enter password:", name: "passwd"}])
            wallet = Witnet.Wallet.fromEncryptedXprv(xprv, user.passwd, {
                gap, provider, strategy,
                limit: flags?.limit,
                onlyWithFunds: !flags['no-funds'],
            })
        } else {
            wallet = Witnet.Wallet.fromXprv(xprv, {
                gap, provider, strategy, 
                limit: flags?.limit,
                onlyWithFunds: !flags?.limit, 
            })
        }
        
        return flags?.limit ? await wallet : await helpers.prompter(wallet)
    }
}
