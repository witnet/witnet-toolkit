const helpers = require("../helpers")
const { Witnet } = require("../../../dist/src")

const FLAGS_LIMIT_MAX = 2048
const FLAGS_LIMIT_DEFAULT = 64
const OPTIONS_DEFAULT_SINCE = -2048

const { cyan, white, gray, green, lcyan, lyellow, mgreen, mred, myellow, yellow } = helpers.colors

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
  envars: {
    WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
  },
  flags: {
    limit: {
      hint: "Limits number of output records (default: 64).",
      param: "LIMIT",
    },
    offset: {
      hint: "Skips first records as found on server side (default: 0).",
      param: "SKIP",
    },
    provider: {
      hint: "Public Wit/Oracle JSON-RPC provider, other than default.",
      param: "PROVIDER_URL",
    },
    verbose: {
      hint: "Outputs detailed information.",
    },
  },
  router: {
    blocks: {
      hint: "List recently validated blocks.",
      options: {
        since: {
          hint: "Since the specified epoch (default: -<LIMIT>-2).",
          param: "EPOCH|MINUS_EPOCHS",
        },
      },
    },
    constants: {
      hint: "Show network's consensus constants.",
    },
    fees: {
      hint: "Estimate transaction fees based on recent network activity.",
      params: "\"vtt\" | \"drt\" | \"st\" | \"ut\"",
      options: {
        eti: {
          hint: "Expected time before inclusion (default: 60 seconds).",
          param: "ETI_SECONDS",
        },
        weight: {
          hint: "Assuming this transaction weight (default: 1).",
          param: "TX_WEIGHT",
        },
      },
    },
    holders: {
      hint: "List identities holding Wits within the specified range.",
      options: {
        "min-balance": {
          hint: "Having at least this amount of unlocked Wits (default: 1 Wit).",
          param: "WITS",
        },
        "max-balance": {
          hint: "Having at most this amount of unlocked Wits.",
          param: "WITS",
        },
      },
    },
    knownPeers: {
      hint: "Get a full list of peers as known by the Wit/Oracle RPC provider(s).",
    },
    mempool: {
      hint: "Dump current transactions mempool.",
      params: "[\"vtt\" | \"drt\" | \"st\" | \"ut\"]",
      options: {
        count: { hint: "Just count the number of entries (ignoring limit)." },
        offset: {
          hint: "Skips first matching entries (default: 0).",
          param: "OFFSET",
        },
      },
    },
    powers: {
      hint: "List validation identities ordered by their current mining power.",
      options: {
        distinct: { hint: "Include only the first appearance per validator." },
        witnessing: { hint: "Order by witnessing power instead." },
      },
    },
    provider: {
      hint: "Show the underlying Wit/RPC provider and network id being used.",
    },
    senate: {
      hint: "List distinct identities that have lately validated at least one block.",
      options: {
        since: {
          hint: "Since the specified epoch (default: -2048).",
          param: "MINUS_EPOCHS",
        },
      },
    },
    stakes: {
      hint: "List active stake entries at present time.",
      options: {
        validator: { hint: "Filter by validator address.", param: "WIT_ADDRESS" },
        withdrawer: { hint: "Filter by withdrawer address.", param: "WIT_ADDRESS" },
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
    versions: {
      hint: "List known protocol versions and which one is currently live.",
    },
    wips: {
      hint: "Show currently activated WIPs on the network.",
      options: {
        pending: { hint: "Only shows pending upgrades, if any." },
      },
    },
  },
  subcommands: {
    blocks,
    constants,
    holders,
    knownPeers,
    mempool,
    fees: priorities,
    powers,
    provider,
    senate,
    stakes,
    supplyInfo,
    syncStatus,
    versions,
    wips,
  },
}

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function blocks (options = {}) {
  options.limit = Math.min(parseInt(options.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX)
  const provider = new Witnet.Provider(options?.provider)
  // todo: use prompter?
  const records = await provider.blocks(parseInt(options?.since) || -options.limit - 2, options.limit)
  if (records.length > 0) {
    helpers.traceTable(
      records.slice(0, options.limit).map(record => [
        record[0],
        record[1],
      ]), {
        headlines: ["EPOCH", "BLOCK HASHES"],
        humanizers: [helpers.commas],
        colors: [, helpers.colors.gray],
      })
    console.info(`^ Listed ${records.length} blocks for a range of ${options.limit} epochs.`)
  } else {
    console.info(
      `> No blocks found in specified range (since: ${
        options?.since || -options.limit
      }, limit: ${
        options.limit
      }).`
    )
  }
}

async function constants (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  console.info(await provider.constants())
}

async function holders (options = {}) {
  options.limit = Math.min(parseInt(options.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX)
  const provider = new Witnet.Provider(options?.provider)
  const records = Object.entries(await helpers.prompter(provider.holders(
    options["min-balance"] ? options["min-balance"] * 10 ** 9 : 1000000,
    options["max-balance"] ? options["max-balance"] * 10 ** 9 : null,
  )))
  const totalRecords = records.length
  helpers.traceTable(
    records.slice(0, options.limit).map(([address, balance], index) => [
      index + 1,
      address,
      ...(options?.verbose
        ? [
          helpers.fromNanowits(balance.locked),
          helpers.fromNanowits(balance.staked),
          helpers.fromNanowits(balance.unlocked),
        ]
        : []),
      helpers.fromNanowits(balance.locked + balance.staked + balance.unlocked),
    ]), {
      headlines: [
        "RANK", "HOLDERS",
        ...(options?.verbose
          ? [
            "Locked ($WIT)",
            "Staked ($WIT)",
            "Available ($WIT)",
          ]
          : []),
        "BALANCE ($WIT)",
      ],
      humanizers: [,, helpers.commas, helpers.commas, helpers.commas, helpers.commas],
      colors: [
        , mgreen,
        ...(options?.verbose
          ? [
            gray,
            yellow,
            myellow,
          ]
          : []),
        lyellow,
      ],
    }
  )
  if (options.limit < totalRecords) {
    console.info(`^ Listed ${Math.min(options.limit, totalRecords)} out of ${totalRecords} records.`)
  }
}

async function knownPeers (options = {}) {
  if (!options) options = {}
  options.limit = parseInt(options.limit) || FLAGS_LIMIT_DEFAULT
  const provider = new Witnet.Provider(options?.provider)
  const knownPeers = await provider.knownPeers()
  console.info(knownPeers)
}

async function mempool (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  console.info(await provider.mempool())
}

async function powers (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const query = {
    distinct: options?.distinct || false,
    limit: parseInt(options.limit) || FLAGS_LIMIT_DEFAULT,
    offset: parseInt(options?.offset) || 0,
    orderBy: options?.witnessing ? "witnessing" : "mining",
  }
  const records = await provider.powers(query)
  if (records.length > 0) {
    helpers.traceTable(
      records.map(record => [
        record.ranking,
        record.validator,
        ...(options?.verbose ? [record.withdrawer] : []),
        record.power,
      ]), {
        headlines: [
          "G_RANK",
          "VALIDATORS",
          ...(options?.verbose ? ["Withdrawer"] : []),
          `${query.orderBy.toUpperCase()} POWER`,
        ],
        colors: [
          ,
          helpers.colors.green,
          ...(options?.verbose ? [helpers.colors.mgreen] : []),
          query.orderBy === "mining" ? helpers.colors.mcyan : helpers.colors.mmagenta,
        ],
        humanizers: [
          helpers.commas,,
          ...(options?.verbose ? [, helpers.commas] : [helpers.commas]),
        ],
      },
    )
    if (records.length === query.limit || query.offset === 0) {
      console.info(`^ Listed ${records.length} records.`)
    } else if (query.offset !== 0) {
      console.info(`^ Listed ${records.length} out of ${records.length + query.offset} records.`)
    }
  } else {
    if (query.offset === 0) {
      console.info("> No records found.")
    } else {
      console.info(`> No as many as ${query.offset + 1} records exist.`)
    }
  }
}

async function priorities (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  console.info(await provider.priorities())
}

async function provider (options = {}) {
  const provider = await Witnet.Provider.fromEnv(options?.provider)
  console.info(`> Witnet RPC provider: ${white(provider.endpoints)}`)
  console.info(`> Witnet environment:  ${
    provider.networkId === 40941
      ? lcyan("MAINNET")
      : (provider.network === "testnet" ? cyan("TESTNET") : mred("Unknown"))
  }`)
  console.info(`> Witnet network id:   ${green("0x" + provider.networkId.toString(16).toUpperCase())}`)
}

async function senate (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const params = {
    distinct: true,
    limit: Math.min(parseInt(options.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX),
    offset: parseInt(options?.offset || 0),
    order: { by: "mining" },
    since: -Math.abs(parseInt(options?.since) || OPTIONS_DEFAULT_SINCE) - 1,
  }
  const records = await provider.stakes({ params }) // todo: use prompter?
  if (records.length > 0) {
    helpers.traceTable(
      records
        .map((record, index) => [
          ...(options?.verbose
            ? [
              index + 1,
              record.key.validator,
              record.value.nonce,
              record.value.epochs.witnessing,
            ]
            : [
              record.key.validator,
            ]),
          record.value.epochs.mining,
        ])
      , {
        headlines: [
          ...(options?.verbose
            ? [
              "INDEX",
              `Superblock Voting Committee ${params.since + 1}`,
              "Nonce",
              "LW_Epoch",
            ]
            : [
              `Superblock Voting Committee ${params.since + 1}`,
            ]),
          "LM_Epoch",
        ],
        humanizers: [
          ...(options?.verbose
            ? [
              helpers.commas,, helpers.commas, helpers.commas, helpers.commas,
            ]
            : [
              , helpers.commas, helpers.commas, helpers.commas,
            ]),
        ],
        colors: [
          ...(options?.verbose
            ? [
              ,,, helpers.colors.magenta, helpers.colors.mcyan,
            ]
            : [
              , helpers.colors.mcyan,
            ]),
        ],
      }
    )
    if (records.length < params.limit) {
      if (params.offset === 0) {
        console.info(`^ Only ${records.length} qualified members out of ${params.limit} seats.`)
      } else {
        console.info(`^ Listed ${records.length} out of ${records.length + params.offset} members.`)
      }
    } else {
      console.info(`^ Listed ${records.length} members.`)
    }
  } else {
    if (params.offset === 0) {
      console.info("No qualified members found.")
    } else {
      console.info(`No as many as ${params.offset} qualified members exist.`)
    }
  }
}

async function stakes (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const query = {
    params: {
      limit: Math.min(parseInt(options.limit) || FLAGS_LIMIT_DEFAULT, FLAGS_LIMIT_MAX),
      offset: parseInt(options?.offset || 0),
    },
  }
  if (options?.validator) query.filter = { validator: options.validator }
  if (options?.withdrawer) query.filter = { ...query.filter, withdrawer: options.withdrawer }
  const records = await provider.stakes(query) // todo: use prompter?
  if (records.length > 0) {
    helpers.traceTable(
      records
        .map((record, index) => [
          1 + index + query.params.offset,
          record.key.withdrawer,
          record.key.validator,
          ...(
            options?.verbose
              ? [record.value.nonce, record.value.epochs.witnessing, record.value.epochs.mining]
              : []
          ),
          helpers.fromNanowits(record.value.coins),
        ]),
      {
        headlines: [
          options?.validator || options?.withdrawer ? "RANK" : "G_RANK",
          "STAKERS",
          "Validator",
          ...(
            options?.verbose
              ? ["Nonce", "LW_Epoch", "LM_Epoch"]
              : []
          ),
          "STAKED ($WIT)",
        ],
        humanizers: [
          ,,, ...(
            options?.verbose
              ? [helpers.commas, helpers.commas, helpers.commas]
              : []
          ),
          (x) => helpers.commas(Math.floor(parseFloat(x))),
        ],
        colors: [
          , helpers.colors.mgreen,, ...(
            options?.verbose
              ? [, helpers.colors.magenta, helpers.colors.cyan]
              : []
          ),
          helpers.colors.myellow,
        ],
      },
    )
    if (records.length === query.params.limit || query.params.offset === 0) {
      console.info(`^ Listed ${records.length} records.`)
    } else if (query.params.offset !== 0) {
      console.info(`^ Listed ${records.length} out of ${records.length + query.params.offset} records.`)
    }
  } else {
    if (query.params.offset === 0) {
      console.info("> No records found.")
    } else {
      console.info(`> No as many as ${query.params.offset + 1} records exist.`)
    }
  }
}

async function supplyInfo (options = {}) {
  const reporter = new Witnet.Reporter(options?.provider || process.env.WITNET_SDK_PROVIDER_URL)
  const data = await reporter.supplyInfo()
  console.info(`> Supply info at epoch ${helpers.colors.white(helpers.commas(data.epoch))}:`)
  const records = []
  records.push(["Minted blocks", helpers.toFixedTrunc(100 * data.blocks_minted / (data.epoch - 1), 1) + " %"])
  records.push(["Minted rewards", helpers.whole_wits(data.blocks_minted_reward, 2)])
  if (data.burnt_supply) {
    records.push(["Burnt supply", helpers.whole_wits(data.burnt_supply, 2)])
  };
  if (data.current_locked_supply) {
    records.push(["Locked supply", helpers.whole_wits(data.current_locked_supply, 2)])
  }
  if (data.current_staked_supply) {
    records.push(["Staked supply", helpers.whole_wits(data.current_staked_supply, 2)])
  }
  records.push(["Circulating supply", helpers.whole_wits(data.current_unlocked_supply, 2)])
  helpers.traceTable(records, {
    headlines: [":KPI", "VALUE"],
    colors: [helpers.colors.mgreen, helpers.colors.myellow],
  })
}

async function syncStatus (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const syncStatus = await provider.syncStatus()
  helpers.traceTable(
    [[
      syncStatus.node_state || "",
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
      humanizers: [, helpers.commas, helpers.commas],
      colors: [helpers.colors.mgreen, helpers.colors.white,, helpers.colors.gray],
    },
  )
}

async function versions (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const protocolInfo = await provider.protocolInfo()
  if (
    protocolInfo?.all_checkpoints_periods &&
        protocolInfo?.all_versions?.efv &&
        Object.keys(protocolInfo.all_versions.efv).length > 0
  ) {
    const records = Object.fromEntries(
      Object.entries(protocolInfo.all_checkpoints_periods)
        .sort(([a], [b]) => b - a)
        .map(([version, period]) => [version, { period }])
    )
    Object.entries(protocolInfo.all_versions.efv).forEach(([key, epoch]) => {
      if (records[key]) records[key].epoch = epoch
    })
    helpers.traceTable(
      Object.entries(records).map(([key, props]) => [
        key === "V1_7" ? "V1_0" : key,
        props?.epoch,
        props?.period,
      ]), {
        headlines: [
          ":Version",
          "Activation epoch",
          ":Block time (secs)",
        ],
        humanizers: [, helpers.commas],
        colors: [helpers.colors.mgreen, helpers.colors.white, helpers.colors.normal],
      })
  }
  console.info(`Current protocol version is ${helpers.colors.mgreen(protocolInfo.current_version)}.`)
}

async function wips (options = {}) {
  const provider = new Witnet.Provider(options?.provider)
  const wips = await provider.wips()
  if (!options?.pending) {
    // console.info(`> Active WIP upgrades at epoch ${helpers.colors.white(helpers.commas(wips.epoch))}:`)
    const active_upgrades = Object.entries(wips.active_upgrades).map(([wip, epoch]) => [
      wip,
      epoch,
    ])
    helpers.traceTable(active_upgrades, {
      headlines: [":WIP", "Activation epoch"],
      humanizers: [, helpers.commas],
      colors: [helpers.colors.mcyan, helpers.colors.white],
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
        humanizers: [,, helpers.commas, helpers.commas, helpers.commas, helpers.commas],
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
