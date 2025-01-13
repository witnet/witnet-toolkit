///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    flags: {},
    router: {
        balance: {
            hint: "Show available Wits on given address.",
            params: "ADDRESS",
            options: {},
        },
        block: {
            hint: "Get block data given its block hash.",
            params: "BLOCK_HASH",
            options: {},
        },
        epoch: {
            hint: "Get mined block at given epoch, if any.",
            params: "EPOCH",
            options: {},
        },
        dataRequest: {
            hint: "Report resolution workflow and final result for given data request.",
            params: "DR_TX_HASH",
            options: {},
        },
        dataRequests: {
            hint: "Search data request transactions by RAD hash.",
            params: "RAD_HASH",
            options: {},
        },
        transaction: {
            hint: "Report transaction details given its transaction hash.",
            params: "TX_HASH",
        },
        stake: {
            hint: "Show staked Wits by given address.",
            params: "ADDRESS",
        },
        status: {
            hint: "Report type and current status of given transaction.",
            params: "TX_HASH",
        },
        powers: {
            hint: "Report staking powers for given address and capability.",
            params: [ "ADDRESS", "mining | witnessing" ],
        },
        superblock: {
            hint: "Show superblock metadata for given epoch.",
            params: "EPOCH",
        },
        utxos: {
            hint: "List available UTXOs for given address.",
            params: "ADDRESS",
        },
    },
    subcommands: {},
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================


