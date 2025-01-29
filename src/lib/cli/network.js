const helpers = require("../helpers")
const toolkit = require("../../../dist");

const FLAGS_LIMIT_MAX = 2048
const FLAGS_LIMIT_DEFAULT = 32
const OPTIONS_DEFAULT_SINCE = -2048

const { white, gray, lyellow, mgreen, myellow, yellow, } = helpers.colors;

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    envars: {
        WITNET_TOOLKIT_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified."
    },
    flags: {
        limit: { 
            hint: `Limits number of output records (default: ${FLAGS_LIMIT_DEFAULT})`, 
            param: "LIMIT", 
        },
        provider: {
            hint: "Public Wit/Oracle JSON-RPC provider, other than default",
            param: "PROVIDER_URL",
        },
        verbose: {
            hint: "Outputs detailed information"
        },
    },
    router: {
        blocks: {
            hint: "List recently validated blocks.",
            options: {
                since: {
                    hint: "Since the specified epoch (default: -<LIMIT>-2)",
                    param: "EPOCH|MINUS_EPOCHS",
                },
            },
        },
        constants: {
            hint: "Show network consensus constants.",
        },
        // "dataProviders*": {
        //     hint: "List data providers queried at least once by data requests during last <RANGE> epochs.",
        //     params: "[RANGE]",
        // },
        fees: {
            hint: "Estimate transaction fees based on recent network activity.",
            params: '"vtt" | "drt" | "st" | "ut"',
            options: {
                eti: {
                    hint: "Expected time before inclusion (default: 60 seconds)",
                    param: "ETI_SECONDS",
                },
                weight: { 
                    hint: "Assuming this transaction weight (default: 1)", 
                    param: "TX_WEIGHT",
                },
            },
        },
        holders: {
            hint: "List identities holding Wits within the specified range.",
            options: { 
                "min-balance": { 
                    hint: "Having at least this amount of unlocked Wits (default: 1 Wit)",
                    param: "WITS",
                },
                "max-balance": {
                    hint: "Having at most this amount of unlocked Wits",
                    param: "WITS",
                },
            },
        },
        knownPeers: {
            hint: "Get a full list of peers as known by the Wit/Oracle RPC provider(s)",
        },
        mempool: {
            hint: "Dump current transactions mempool.",
            params: '["vtt" | "drt" | "st" | "ut"]',
            options: {
                count: { hint: "Just count the number of entries (ignoring limit)" },
                offset: {
                    hint: "Skips first matching entries (default: 0)",
                    param: "OFFSET",
                },
            },
        },
        provider: {
            hint: "Show the underlying Wit/Oracle RPC provider being used."
        },
        senate: {
            hint: "List distinct identities that have lately validated at least one block.",
            options: {
                count: { hint: "Just count the number of entries (ignoring limit)" },
                since: {
                    hint: "At or after the specified epoch (default: -2048)",
                    param: "EPOCH|MINUS_EPOCHS",
                },
            },
        },
        stakers: {
            hint: "List active stake entries at present time.",
            options: {
                count: { hint: "Just count the number of entries (ignoring limit)" },
                offset: {
                    hint: "Skips first matching entries (default: 0)",
                    param: "OFFSET",
                },
                validator: { hint: "Filter by validator address", param: "WIT_ADDRESS", },
                withdrawer: { hint: "Filter by withdrawer address", param: "WIT_ADDRESS", },
            },
        },
        "stats*": {
            hint: "Report network stats.",
        },
        supplyInfo: {
            hint: "Get network's Wit supply information.",
        },
        syncStatus: {
            hint: "Report the sync status of the network's Wit/Oracle RPC provider being used.",
        },
        validators: {
            hint: "List network validators ordered by their current mining power.",
            options: {
                distinct: { hint: "Include only first appearance per validator", },
                witnessing: { hint: "Order by witnessing power instead", },
            },
        },
        versions: {
            hint: "Known protocol versions and which one is currently live.",   
        },
        wips: {
            hint: "Show currently activated WIPs on the network.",
            options: {
                pending: { hint: "Only shows pending upgrades, if any", },
            },
        },
    },
    subcommands: {
        blocks, constants, holders, knownPeers,
        mempool, fees: priorities, provider,
        senate, stakers, supplyInfo, syncStatus, 
        validators, versions, wips,
    },
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function blocks(flags = {}, _args = [], options = {}) {
    flags.limit = helpers.min(parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX)
    console.log(flags)
    const provider = new toolkit.Provider(flags?.provider)
    // const records = await helpers.prompter(provider.blocks(options?.from || - flags.limit, flags.limit))
    const records = await provider.blocks(parseInt(options?.since) || - flags.limit - 2, flags.limit)
    if (records.length > 0) {
        helpers.traceTable(
            records.slice(0, flags.limit).map(record => [
                record[0],
                record[1],
            ]), {
            headlines: [ "EPOCH", "BLOCK HASHES", ], 
            humanizers: [ helpers.commas, ],
            colors: [, helpers.colors.gray, ]
        })
        console.info(`^ Listed ${records.length} blocks for a range of ${flags.limit} epochs.`)
        
    } else {
        console.info(
            `> No blocks found in specified range (since: ${
                options?.since || - flags.limit
            }, limit: ${
                flags.limit
            }).`
        )
    }
}

