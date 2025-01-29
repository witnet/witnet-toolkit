const qrcode = require('qrcode-terminal');

const helpers = require("../helpers")
const toolkit = require("../../../dist");

const { cyan, gray, green, red, yellow, white, mcyan, mgreen, mmagenta, mred, myellow, lcyan, lyellow, } = helpers.colors

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    envars: {
        WITNET_TOOLKIT_FARM_NODES: "=> URLs to your own nodes' HTTP/JSON private endpoints, if no otherwise specified."
    },
    flags: {
        nodes: {
            hint: "Private URLs to your node's HTTP/JSON endpoints, other than default",
            param: "JSON_HTTP_URL[;..]",
        },
    },
    router: {
        // addresses: {
        //     hint: "Show node farm addresses."
        // },
        authorize: {
            hint: "Generate stake authorization codes for given withdrawer.",
            params: "WITHDRAWER",
        },
        // balances: {
        //     hint: "Show available Wits on nodes.",
        // },
        masterKeys: {
            hint: "Export nodes' master keys.",
        },
        nodes: {
            hint: "List endpoints that connect to your nodes, addresses and available balances."
        },
        peers: {
            hint: "List and manage node farm's peers.",
            options: {
                add: {
                    hint: "Add new peer addresses for the nodes to try to connect to",
                    param: "P2P_IP:PORT[;..]",
                },
                "clear-buckets": {
                    hint: "Clear out all peering buckets",
                },
                reset: {
                    hint: "Clear all peers from the buckets and initialize to those in config",
                },
            },
        },
        powers: {
            hint: "Rank farm nodes by their current mining powers.",
            options: {
                witnessing: { hint: "Rank by witnessing powers instead.", },
            },
        },
        rewind: {
            hint: "Rewind blockchain state on farm nodes to this epoch.",
            params: "EPOCH",
        },
        stats: {
            hint: "Report farm stats.",
        },
        syncStatus: {
            hint: "Report current sync status for every node in the farm.",
        },
        withdrawers: {
            hint: "List withdrawers and stake entries currently delegating to the farm nodes.",
        },
    },
    subcommands: {
        addresses, authorize, balances, masterKeys, nodes: balances, peers, 
        powers, stats: nodeStats, rewind, syncStatus, withdrawers,
    },
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function addresses(flags = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const addresses = Object.entries(await farm.addresses())
    if (addresses.length === 1 && !(addresses[0][1] instanceof Error)) {
        console.info(lcyan(addresses[0][1]))
        qrcode.generate(addresses[0][1])
    } else {
        helpers.traceTable(
            addresses.map(([ url, pkh ]) => [
                pkh instanceof Error ? red(url) : mcyan(url),
                pkh instanceof Error ? red(pkh) : lcyan(pkh)
            ]), {
                headlines: [ "NODES", ":Public Key Hash" ],
            },
        )
    }
}

async function authorize(flags = {}, args) {
    if (args.length === 0) {
        throw "Withdrawer address must be specified."
    
    } else {
        const farm = new toolkit.NodeFarm(flags?.nodes)
        const authCodes = Object.entries(await farm.authorizeStakes(args[0].toLowerCase()))
            .map(([url, [validator, authorization]]) => [ 
                url, 
                validator, 
                authorization.signature.signature.Secp256k1.der 
            ])
        if (authCodes.length === 1) {
            const authorization = authCodes[0][2]
            const validator = authCodes[0][1]
            console.info(
                `> Authorization code from ${
                    mcyan(validator)
                } to withdrawer ${
                    mmagenta(args[0].toLowerCase())
                }:\n${
                    cyan(JSON.stringify(authorization))
                }`)
            //qrcode.generate(authCode)
        } else {
            console.info(authCodes)
        }
    }
}

async function balances(flags = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const balances = await farm.balances()
    helpers.traceTable(
        Object.entries(balances).map(([ url, [pkh, balance]]) => [
            pkh instanceof Error ? red(url) : mcyan(url),
            pkh instanceof Error ? red(pkh) : lcyan(pkh),
            ...(balance instanceof Error 
                ? new Array(4).fill(gray("n/a"))
                : [
                    gray(Math.floor(balance.locked / 10 ** 9)),
                    yellow(Math.floor(balance.staked / 10 ** 9)),
                    myellow(Math.floor(balance.unlocked / 10 ** 9)),
                    lyellow(Math.floor((balance.locked + balance.staked + balance.unlocked) / 10 ** 9)),
                ]
            ),
        ]), {
            headlines: [ "NODES", ":Validator address", "Locked (Wits)", "Staked (Wits)", "Unlocked (Wits)", "BALANCE (Wits)" ],
            humanizers: [ ,, helpers.commas, helpers.commas, helpers.commas, helpers.commas ],
            maxColumnWidth: 48,
        },
    )
}

async function masterKeys(flags = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const masterKeys = await farm.masterKeys()
    helpers.traceTable(
        Object.entries(masterKeys).map(([, [pkh, masterKey]]) => [
            // pkh instanceof Error ? cyan(url) : mcyan(url),
            pkh instanceof Error ? red(pkh) : mcyan(pkh),
            masterKey instanceof Error ? mred(masterKey) : cyan(masterKey)
        ]), {
            headlines: [ ":Public key hash", "Secret key" ],
            maxColumnWidth: 120,
        },
    )
} 

