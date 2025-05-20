const moment = require("moment")

const helpers = require("../helpers")
const { utils, Witnet } = require("../../../dist/src")

const { cyan, gray, green, lyellow, magenta, mgreen, mmagenta, myellow, yellow } = helpers.colors

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
  envars: {
    WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
  },
  flags: {
    provider: {
      hint: "Public Wit/Oracle JSON-RPC provider, other than default.",
      param: ":http-url",
    },
    verbose: {
      hint: "Outputs validators' nonce and last validation epochs.",
    },
  },
  router: {
    balance: {
      hint: "Show available Wits on given address.",
      params: "WIT_ADDRESS",
    },
    block: {
      hint: "Get block data given its block hash.",
      params: "BLOCK_HASH",
    },
    dataRequest: {
      hint: "Report resolution workflow for the specified data request transaction.",
      params: "DR_TX_HASH",
    },
    "dataRequests*": {
      hint: "Search for in-flight or recently solved data request transactions.",
      params: "BYTECODE | RAD_HASH | DDR_HASH",
      options: {
        limit: { hint: "Limit output records (default: 100).", param: "LIMIT" },
        since: {
          hint: "Number of past epochs to search for (default: 256; max: 2048).",
          param: "EPOCH|MINUS_EPOCHS",
        },
        "min-unitary-reward": {
          hint: "Filters out those providing less unitary reward than specified.",
          param: "NANOWITS",
        },
        "min-witnesses": {
          hint: "Filters out those solved with less than specified witnesses.",
          param: "NUM_WITNESSES",
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
        "small-first": {
          hint: "Outputs smallest UTXOs first (default: false).",
        },
      },
    },
  },
  subcommands: {
    balance, block, dataRequest, superblock, transaction, validators, withdrawers, utxos,
  },
}

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function balance (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No WIT_ADDRESS was specified")
  }
  const pkh = args[0]
  const provider = new Witnet.JsonRpcProvider(options?.provider)
  const balance = await provider.getBalance(pkh)
  const records = []
  records.push([
    helpers.fromNanowits(balance.locked),
    helpers.fromNanowits(balance.staked),
    helpers.fromNanowits(balance.unlocked),
    helpers.fromNanowits(balance.locked + balance.staked + balance.unlocked),
  ])
  helpers.traceTable(records, {
    headlines: ["Locked ($WIT)", "Staked ($WIT)", "Available ($WIT)", "BALANCE ($WIT)"],
    humanizers: [helpers.commas, helpers.commas, helpers.commas, helpers.commas],
    colors: [gray, yellow, myellow, lyellow],
  })
}

async function block (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No BLOCK_HASH was specified")
  }
  const blockHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0]
  if (!helpers.isHexString(blockHash)) {
    throw Error("Invalid BLOCK_HASH was provided")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)
  const block = await provider.getBlock(blockHash)
  console.info(gray(JSON.stringify(block, (key, value) => {
    switch (key) {
      case "bytes":
      case "der":
      case "proof":
      case "public_key":
        return Array.isArray(value) ? helpers.toHexString(value, true) : value
      default:
        return value
    }
  }, 2)))
}

async function dataRequest (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No DR_TX_HASH was specified")
  }
  const drTxHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0]
  if (!helpers.isHexString(drTxHash)) {
    throw Error("Invalid DR_TX_HASH was provided")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)

  const drTxJsonReplacer = (key, value) => {
    switch (key) {
      case "proof":
      case "public_key":
      case "signature":
      case "signatures":
        return undefined

      case "reveal":
      case "tally":
        if (Array.isArray(value)) {
          const result = utils.cbor.decode(Uint8Array.from(value))
          return Buffer.isBuffer(result) ? utils.toHexString(value) : result
        }

      default:
        return value
    }
  }

  const report = await provider.getDataRequest(drTxHash)
  console.info(JSON.stringify(report, drTxJsonReplacer, 4))
}

async function superblock (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No EPOCH was specified")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)
  const superblock = await provider.getSuperblock(args[0])
  console.info(superblock)
}

async function transaction (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No TX_HASH was specified")
  }
  const txHash = args[0].startsWith("0x") ? args[0].slice(2) : args[0]
  if (!helpers.isHexString(txHash)) {
    throw Error("Invalid TX_HASH was provided")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)
  const transaction = await provider.getTransaction(txHash)
  console.info(
    `${yellow(JSON.stringify(transaction, utils.txJsonReplacer, 2))}`
  )
}

async function utxos (options = {}, args = []) {
  if (args.length < 1) {
    throw Error("No WIT_ADDRESS was specified")
  }
  const now = Math.floor(Date.now() / 1000)
  const provider = new Witnet.JsonRpcProvider(options?.provider)
  let utxos = await provider.getUtxos(args[0], options["small-first"] || false)
  let totalBalance = 0
  if (!options?.verbose) {
    utxos = utxos
      .filter(utxo => utxo.timelock <= now)
      .map(utxo => {
        totalBalance += utxo.value
        return [
          utxo.output_pointer,
          utxo.value,
        ]
      })
    helpers.traceTable(utxos, {
      headlines: [":UTXOs", "Value ($nanoWIT)"],
      humanizers: [, helpers.commas],
      colors: [, myellow],
    })
  } else {
    utxos = utxos
      .map(utxo => {
        totalBalance += utxo.value
        return [
          utxo.output_pointer,
          utxo.timelock > now ? gray(moment.unix(utxo.timelock).fromNow()) : "",
          utxo.timelock > now ? gray(helpers.commas(utxo.value)) : myellow(helpers.commas(utxo.value)),
        ]
      })
    helpers.traceTable(utxos, {
      headlines: [":UTXOs", "Timelock", "Value ($nanoWIT)"],
    })
  }
  console.info(`^ Showing ${utxos.length} UTXOs: ${lyellow(helpers.whole_wits(totalBalance, 2))}.`)
}

async function validators (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No WIT_ADDRESS was specified")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)
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
            options?.verbose
              ? [record.value.nonce, record.value.epochs.witnessing, record.value.epochs.mining]
              : []
          ),
          helpers.fromNanowits(record.value.coins),
        ]
      }), {
        headlines: [
          "RANK",
          "VALIDATORS",
          ...(
            options?.verbose
              ? ["Nonce", "LW_Epoch", "LM_Epoch"]
              : []
          ),
          "STAKED ($WIT)",
        ],
        humanizers: [
          ,, ...(
            options?.verbose
              ? [helpers.commas, helpers.commas, helpers.commas]
              : []
          ),
          helpers.commas,
        ],
        colors: [, green, ...(
          options?.verbose
            ? [, magenta, cyan, myellow]
            : [myellow]
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

async function withdrawers (options = {}, args = []) {
  if (args.length === 0) {
    throw Error("No WIT_ADDRESS was specified")
  }
  const provider = new Witnet.JsonRpcProvider(options?.provider)
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
            options?.verbose
              ? [record.value.nonce, record.value.epochs.witnessing, record.value.epochs.mining]
              : []
          ),
          helpers.fromNanowits(record.value.coins),
        ]
      }), {
        headlines: [
          "RANK",
          "WITHDRAWERS",
          ...(
            options?.verbose
              ? ["Nonce", "LW_Epoch", "LM_Epoch"]
              : []
          ),
          "STAKED ($WIT)",
        ],
        humanizers: [
          ,, ...(
            options?.verbose
              ? [helpers.commas, helpers.commas, helpers.commas]
              : []
          ),
          helpers.commas,
        ],
        colors: [, green, ...(
          options?.verbose
            ? [, magenta, cyan, myellow]
            : [myellow]
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
