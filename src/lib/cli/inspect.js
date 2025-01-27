const helpers = require("../helpers")
const toolkit = require("../../../dist");

const FLAGS_DEFAULT_LIMIT = 100

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
                    param: "EPOCH"
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
    },
    subcommands: {
        balance, block, dataRequest, superblock, transaction, validators, withdrawers,
    },
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function balance(flags = {}, args) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const balance = await provider.getBalance(args[0])
    console.info(balance)
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

async function validators(flags = {}, args) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const validators = await provider.getStakeValidators(args[0])
    console.info(validators)
}

async function withdrawers(flags = {}, args) {
    if (args.length === 0) {
        throw "No WIT_ADDRESS was specified."
    }
    const provider = new toolkit.Provider(flags?.provider)
    const withdrawers = provider.getStakeWithdrawers(args[0])
    console.info(withdrawers)
}