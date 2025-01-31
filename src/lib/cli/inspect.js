const moment = require("moment")
const helpers = require("../helpers")
const toolkit = require("../../../dist");

const FLAGS_LIMIT_DEFAULT = 100

const { cyan, gray, green, lyellow, magenta, mcyan, mgreen, mmagenta, myellow, yellow, white,} = helpers.colors;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    envars: {
        WITNET_TOOLKIT_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified."
    },
    flags: {
        provider: {
            hint: "Public Wit/Oracle JSON-RPC provider, other than default",
            param: ":http-url",
        },
        verbose: {
            hint: "Outputs detailed information"
        },
    },
    router: {
        balance: {
            hint: "Show available Wits on given address.",
            params: "WIT_ADDRESS",
            options: {},
        },
        block: {
            hint: "Get block data given its block hash.",
            params: "BLOCK_HASH",
            options: {},
        },
        dataRequest: {
            hint: "Report resolution workflow for the specified data request transaction.",
            params: "DR_TX_HASH",
            options: {},
        },
        "dataRequests*": {
            hint: "Search for in-flight or recently solved data request transactions.",
            params: "BYTECODE | RAD_HASH | DDR_HASH",
            options: {
                limit: { hint: "Limit output records (default: 100)", param: "LIMIT", },
                since: {
                    hint: "Number of past epochs to search for (default: 256; max: 2048)",
                    param: "EPOCH|MINUS_EPOCHS"
                },
                "min-unitary-reward": {
                    hint: "Filters out those providing less unitary reward than specified",
                    param: "NANOWITS"
                },
                "min-witnesses": { 
                    hint: "Filters out those solved with less than specified witnesses",
                    param: "NUM_WITNESSES"
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
        withdrawers: {
            hint: "List withdrawers currently delegating stake to the specified address.",
            params: "WIT_ADDRESS",
        },
        utxos: {
            hint: "List UTXOs available to the specified address.",
            params: "WIT_ADDRESS",
            options: {
                "smallest-first": {
                    hint: "Outputs smallest UTXOs first (default: false)",
                },
            }
        }
    },
    subcommands: {
        balance, block, dataRequest, superblock, transaction, validators, withdrawers, utxos,
    },
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function balance(flags = {}, args) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const pkh = args[0]
    const provider = new toolkit.Provider(flags?.provider)
    const balance = await provider.getBalance(pkh)
    const records = []
    records.push([ 
        Math.floor(balance.locked / 10 ** 9), 
        Math.floor(balance.staked / 10 ** 9), 
        Math.floor(balance.unlocked / 10 ** 9),
        Math.floor((balance.locked + balance.staked + balance.unlocked) / 10 ** 9)
    ])
    helpers.traceTable(records, {
        headlines: [ "Locked (Wits)", "Staked (Wits)", "Unlocked (Wits", "BALANCE (Wits)" ],
        humanizers: [ helpers.commas, helpers.commas, helpers.commas, helpers.commas ],
        colors: [ gray, yellow, myellow, lyellow ],
    })
}

async function block(flags = {}, args) {
    if (args.length === 0) {
        throw "No BLOCK_HASH was specified."
    }
    const blockHash = args[0].startsWith('0x') ? args[0].slice(2) : args[0]
    if (!helpers.isHexString(blockHash)) {
        throw "Invalid BLOCK_HASH was provided."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const block = await provider.getBlock(blockHash)
    console.info(block)
}

async function dataRequest(flags = {}, args) {
    if (args.length === 0) {
        throw "No DR_TX_HASH was specified."
    }
    const drTxHash = args[0].startsWith('0x') ? args[0].slice(2) : args[0]
    if (!helpers.isHexString(drTxHash)) {
        throw "Invalid DR_TX_HASH was provided."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const transaction = await provider.getTransaction(drTxHash)
    console.info(transaction)
    const report = await provider.getDataRequest(drTxHash)
    console.info(report)
}

async function superblock(flags = {}, args) {
    if (args.length === 0) {
        throw "No EPOCH was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const superblock = await provider.getSuperblock(args[0])
    console.info(superblock)
}

async function transaction(flags = {}, args) {
    if (args.length === 0) {
        throw "No TX_HASH was specified."
    }
    const txHash = args[0].startsWith('0x') ? args[0].slice(2) : args[0]
    if (!helpers.isHexString(txHash)) {
        throw "Invalid TX_HASH was provided."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const transaction = await provider.getTransaction(txHash)
    console.info(transaction)
}

async function utxos(flags = {}, args = [], options = {}) {
    const now = Math.floor(Date.now() / 1000)
    const provider = new toolkit.Provider(flags?.provider)
    let utxos = await provider.getUtxoInfo(args[0], options["smallest-first"] || false)
    const totalUtxos = utxos.length
    let totalBalance = 0
    if (!flags?.verbose) {
        utxos = utxos
            .filter(utxo => utxo.timelock <= now)
            .map(utxo => { 
                totalBalance += utxo.value
                return [
                    utxo.output_pointer,
                    utxo.value,
                ]
            });
        helpers.traceTable(utxos, {
            headlines: [ "UTXOs", "Value (Nanowits)", ],
            humanizers: [ , helpers.commas ],
            colors: [ , myellow, ]
        })
    } else {
        utxos = utxos
            .map(utxo => {
                totalBalance += utxo.value
                return [
                    utxo.output_pointer,
                    utxo.timelock > now ? gray(helpers.commas(utxo.value)) : myellow(helpers.commas(utxo.value)),
                    utxo.timelock > now ? gray(moment.unix(now - utxo.timelock).toNow(true)) : ""
                ]
            });
        helpers.traceTable(utxos, {
            headlines: [ "UTXOs", "Value (Nanowits)", "Time lock", ],
        })
    }
    console.info(`^ Listed ${utxos.length} out of ${totalUtxos} UTXOs: ${lyellow(helpers.whole_wits(totalBalance, 2))}`)
}

async function validators(flags = {}, args = []) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const query = {
        filter: { withdrawer: args[0] },
    }
    const records = await provider.stakes(query)
    let nanowits = 0
    if (records.length > 0) {
        helpers.traceTable(
            records.map((record, index) => {
                nanowits += record.value.coins
                return [
                    1 + index,
                    record.key.validator,
                    ...(
                        flags?.verbose
                            ? [ record.value.nonce, record.value.epochs.witnessing, record.value.epochs. mining ]
                            : []
                    ),
                    helpers.fromNanowits(record.value.coins),
                ]
            }), {
                headlines: [
                    "RANK",
                    "VALIDATORS",
                    ...(
                        flags?.verbose
                            ? [ "Nonce", "LW_Epoch", "LM_Epoch", ]
                            : []
                    ),
                    "STAKED (Wits)"
                ],
                humanizers: [
                    ,, ...(
                        flags?.verbose
                            ? [ helpers.commas, helpers.commas, helpers.commas ]
                            : []
                    ),
                    helpers.commas,
                ],
                colors: [ , green, ...(
                    flags?.verbose
                        ? [ , magenta, cyan, myellow, ]
                        : [ myellow, ]
                )],
            }
        )
        console.info(
            `^ ${records.length} validators for withdrawer ${
                mgreen(args[0])
            }: ${
                lyellow(helpers.whole_wits(nanowits, 2))
            }`
        )
    } else {
        console.info(`> No validators found for withdrawer ${mmagenta(args[0])}.`)        
    }
}

async function withdrawers(flags = {}, args) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const query = {
        filter: { validator: args[0] },
    }
    const records = await provider.stakes(query)
    let nanowits = 0
    if (records.length > 0) {
        helpers.traceTable(
            records.map((record, index) => {
                nanowits += record.value.coins
                return [
                    1 + index,
                    record.key.withdrawer,
                    ...(
                        flags?.verbose
                            ? [ record.value.nonce, record.value.epochs.witnessing, record.value.epochs. mining ]
                            : []
                    ),
                    helpers.fromNanowits(record.value.coins),
                ]
            }), {
                headlines: [
                    "RANK",
                    "WITHDRAWERS",
                    ...(
                        flags?.verbose
                            ? [ "Nonce", "LW_Epoch", "LM_Epoch", ]
                            : []
                    ),
                    "STAKED (Wits)"
                ],
                humanizers: [
                    ,, ...(
                        flags?.verbose
                            ? [ helpers.commas, helpers.commas, helpers.commas ]
                            : []
                    ),
                    helpers.commas,
                ],
                colors: [ , green, ...(
                    flags?.verbose
                        ? [ , magenta, cyan, myellow, ]
                        : [ myellow, ]
                )],
            }
        )
        console.info(
            `^ ${records.length} withdrawers for validator ${
                mgreen(args[0])
            }: ${
                lyellow(helpers.whole_wits(nanowits, 2))
            }`
        )
    } else {
        console.info(`> No withdrawers found for validator ${mmagenta(args[0])}.`)        
    }
}