async function constants(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.constants())
}

async function holders(flags = {}, _args = [], options = {}) {
    flags.limit = helpers.min(parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX);
    const provider = new toolkit.Provider(flags?.provider)
    let records = Object.entries(await helpers.prompter(provider.holders(
        options["min-balance"] ? options["min-balance"] * 10 ** 9 : 1000000,
        options["max-balance"] ? options["max-balance"] * 10 ** 9 : null,
    )))
    const totalRecords = records.length
    helpers.traceTable(
        records.slice(0, flags.limit).map(([ address, balance ], index) => [ 
            index + 1,
            address, 
            Math.floor(balance.locked / 10 ** 9),
            Math.floor(balance.staked / 10 ** 9),
            Math.floor(balance.unlocked / 10 ** 9),
            Math.floor((balance.locked + balance.staked + balance.unlocked) / 10 ** 9),
        ]), {
            headlines: [ "RANK", "HOLDERS", "Locked (Wits)", "Staked (Wits)", "Unlocked (Wits)", "BALANCE (Wits)", ],
            humanizers: [ ,, helpers.commas, helpers.commas, helpers.commas, helpers.commas ],
            colors: [ , mgreen, gray, yellow, myellow, lyellow, ],
        }
    )
    if (flags.limit < totalRecords) {
        console.info(`^ Listed ${helpers.min(flags.limit, totalRecords)} out of ${totalRecords} records.`)
    }
}

async function knownPeers(flags = {}) {
    if (!flags) flags = {}
    flags.limit = parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT
    const provider = new toolkit.Provider(flags?.provider)
    const knownPeers = await provider.knownPeers()
    console.info(knownPeers)
}

async function mempool(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.mempool())
}

async function priorities(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    console.info(await provider.priorities())
}

function provider(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    provider.endpoints.forEach(url => {
        console.info(helpers.colors.yellow(url))
    })
}

async function senate(flags = {}, _args = [], options = {}) {
    flags.limit = parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT
    options.since = parseInt(options?.since) || OPTIONS_DEFAULT_SINCE

}

async function stakers(flags = {}, _args = [], options = {}) {
    flags.limit = helpers.min(parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX)
    const provider = new toolkit.Provider(flags?.provider)
    // const records = await helpers.prompter(provider.stakers())
    const records = await provider.stakers(options?.validator, options?.withdrawer)
    helpers.traceTable(
        records.map((record, index) => [ 
            index + 1,
            record.key.withdrawer, 
            record.value.coins / 10 ** 9,
            record.key.validator, 
            ...(
                options?.verbose 
                    ? [ record.value.nonce, record.value.epochs.mining, record.value.epochs.witnessing, ]
                    : []
            )
        ]),
        {
            headlines: [ 
                "RANK", "STAKERS", "Validator", "STAKE (Wits)", ...(
                    options?.verbose 
                        ? [ "Nonce",  "LM_Epoch", "LW_Epoch", ]
                        : []
                ),
            ],
            humanizers: [
                ,,, (x) => helpers.commas(Math.floor(parseFloat(x))), ...(
                    options?.verbose
                        ? [ helpers.commas, helpers.commas, helpers.commas, ]
                        : []
                ),
            ],
            colors: [
                , helpers.colors.mgreen,, helpers.colors.myellow, ...(
                    options?.verbose
                        ? [ , helpers.colors.mcyan, helpers.colors.mmagenta, ]
                        : []
                ),
            ],
        },
    )
}

async function supplyInfo(flags = {}) {
    const reporter = new toolkit.Reporter(flags?.provider)
    const data = await reporter.supplyInfo()
    console.info(`> Supply info at epoch ${helpers.colors.white(helpers.commas(data.epoch))}:`)
    const records = []
    records.push([ "Minted blocks", helpers.toFixedTrunc(100 * data.blocks_minted / data.epoch, 1) + " %" ])
    records.push([ "Minted rewards", helpers.whole_wits(data.blocks_minted_reward, 2) ])
    if (data.burnt_supply) {
        records.push([ "Burnt supply", helpers.whole_wits(data.burnt_supply, 2) ])
    };
    if (data.current_locked_supply) {
        records.push([ "Locked supply", helpers.whole_wits(data.current_locked_supply, 2) ])
    }
    if (data.current_staked_supply) {
        records.push([ "Staked supply", helpers.whole_wits(data.current_staked_supply, 2) ])
    }
    records.push([ "Circulating supply", helpers.whole_wits(data.current_unlocked_supply, 2) ])
    helpers.traceTable(records, {
        headlines: [ ":KPI", "VALUE", ],
        colors: [helpers.colors.mgreen, helpers.colors.myellow, ],
        // indent: "  ",
    })
}

