const helpers = require("../helpers")
const toolkit = require("../../../dist");

const FLAGS_DEFAULT_LIMIT = 100

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    flags: {
        limit: { 
            hint: "Limit output records (default: 100)", 
            param: ":number", 
        },
        provider: {
            hint: "Public Wit/Oracle JSON-RPC provider, other than default",
            param: ":http-url",
        },
    },
    router: {
        blocks: {
            hint: "List block hashes within given epoch range.",
            options: {
                from: { hint: "Range start epoch (default: -1)", param: ":epoch | :relative", }, 
            },
        },
        constants: {
            hint: "Show network consensus constants.",
        },
        holders: {
            hint: "List addresses with available Wits to spend.",
            options: {},
        },
        mempool: {
            hint: "Dump current transactions mempool.",
            options: {},
        },
        powers: {
            hint: "Rank validators by their current staking power for given capability.",
            params: "mining | witnessing",
        },
        priorities: {
            hint: "Estimate transacting priorities based on recent network activity.",
            params: "vtt | drt",
            options: {
                weight: { hint: "Estimate fees instead for given transaction weight", },
            },
        },
        protocol: {
            hint: "Known protocol versions and which one is currently enforced.",   
        },
        stakers: {
            hint: "List active stake entries at present time.",
        },
        status: {
            hint: "Report RPC provider's network sync status.",
        },
        supply: {
            hint: "Get current unlocked and maximum Wit supply of the network.",
        },
        wips: {
            hint: "Show signaled and currently activated WIPs on the network.",
        },
    },
    subcommands: {
        blocks, constants, protocol, wips, status, mempool, priorities,
        holders, powers, stakers, supply,
    },
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function holders(flags) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_DEFAULT_LIMIT
    provider = new toolkit.Provider(flags?.provider)
    
    var records = Object.entries(await helpers.prompter(provider.balances()))
    console.info(`> Showing ${flags.limit} out of ${records.length} records:`)
    var records = 
    helpers.traceTable(
        records.slice(0, flags.limit).map(([ address, balance ], index) => [ 
            index + 1,
             address, 
             balance / 10 ** 9
        ]), {
        headlines: [ "RANK", "HOLDERS", "BALANCE (Wits)", ],
        humanizers: [ ,, (x) => helpers.commas(Math.floor(x)), ],
        colors: [ , helpers.colors.lgreen, helpers.colors.lyellow, ]
    })
}

async function blocks(flags, options) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_DEFAULT_LIMIT
    var provider = new toolkit.Provider(flags?.provider)
    // var records = await helpers.prompter(provider.blocks(options?.from || - flags.limit, flags.limit))
    var records = await provider.blocks(options?.from || - flags.limit, flags.limit)
    helpers.traceTable(
        records.map(record => [
            record[0],
            record[1],
        ]), {
        headlines: [ "EPOCH", "BLOCK HASHES", ], 
        colors: [, helpers.colors.cyan, ]
    })
}

async function constants(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.constants())
}

async function protocol(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(JSON.stringify(await provider.protocol(), null, 2))
}

async function wips(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.wips())
}

async function status(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.syncStatus())
}

async function mempool(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.mempool())
}

async function priorities(flags) {
    var provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.priorities())
}

async function powers(flags, args) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_DEFAULT_LIMIT
    if (args && args[0] && Object.values(toolkit.StakingCapability)?.includes(args[0])) {
        var provider = new toolkit.Provider(flags?.provider)
        // var records = await helpers.prompter(provider.ranks(args[0].toLowerCase()))
        var records = await provider.ranks(args[0].toLowerCase())
        helpers.traceTable(
            records.map(record => [ 
                record.rank, 
                record.validator, 
                record.power ,
                record.withdrawer, 
            ]),
            {
                headlines: [ "RANK", "VALIDATORS", `${args[0].toUpperCase()[0]}_POWER (aged)`, "Staker", ],
                colors: [, helpers.colors.lgreen, helpers.colors.yellow,, ],
                humanizers: [,, helpers.commas,, ],
            },
        )
    } else {
        throw `Only possible values: "mining" | "witnessing"`
    }
}

async function stakers(flags) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_DEFAULT_LIMIT
    var provider = new toolkit.Provider(flags?.provider)
    // var records = await helpers.prompter(provider.stakers())
    var records = await provider.stakers()
    helpers.traceTable(
        records.map((record, index) => [ 
            index + 1,
            record.key.withdrawer, 
            record.value.coins / 10 ** 9,
            record.key.validator, 
            record.value.nonce, 
            record.value.epochs.mining,
            record.value.epochs.witnessing,
        ]),
        {
            headlines: [ 
                "RANK", "STAKERS", "STAKE (Wits)", "Delegate", "Nonce",  "LM_Epoch", "LW_Epoch",
            ],
            humanizers: [
                ,, (x) => helpers.commas(Math.floor(parseFloat(x))),, helpers.commas, helpers.commas, helpers.commas, 
            ],
            colors: [
                , helpers.colors.lgreen, helpers.colors.lyellow,,, helpers.colors.lgray, helpers.colors.cyan, 
            ],
        },
    )
}

async function supply(flags) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_DEFAULT_LIMIT
    var reporter = new toolkit.Reporter(flags?.provider)
    var data = await reporter.supplyInfo()
    helpers.traceTable(
        [
            // [ "Current time", data.current_time ],
            [ "Current epoch", helpers.commas(data.epoch) ],
            [ "Minted blocks", helpers.commas(data.blocks_minted) ],
            [ "Block rewards", helpers.commas(Math.floor(data.blocks_minted_reward / 10 ** 15)) + " MWits" ],
            [ "Unlocked supply", helpers.commas(Math.floor(data.current_unlocked_supply / 10 ** 15)) + " MWits" ],
            [ "Maximum supply", helpers.commas(Math.floor(data.maximum_supply / 10 ** 15)) + " MWits" ],
        ], {
            headlines: [ ":KEY", "VALUE", ],
            colors: [helpers.colors.white, helpers.colors.lyellow, ]
        }
    )
}