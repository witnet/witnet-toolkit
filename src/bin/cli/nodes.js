const qrcode = require('qrcode-terminal')
const helpers = require("../helpers")
const { Witnet } = require("../../../dist/src")

const { cyan, gray, green, red, yellow, white, magenta, mcyan, mgreen, mmagenta, mred, myellow, lcyan, lgreen, lmagenta, lyellow, } = helpers.colors

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    envars: {
        WITNET_TOOLKIT_FARM_NODES: "=> URLs to your own nodes' HTTP/JSON private endpoints, if no otherwise specified."
    },
    flags: {
        nodes: {
            hint: "Private URLs to your node's HTTP/JSON endpoints, other than default.",
            param: "JSON_HTTP_URL[;..]",
        },
    },
    router: {
        authorize: {
            hint: "Generate stake authorization codes for given withdrawer.",
            params: "WITHDRAWER",
            options: {
                "qrcodes": {
                    hint: "Print authorization QR codes, scannable from myWitWallet."
                }
            }
        },
        balance: {
            hint: "List endpoints that connect to your nodes, addresses and available balances."
        },
        masterKeys: {
            hint: "Export nodes' master keys.",
        },
        publicKeys: {
            hint: "Export nodes' public keys.",
        },
        peers: {
            hint: "List and manage node farm's peers.",
            options: {
                add: {
                    hint: "Add new peer addresses for the nodes to try to connect to.",
                    param: "P2P_IP:PORT[;..]",
                },
                "clear-buckets": {
                    hint: "Clear out all peering buckets.",
                },
                reset: {
                    hint: "Clear all peers from the buckets and initialize to those in config.",
                },
            },
        },
        rankings: {
            hint: "Sort identities by their current mining power ranking.",
            options: {
                witnessing: { hint: "Sort by witnessing power ranking instead.", },
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
        addresses, authorize, balance, masterKeys, publicKeys,  
        peers, rankings, rewind, stats, syncStatus, withdrawers,
    },
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function _initializeFarm(options = {}) {
    return new Witnet.NodeFarm(options?.nodes)
}

async function addresses(options = {}) {
    const farm = await _initializeFarm(options)
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

async function authorize(options = {}, args = []) {
    if (args.length === 0) {
        throw "Withdrawer address must be specified."
    } else {
        Witnet.PublicKeyHash.fromBech32(args[0])
        const farm = await _initializeFarm(options)
        const authcodes = await farm.authorizeStakes(args[0].toLowerCase())
        Object.entries(authcodes).forEach(([url, [validator, authcode]]) => {
            if (url instanceof Error) {
                console.error(url)
            } else if (validator instanceof Error) {
                console.error("Endpoint:", url)
                console.error(validator)
            } else if (authcode instanceof Error) {
                console.info("Validator address: ", mcyan(validator))
                console.error(authcode)
            } else {
                console.info("Validator address: ", mcyan(validator))
                console.info(`${white(authcode)}`)
                if (options?.qrcodes) qrcode.generate(authcode)
            }
            console.info()
        })
        if (options?.qrcodes) {
            console.info("=".repeat(102))
            console.info("^ Withdrawer address:", lmagenta(args[0].toLowerCase()))
        } else {
            console.info("Withdrawer address:", lmagenta(args[0].toLowerCase()))    
        }
    }
}

async function balance(options = {}) {
    const farm = await _initializeFarm(options)
    const balances = await farm.balances()
    helpers.traceTable(
        Object.entries(balances).map(([ url, [pkh, balance]]) => [
            pkh instanceof Error ? red(url) : mcyan(url),
            pkh instanceof Error ? red(pkh) : lcyan(pkh),
            ...(balance instanceof Error 
                ? new Array(4).fill(gray("n/a"))
                : [
                    gray(helpers.fromNanowits(balance.locked)),
                    yellow(helpers.fromNanowits(balance.staked)),
                    myellow(helpers.fromNanowits(balance.unlocked)),
                    lyellow(helpers.fromNanowits(balance.locked + balance.staked + balance.unlocked)),
                ]
            ),
        ]), {
            headlines: [ "NODES", ":Validator address", "Locked ($WIT)", "Staked ($WIT)", "Available ($WIT)", "BALANCE ($WIT)" ],
            humanizers: [ ,, helpers.commas, helpers.commas, helpers.commas, helpers.commas ],
            maxColumnWidth: 48,
        },
    )
}

async function masterKeys(options = {}) {
    const farm = await _initializeFarm(options)
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

async function peers(options = {}) {
    const farm = await _initializeFarm(options)
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

async function publicKeys(options = {}) {
    const farm = await _initializeFarm(options)
    const publicKeys = await farm.publicKeys()
    helpers.traceTable(
        Object.entries(publicKeys).map(([, [pkh, publicKey]]) => [
            pkh instanceof Error ? red(pkh) : mcyan(pkh),
            publicKey instanceof Error ? mred(publicKey.toString()) : cyan(publicKey.toString())
        ]), {
            headlines: [ ":Public key hash", "Public key" ],
            maxColumnWidth: 120,
        },
    )
} 

async function rankings(options = {}) {
    const farm = await _initializeFarm(options)
    const addresses = Object.entries(await farm.addresses())
    const validators = []
    let provider
    addresses.forEach(([url, pkh]) => {
        if (pkh instanceof Error) {
            console.error(`> Skipping node ${url}: ${pkh}`)
        } else {
            if (!provider) provider = new Witnet.Provider(url)
            validators.push(pkh)
        }
    })
    if (validators.length > 0 && provider) {
        const query = {
            distinct: true,
            orderBy: options?.witnessing ? "witnessing" : "mining",
        }
        const records = await provider.powers(query)
        if (records.length > 0) {
            capability = query.orderBy.toUpperCase();
            helpers.traceTable(
                records
                    .filter(record => validators.includes(record.validator))
                    .map(({ power, ranking, validator, withdrawer }) => [ 
                        validator,
                        withdrawer,
                        power,
                        ranking,
                    ]),
                {
                    headlines: [ 
                        "VALIDATORS", 
                        "Withdrawer", 
                        `${capability} POWER`,
                        "G_RANK", 
                    ],
                    humanizers: [
                        ,, helpers.commas, helpers.commas
                    ],
                    colors: [
                        lcyan, mmagenta, green, lgreen, 
                    ],
                },
            )
        } else {
            console.info(`> No ${capability} power is currently treasured on the farm.`)
        }
    } else {
        console.info("> No nodes currently available to interact with.")
    }
}

async function rewind(options = {}, args = []) {
    if (!args || args.length === 0) {
        throw "No rewind epoch was provided."
    }
    if (!options?.force) {
        const will = await helpers.prompt("Rewinding will reset some stats. Do you want to proceed anyways? (y/N)")
        // Abort if not confirmed
        if (!['y'].includes(will.toLowerCase())) {
            console.error('Aborted by user.')
            return
        }
    }
    const farm = await _initializeFarm(options)
    const epoch = parseInt(args[0])
    helpers.traceChecklists({
        "Rewind chain": await farm.rewind(epoch),
    })
    syncStatus(options)
} 

async function stats(options = {}) {
    const farm = await _initializeFarm(options)
    const stats = await farm.stats()
    helpers.traceTable(
        Object.entries(stats).map(([ url, stats ]) => [
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

async function syncStatus(options) {
    const farm = await _initializeFarm(options)
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

async function withdrawers(options = {}) {
    const farm = await _initializeFarm(options)
    const records = await farm.withdrawers()
    if (records && Object.keys(records).length > 0) {
        helpers.traceTable(
            Object.entries(records).map(([withdrawer, [coins, nonce,]]) => [ 
                withdrawer,
                nonce,
                helpers.fromNanowits(coins),
            ]),
            {
                headlines: [ "WITHDRAWERS", "Latest nonce", "Total staked ($WIT)"],
                humanizers: [, helpers.commas, helpers.commas ],
                colors: [ mmagenta,, myellow ],
            },
        )
    } else {
        console.info(`> No withdrawers delegating on the farm at the moment.`)
    }
}