async function syncStatus(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    const syncStatus = await provider.syncStatus()
    helpers.traceTable(
        [[
            syncStatus.node_state || '',
            syncStatus.current_epoch,
            syncStatus.chain_beacon.checkpoint,
            syncStatus.chain_beacon.hashPrevBlock,
        ]], {
            headlines: [
                ":STATUS",
                "Current epoch", 
                "Checkpoint epoch",
                "Checkpoint block hash",
            ],
            humanizers: [ , helpers.commas, helpers.commas, ],
            colors: [ helpers.colors.mgreen, helpers.colors.white,, helpers.colors.gray, ]
        },
    )
}

async function validators(flags = {}, args =  [], options = {}) {
    flags.limit = parseInt(flags?.limit) || FLAGS_LIMIT_DEFAULT
    const provider = new toolkit.Provider(flags?.provider)
    const capability = options?.witnessing ? toolkit.StakingCapability.Witnessing : toolkit.StakingCapability.Mining
    let records = await provider.powers(capability)
    // TODO: implement distinct filter on rpc server side ...
    if (options?.distinct) {
        const validators = []
        records = records.filter(entry => {
            if (!validators.includes(entry.validator)) {
                validators.push(entry.validator)
                return true
            } else {
                return false
            }
        })
    }
    helpers.traceTable(
        records.slice(flags.limit).map(record => [ 
            record.rank, 
            record.validator, 
            record.withdrawer, 
            record.power,
        ]),
        {
            headlines: [ "G_RANK", "VALIDATORS", "Withdrawers", `${args[0].toUpperCase()[0] + args[0].slice(1)} power`, ],
            colors: [, helpers.colors.mgreen, helpers.colors.green, args[0] === "mining" ? helpers.colors.mcyan : helpers.colors.mmagenta, ],
            humanizers: [,,, helpers.commas, ],
        },  
    )
}

async function versions(flags = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    const protocolInfo = await provider.protocolInfo()
    if (
        protocolInfo?.all_checkpoints_periods
        && protocolInfo?.all_versions?.efv 
        && Object.keys(protocolInfo.all_versions.efv).length > 0
    ) {
        const records = Object.fromEntries(
            Object.entries(protocolInfo.all_checkpoints_periods)
                .sort(([a,], [b, ]) => { if (a < b) return 1; else if (b > a) return -1; else return 0 })
                .map(([version, period]) => [ version, { period }])
        )
        Object.entries(protocolInfo.all_versions.efv).map(([key, epoch]) => {
            if (records[key]) records[key].epoch = epoch
        })
        helpers.traceTable(Object.entries(records).map(([key, props]) => [ key, props?.epoch, props?.period, ]), {
            headlines: [
                ":Version",
                "Activation epoch",
                ":Block time (secs)",
            ],
            humanizers: [, helpers.commas, ],
            colors: [ helpers.colors.mgreen, helpers.colors.white, helpers.colors.normal, ],
        })
    }
    console.info(`> Current protocol version is ${helpers.colors.mgreen(protocolInfo.current_version)}.`)
}


async function wips(flags = {}, _args = [], options = {}) {
    const provider = new toolkit.Provider(flags?.provider)
    const wips = await provider.wips()
    if (!options?.pending) {
        // console.info(`> Active WIP upgrades at epoch ${helpers.colors.white(helpers.commas(wips.epoch))}:`)
        const active_upgrades = Object.entries(wips.active_upgrades).map(([ wip, epoch, ]) => [
            wip,
            epoch,
        ])
        helpers.traceTable(active_upgrades, {
            headlines: [":WIP", "Activation epoch", ],
            humanizers: [, helpers.commas, ],
            colors: [ helpers.colors.mcyan, helpers.colors.white, ],
        })
    }
    if (wips.pending_upgrades || options?.pending) {
        if (wips.pending_upgrades.length === 0) {
            console.info(`> No pending WIP upgrades at epoch ${helpers.colors.white(helpers.commas(wips.epoch))}.`)
        
        } else {
            console.info(`Pending WIP upgrades at epoch ${helpers.colors.white(helpers.commas(wips.epoch))}:`)
            const pending_upgrades = wips.pending_upgrades.map(upgrade => {
                return [
                    upgrade.wip,
                    upgrade.bit,
                    upgrade.init,
                    upgrade.votes,
                    upgrade.period,
                    // upgrade.end,
                ]
            })
            helpers.traceTable(pending_upgrades, {
                headlines: [
                    ":WIP",
                    "WIP_BIT",
                    "From epoch",
                    "Aye votes",
                    "Duration",
                    // "Deadline",
                ],
                humanizers: [,, helpers.commas, helpers.commas, helpers.commas, helpers.commas, ],
                colors: [ 
                    helpers.colors.lcyan, 
                    helpers.colors.mcyan,
                    helpers.colors.white,
                    helpers.colors.myellow,
                    helpers.colors.mgreen,
                    // helpers.colors.myellow,
                ],
            })
        }
    }
}