async function nodeStats(flags = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const nodeStats = await farm.stats()
    helpers.traceTable(
        Object.entries(nodeStats).map(([ url, stats ]) => [
            ... (stats instanceof Error 
                ? [ red(url), gray("n/a"), gray("n/a"), gray("n/a"), gray("n/a"), gray("n/a"), gray("n/a"), ]
                : [
                    mcyan(url),
                    stats.block_mined_count,
                    stats.commits_count,
                    (stats.block_mined_count / stats.block_proposed_count).toFixed(3),
                    (stats.commits_count / stats.commits_proposed_count).toFixed(3),
                    ((stats.dr_eligibility_count - stats.commits_proposed_count) / stats.dr_eligibility_count).toFixed(3),
                    (stats.slashed_count / stats.commits_count).toFixed(3),
                ]
            ),
        ]), {
            headlines: [ 
                "NODES", 
                "Mined blocks", 
                "Witnessed DRs", 
                "M_Acceptancy", 
                "W_Acceptancy", 
                "W_Reluctancy", 
                "W_Falsity",
            ],
            humanizers: [ , helpers.commas, helpers.commas,,,, ],
        },
    )
}

async function peers(flags = {}, _args = [], options = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const checklists = {}
    if (options['reset']) {
        checklists["Reset peers"] = await farm.initializePeers()
    } else if (options['clear-buckets']) {
        checklists["Clear buckets"] = await farm.clearPeers()
    }
    if (options['add']) {
        const morePeers = options.add.replaceAll(',',';').split(';')
        checklists["Add peers"] = await farm.addPeers(morePeers)
    }
    helpers.traceChecklists(checklists) 
    const peers = await farm.peers()
    if (peers.length > 0) {
        console.log(peers)
    }
}

async function powers(flags = {}, _args = [], options = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const addresses = Object.entries(await farm.addresses())
    const validators = []
    let provider
    addresses.forEach(([url, pkh]) => {
        if (pkh instanceof Error) {
            console.error(`> Skipping node ${url}: ${pkh}`)
        } else {
            if (!provider) provider = new toolkit.Provider(url)
            validators.push(pkh)
        }
    })
    if (validators.length > 0 && provider) {
        const capability = options?.witnessing ? toolkit.StakingCapability.Witnessing : toolkit.StakingCapability.Mining;
        const powers = await provider.powers(capability)
        const records = powers.filter(entry => validators.includes(entry.validator))
        if (records.length > 0) {
            capability = (capability[0].toUpperCase() + capability.slice(1))
            helpers.traceTable(
                records.map(record => [ 
                    record.rank,
                    record.validator,
                    record.withdrawer,
                    record.power,
                ]),
                {
                    headlines: [ 
                        "G_RANK", "Validators", "Withdrawers", `${capability} power`,
                    ],
                    humanizers: [
                        ,,, helpers.commas,
                    ],
                    colors: [
                        lyellow, mcyan, mmagenta, mgreen,
                    ],
                },
            )
        } else {
            console.info(`> No ${capability} power is currently treasured by available nodes.`)
        }
    } else {
        console.info("> No nodes currently available to interact with.")
    }
}

async function rewind(flags = {}, args) {
    if (!args || args.length === 0) {
        throw "No rewind epoch was provided."
    }
    if (!flags?.force) {
        const will = await helpers.prompt("Rewinding will reset some stats. Do you want to proceed anyways? (y/N)")
        // Abort if not confirmed
        if (!['y'].includes(will.toLowerCase())) {
            console.error('Aborted by user.')
            return
        }
    }
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const epoch = parseInt(args[0])
    helpers.traceChecklists({
        "Rewind chain": await farm.rewind(epoch),
    })
    syncStatus(flags)
} 

async function syncStatus(flags) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const syncStatus = await farm.syncStatus()
    helpers.traceTable(
        Object.entries(syncStatus).map(([url, status]) => [
            status instanceof Error ? red(url) : mcyan(url),
            ... (status instanceof Error ? [ red(status), "", "", "" ] : [
                status.node_state.trim() === "Synced" ? mgreen(status.node_state) : myellow(status.node_state),
                status.current_epoch,
                status.chain_beacon.checkpoint,
                status.chain_beacon.hashPrevBlock
            ])
        ]), {
            headlines: [ ":NODES", ":Status", "Current epoch", "Checkpoint epoch", ":Checkpoint block hash" ],
            humanizers: [ ,, helpers.commas, helpers.commas, ],
            colors: [ ,, white,, gray ], // gray, gray ],
        }
    )
}

async function withdrawers(flags = {}) {
    const farm = new toolkit.NodeFarm(flags?.nodes)
    const withdrawers = await farm.withdrawers()
    helpers.traceTable(
        withdrawers.map(record => [ 
            record.key.validator, 
            record.key.withdrawer, 
            record.value.coins / 10 ** 9,
            record.value.nonce, 
            record.value.epochs.mining,
            record.value.epochs.witnessing,
        ]),
        {
            headlines: [ 
                "Validators", "Withdrawers", "Staked (Wits)", "Nonce",  "LM_Epoch", "LW_Epoch",
            ],
            humanizers: [
                ,, (x) => helpers.commas(Math.floor(parseFloat(x))), helpers.commas, helpers.commas, helpers.commas, 
            ],
            colors: [
                mcyan, mmagenta, myellow,, green, green, 
            ],
        },
    )
}

