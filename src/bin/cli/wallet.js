const qrcodes = require("qrcode-terminal")
const prompt = require("inquirer").createPromptModule()

const { utils, Witnet } = require("../../../dist/src")

const helpers = require("../helpers")
const { loadAssets } = require("./radon")

const { colors, whole_wits } = helpers

const options = {
  await: {
    hint: "Await any involved transaction to get eventually mined (default: false).",
  },
  confirmations: {
    hint: "Number of epochs to await after any involved transaction gets mined (implies --await).",
    param: "NUMBER",
  },
  fees: {
    hint: "Specific transaction fees (supersedes --priority).",
    param: "WITS",
  },
  force: {
    hint: "Broadcast transaction/s without user's final confirmation.",
  },
  from: {
    hint: "Specific wallet's address that will pay for the transaction, other than default.",
    param: "WALLET_ADDRESS",
  },
  priority: {
    hint: "Transaction priority: `stinky`, `low`, `medium`, `high`, `opulent`.",
    param: "PRIORITY",
  },
  strategy: {
    hint: "UTXOs selection strategy: `big-first`, `random`, `slim-fit`, `small-first` (default: `slim-fit`).",
    param: "STRATEGY",
  },
}

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
  envars: {
    WITNET_SDK_PROVIDER_URL: "=> Wit/Oracle RPC provider(s) to connect to, if no otherwise specified.",
    WITNET_SDK_WALLET_MASTER_KEY: "=> Wallet's master key in XPRV format, as exported from either a node, Sheikah or myWitWallet.",
  },
  flags: {
    gap: {
      hint: "Max indexing gap when searching for wallet accounts (default: 10).",
      param: "NUMBER",
    },
    provider: {
      hint: "Public Wit/Oracle JSON-RPC provider, other than default.",
      param: "URL",
    },
    verbose: {
      hint: "Outputs detailed information.",
    },
  },
  router: {
    accounts: {
      hint: "List wallet's HD-accounts treasuring staked, locked or unlocked Wits.",
      params: ["[WIT_ADDRESSES ...]"],
      options: {
        limit: {
          hint: "Max number of HD-accounts to derive.",
          param: "LIMIT",
        },
        "no-funds": {
          hint: "Derive accounts even if they hold no funds.",
        },
        qrcode: {
          hint: "Prints QR codes for all selected accounts.",
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
          param: "WIT_ADDRESS",
        },
        "node-master-key": {
          hint: "Node's master key other than the one set up in environment.",
          param: "XPRV",
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
      params: ["RAD_BYTECODE | RAD_HASH | RADON_ASSET", "[RADON_ARGS]"],
      options: {
        ...options,
        fees: {
          hint: "Specific unitary reward for every involved validator (supersedes --priority).",
          param: "WITS",
        },
        module: {
          hint: "NPM package where to search for Radon assets.",
          param: "NPM_PACKAGE",
        },
        witnesses: {
          hint: "Number of witnesses in the Witnet network required to attend the oracle query (default: 3).",
          param: "NUMBER",
        },
      },
    },
    provider: {
      hint: "Show the underlying Wit/Oracle RPC provider being used.",
    },
    stake: {
      hint: "Stake specified amount of Wits by using some given authorization code.",
      params: "AUTH_CODE",
      options: {
        ...options,
        value: {
          hint: "Amount in Wits to stake into the validator that signed the authorization (min: 10 KWits).",
          param: "WITS | `all`",
        },
        withdrawer: {
          hint: "Wallet's address with rights to eventually withdraw the staked deposit, plus benefits.",
          param: "WALLET_ADDRESS",
        },
      },
    },
    transfer: {
      hint: "Transfer specified amount of Wits to given address.",
      options: {
        ...options,
        into: {
          hint: "Recipient address.",
          param: "WIT_ADDRESS",
        },
        value: {
          hint: "Amount in Wits to be transfered (e.g. `0.5` Wits).",
          param: "WITS | `all`",
        },
      },
    },
    utxos: {
      hint: "List currently available UTXOs on wallet's specified address, or on all funded accounts otherwise.",
      options: {
        ...options,
        into: {
          hint: "Alternative wallet address where to JOIN or SPLIT the selected UTXOs, other than default.",
          param: "WALLET_ADDRESS",
        },
        join: { hint: "Join selected UTXOs together into a single UTXO (requires --value)." },
        splits: {
          hint: "Number of UTXOs to split the target balance into (max: 50; requires --value).",
          param: "NUMBER",
        },
        value: {
          hint: "Amount in Wits to be either joined or split apart.",
          param: "WITS | `all`",
        },
      },
    },
    withdraw: {
      hint: "Withdraw specified amount of staked Wits from some given delegatee.",
      options: {
        await: options.await,
        confirmations: options.confirmations, 
        force: options.force,
        from: {
          hint: "Validator address from whom to withdraw the specified amount.",
          param: "DELEGATEE_PKH",
        },
        into: {
          hint: "Wallet address with rights to withdraw from the delegatee (default: wallet's first account).",
          param: "WALLET_ADDRESS",
        },
        value: {
          hint: "Amount in Wits to withdraw.",
          param: "WITS | `all`",
        },
      },
    },
  },
  subcommands: {
    accounts, coinbase, decipher, delegatees: validators, notarize: resolve, provider, stake, transfer, withdraw: unstake, utxos,
  },
}

/// ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================

async function accounts (options = {}, args = []) {
  const { verbose } = options

  let wallet
  if (args.length === 0) {
    wallet = await _loadWallet({
      ...options,
      limit: options?.limit || (options["no-funds"] && 10),
      "no-funds": options["no-funds"],
    })
  } else {
    wallet = await _loadWallet({ provider: options?.provider, limit: 1 })
    args.forEach(pkh => {
      if (!wallet.getSigner(pkh)) {
        throw Error(`Input address ${pkh} doesn't belong to the wallet`)
      }
    })
  }

  if (options?.qrcode) {
    let addrs = []
    if (args.length > 0) {
      addrs = wallet.accounts.filter(account => args.includes(account.pkh))
    } else {
      addrs = wallet.accounts
    }
    addrs.forEach(account => {
      qrcodes.generate(account.pkh)
      console.info(`Wallet account #${account.index + 1}: ${colors.lmagenta(account.pkh)}\n`)
    })
    return
  }

  const coinbaseWithdrawers = await wallet.coinbase.getWithdrawers()
  const coinbaseBalance = await wallet.coinbase.getBalance()
  const coinbaseColor = utils.totalCoins(coinbaseBalance).pedros > 0 ? colors.mred : (coinbaseWithdrawers.length > 0 ? colors.mcyan : colors.cyan)
  const coinbase = coinbaseWithdrawers.length > 0 || utils.totalCoins(coinbaseBalance).pedros > 0

  const records = []

  if (coinbase) {
    const coinbaseUtxos = await wallet.coinbase.getUtxos()
    records.push([0, coinbaseColor(wallet.coinbase.pkh), coinbaseUtxos.length, coinbaseBalance])
  }
  records.push(
    ...await Promise.all(
      wallet.accounts.map(async account => {
        const balance = await account.getBalance()
        const utxos = await account.getUtxos()
        return [
          account.index + 1,
          balance.unlocked > 0 ? colors.mmagenta(account.pkh) : colors.magenta(account.pkh),
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
          ]
          : [
            helpers.fromNanowits(balance.unlocked),
          ]
        ),
      ]
    }), {
      headlines: [
        "INDEX", ":WALLET ACCOUNTS", // ...(coinbase ? [ "WALLET COINBASE" ] : ["INDEX", ":WALLET ACCOUNTS"]),
        "# UTXOs",
        ...(verbose
          ? ["Locked ($WIT)", "Staked ($WIT)", "Available ($WIT)", "BALANCE ($WIT)"]
          : ["Available ($WIT)"]
        ),
      ],
      humanizers: [
        helpers.commas,, // ...(coinbase ? [,] : [helpers.commas,,]),
        helpers.commas, helpers.commas, helpers.commas, helpers.commas, helpers.commas,
      ],
      colors: [
        ,, // ...(coinbase ? [,] : [,,]),
        ...(verbose
          ? [colors.white, colors.gray, colors.yellow, colors.myellow, colors.lyellow]
          : [colors.white, colors.myellow]
        ),
      ],
      maxColumnWidth: 48,
    }
  )
  console.info(`^ Available balance: ${colors.lyellow(whole_wits(unlocked, 2))}`)
}

async function coinbase (options = {}) {
  const masterWallet = await _loadWallet({ ...options })
  let wallet
  if (options["node-master-key"]) {
    utils.parseXprv(options["node-master-key"])
    wallet = await _loadWallet({ provider: options?.provider, limit: 1, xprv: options["node-master-key"] })
  } else {
    wallet = masterWallet
  }

  const coinbaseColor = utils.totalCoins(await wallet.coinbase.getBalance()) > 0 ? colors.mred : colors.lcyan
  console.info(`> ${options["node-master-key"] ? "Coinbase " : "Wallet's coinbase"} address: ${coinbaseColor(wallet.coinbase.pkh)}`)

  if (options?.authorize) {
    const withdrawer = options.authorize
    const authcode = wallet.coinbase.authorizeStake(withdrawer)
    qrcodes.generate(authcode)
    console.info(`${colors.white(authcode)}`)
    console.info("^ Withdrawer address:", colors.mmagenta(withdrawer))
  } else {
    const records = await wallet.coinbase.getWithdrawers({ by: Witnet.StakesOrderBy.Coins, reverse: true })
    if (records.length > 0) {
      const { verbose } = options
      let staked = 0
      helpers.traceTable(
        records.map((record, index) => {
          staked += record.value.coins
          const withdrawer = (record.key.withdrawer === wallet.coinbase.pkh || record.key.withdrawer === masterWallet.coinbase.PublicKeyHash
            ? (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
              ? colors.mred(record.key.withdrawer)
              : colors.red(record.key.withdrawer)
            )
            : (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
              ? (masterWallet.getSigner(record.key.withdrawer) ? colors.mgreen(record.key.withdrawer) : colors.mmagenta(record.key.withdrawer))
              : (masterWallet.getSigner(record.key.withdrawer) ? colors.green(record.key.withdrawer) : colors.magenta(record.key.withdrawer))
            )
          )
          const nonce = (record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
            ? record.value.nonce
            : colors.gray(record.value.nonce || "")
          )
          return [
            index + 1,
            withdrawer,
            nonce,
            ...(verbose
              ? [record.value.epochs.witnessing || "", record.value.epochs.mining || ""]
              : []
            ),
            colors.yellow(helpers.fromNanowits(record.value.coins)),
          ]
        }), {
          headlines: [
            "RANK",
            "STAKE WITHDRAWERS",
            ...(verbose
              ? ["Nonce", "LW_Epoch", "LM_Epoch"]
              : ["Nonce"]
            ),
            "STAKED ($WIT)",
          ],
          humanizers: [
            ,, ...(verbose
              ? [helpers.commas, helpers.commas, helpers.commas]
              : [helpers.commas]
            ),
            helpers.commas,
          ],
          colors: [
            ,,, ...(verbose
              ? [colors.magenta, colors.cyan, colors.myellow]
              : [colors.myellow]
            ),
          ],
        }
      )
      console.info(`^ Total stake: ${colors.lyellow(whole_wits(staked, 2))}`)
    } else {
      console.info("> Holds no delegated stake.")
    }
  }
}

async function decipher () {
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

async function provider (options = {}) {
  const wallet = await _loadWallet({ unlocked: true, limit: 1, ...options })
  wallet.provider.endpoints.forEach(url => {
    console.info(helpers.colors.colors.magenta(url))
  })
}

async function resolve (options = {}, [pattern, ...args]) {
  const wallet = await _loadWallet({ ...options })
  const ledger = (
    options?.from
      ? (options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from))
      : wallet
  )
  if (!ledger) {
    throw Error("--from address not found in wallet")
  }
  const request = await _loadRadonRequest({ ...options, pattern, args })
  await helpers.traceTransaction(
    Witnet.DataRequests.from(ledger, request), {
      headline: "DATA REQUEST TRANSACTION",
      color: colors.bgreen,
      ...await _loadTransactionParams({ ...options }),
    }
  )
}

async function stake (options = {}, [authorization]) {
  if (!authorization) {
    throw Error("No authorization code was provided")
  } else if (!options?.value) {
    throw Error("No --value was specified")
  } else if (!options?.withdrawer) {
    throw Error("No --withdrawer was specified")
  }

  const wallet = await _loadWallet({ ...options })

  // determine ledger and available funds
  let available = 0; let ledger
  if (options?.from) {
    ledger = options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from)
    if (ledger) available = (await ledger.getBalance()).unlocked
  } else {
    ledger = wallet
    available = (await wallet.getBalance()).unlocked + (await wallet.coinbase.getBalance()).unlocked
  }
  if (!ledger) {
    throw Error(`--from address ${options?.from} doesn't belong to the wallet`)
  }

  // validate withdrawer address
  const withdrawer = Witnet.PublicKeyHash.fromBech32(options?.withdrawer).toBech32(wallet.network)
  if (!wallet.getAccount(withdrawer) && withdrawer !== wallet.coinbase.pkh && !options?.force) {
    const user = await prompt([{
      message: `Withdrawer ${withdrawer} doesn't belong to the wallet. Proceed anyway?`,
      name: "continue",
      type: "confirm",
      default: false,
    }])
    if (!user.continue) {
      throw Error(`--withdrawer address ${withdrawer} not found in wallet`)
    }
  }

  // determine stake value
  const params = await _loadTransactionParams({ ...options })
  const coins = params?.value === "all" ? Witnet.Coins.fromPedros(available - params.fees.pedros) : Witnet.Coins.fromWits(params?.value)
  if (available < coins.pedros) {
    throw Error(`Insufficient funds ${options?.from ? `on address ${options.from}.` : "on wallet."}`)
  } else if (params?.fees && coins.pedros <= params.fees.pedros) {
    throw Error(`Fees equal or greater than value: ${params.fees.pedros} >= ${coins.pedros}`)
  }

  // todo: validate withdrawer matches delegatee's withdrawer

  // deposit stake
  await helpers.traceTransaction(
    Witnet.StakeDeposits.from(ledger), {
      headline: "STAKE DEPOSIT TRANSACTION",
      color: colors.bcyan,
      ...options,
      authorization,
      value: coins,
      withdrawer,
    }
  )
}

async function transfer (options = {}) {
  if (!options?.value) {
    throw Error("No --value was specified")
  }

  const wallet = await _loadWallet({ ...options })

  // determine ledger and available funds
  let available = 0; let ledger
  if (options?.from) {
    ledger = options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from)
    if (ledger) available = (await ledger.getBalance()).unlocked
  } else {
    ledger = wallet
    available = (await wallet.getBalance()).unlocked + (await wallet.coinbase.getBalance()).unlocked
  }
  if (!ledger) {
    throw Error(`--from address ${options?.from} doesn't belong to the wallet`)
  }

  // validate recipient address
  if (!options?.into) {
    throw Error("--into address must be specified")
  }
  const into = Witnet.PublicKeyHash.fromBech32(options?.into).toBech32(wallet.network)

  // determine transfer params
  const params = await _loadTransactionParams({ ...options })
  const coins = params?.value === "all" ? Witnet.Coins.fromPedros(available - params.fees.pedros) : Witnet.Coins.fromWits(params?.value)
  if (available < coins.pedros) {
    throw Error(`Insufficient funds ${options?.from ? `on address ${options.from}.` : "on wallet."}`)
  } else if (params?.fees && coins.pedros <= params.fees.pedros) {
    throw Error(`Fees equal or greater than value: ${params.fees.pedros} >= ${coins.pedros}`)
  }

  // transfer value
  await helpers.traceTransaction(
    Witnet.ValueTransfers.from(ledger), {
      headline: "VALUE TRANSFER TRANSACTION",
      color: colors.bblue,
      ...params,
      recipients: [[into, coins]],
    }
  )
}

async function unstake (options = {}) {
  if (!options.value) {
    throw Error("No --value was specified")
  } else if (!options?.from) {
    throw Error("No --from was specified")
  } else if (!options?.into) {
    throw Error("No --into was specified")
  }

  const wallet = await _loadWallet({ ...options })

  // validate withdrawer address:
  const withdrawer = Witnet.PublicKeyHash.fromBech32(options?.into).toBech32(wallet.network)
  const ledger = await wallet.getSigner(withdrawer)
  if (!ledger) {
    throw Error(`--into address ${options?.into} doesn't belong to the wallet`)
  }

  // determine validator address:
  const validator = Witnet.PublicKeyHash.fromBech32(options?.from).toBech32(wallet.network)

  // valite delegatee address:
  const delegatee = (await ledger.getDelegatees()).find(stake => stake.key.validator === validator)
  if (!delegatee) {
    throw Error(`Nothing to withdraw from ${validator} into ${withdrawer}`)
  }
  const available = delegatee.value.coins

  // determine withdrawal value:
  const params = await _loadTransactionParams({ ...options, fees: 0 })
  const coins = params?.value === "all"
    ? Witnet.Coins.fromPedros(available - params.fees.pedros)
    : Witnet.Coins.fromWits(params?.value)

  // validate withdrawal amount:
  if (available < coins.pedros + params?.fees.pedros) {
    throw Error(`Cannot withdraw that much: ${coins.pedros} > ${available}`)
  } else if (params?.fees && coins.pedros <= params.fees.pedros) {
    throw Error(`Fees equal or greater than value: ${params.fees.pedros} >= ${coins.pedros}`)
  }

  // withdraw deposit from validator into withdrawer:
  await helpers.traceTransaction(
    Witnet.StakeWithdrawals.from(ledger), {
      headline: "STAKE WITHDRAWAL TRANSACTION",
      ...params,
      validator,
      value: coins,
    }
  )
}

async function utxos (options = {}) {
  const wallet = await _loadWallet({ ...options })

  // determine ledger and available funds
  let available = 0; let ledger
  if (options?.from) {
    ledger = options.from === wallet.coinbase.pkh ? wallet.coinbase : wallet.getAccount(options.from)
    if (ledger) available = (await ledger.getBalance()).unlocked
  } else {
    ledger = wallet
    available = (await wallet.getBalance()).unlocked + (await wallet.coinbase.getBalance()).unlocked
  }
  if (!ledger) {
    throw Error(`Address ${options?.from} doesn't belong to the wallet`)
  }

  // determine into address
  let into = options?.into
  if (into) {
    if (into !== options?.from && !wallet.getAccount(into) && into !== wallet.coinbase.pkh && !options?.force) {
      const user = await prompt([{
        message: `Recipient address ${into} doesn't belong to the wallet. Proceed anyway?`,
        name: "continue",
        type: "input",
      }])
      if (!user.continue.toLowerCase().startsWith("y")) {
        throw Error(`--into address ${into} not found in wallet`)
      }
    }
  } else {
    into = wallet.pkh
  }

  // determine if --value is required
  if ((options?.join || options?.split) && !options?.value) {
    throw Error("--value must be specified on JOIN and SPLITS operations.")
  }

  // extract transaction params
  const params = await _loadTransactionParams({
    ...options,
    force: options?.force || (!options?.join && !options?.splits),
  })

  // select utxos of either the from account (if specified) or from all funded accounts in the wallet (including the coinbase)
  let coins = params?.value === "all" ? Witnet.Coins.fromPedros(available - params.fees.pedros) : Witnet.Coins.fromWits(params?.value)
  if (available < coins.pedros) {
    throw Error(`Insufficient funds ${options?.from ? `on address ${options.from}.` : "on wallet."}`)
  } else if (params?.fees && coins.pedros <= params.fees.pedros) {
    throw Error(`Fees equal or greater than value: ${params.fees.pedros} >= ${coins.pedros}`)
  }
  const utxos = await ledger.selectUtxos({ value: coins })
  const covered = utxos.map(utxo => utxo.value)?.reduce((prev, curr) => prev + curr) || 0
  if (coins && covered < coins.pedros) {
    throw Error(`Insufficient unlocked UTXOs in ${options?.from ? `wallet account ${ledger.pkh}` : "wallet"}`)
  }

  // only if at least one utxo is selected, proceed with report and other operations, if any
  if (utxos.length > 0) {
    if (options?.verbose || (!options?.join && !options?.splits)) {
      helpers.traceTable(
        utxos.map((utxo, index) => [
          index + 1,
          utxo.signer === wallet.coinbase.pkh ? colors.mcyan(utxo.signer) : colors.mmagenta(utxo.signer),
          utxo?.internal ? colors.green(utxo.output_pointer) : colors.mgreen(utxo.output_pointer),
          utxo.value,
        ]), {
          headlines: ["INDEX", "WALLET ADDRESS", ":Unlocked UTXO pointers", "UTXO value ($pedros)"],
          humanizers: [helpers.commas,,, helpers.commas],
          colors: [,,, colors.myellow],
        }
      )
      console.info(`^ Available balance: ${colors.lyellow(whole_wits(covered, 2))}`)
    }

    const valueTransfer = Witnet.ValueTransfers.from(ledger)

    if (options?.join) {
      const recipients = [[
        // if a split is expected, join utxos into selected account or wallet
        options?.splits ? ledger.pkh : into,
        coins,
      ]]
      await helpers.traceTransaction(valueTransfer, {
        headline: `JOINING UTXOs: ${utxos.length} -> ${coins.pedros < covered ? 2 : 1}`,
        ...params,
        await: params?.await || options?.splits !== undefined,
        recipients,
      })
    }
    if (options?.splits) {
      const recipients = []
      const splits = parseInt(options.splits)
      if (splits > 50) {
        throw Error("Not possible to split into more than 50 UTXOs")
      }
      coins = Witnet.Coins.fromPedros(Math.floor(coins.pedros / splits))
      recipients.push(...Array(splits).fill([into, coins]))
      await helpers.traceTransaction(
        valueTransfer, {
          headline: `SPLITTING UTXOs: ${utxos.length} -> ${coins.pedros * splits < covered ? splits + 1 : splits}`,
          ...params,
          recipients,
          reload: options?.join,
        })
    }
  } else {
    console.info("> No available UTXOs at the moment.")
  }
}

async function validators (options = {}) {
  const { verbose } = options
  const wallet = await _loadWallet({ ...options })
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
            ? colors.mred(record.key.withdrawer)
            : (record.key.validator !== "" ? colors.mmagenta(record.key.withdrawer) : colors.magenta(record.key.withdrawer)),
          ...(record.value.epochs.witnessing > record.value.nonce || record.value.epochs.mining > record.value.nonce
            ? [colors.mcyan(record.key.validator), record.value.nonce]
            : [colors.cyan(record.key.validator), colors.gray(record.value.nonce || "")]
          ),
          ...(verbose
            ? [record.value.epochs.witnessing || "", record.value.epochs.mining || ""]
            : []
          ),
          colors.yellow(helpers.fromNanowits(record.value.coins)),
        ]
      }), {
        headlines: [
          // "INDEX",
          coinbase ? "WALLET COINBASE" : "WALLET ACCOUNTS",
          "STAKE DELEGATEES",
          ...(verbose
            ? ["Nonce", "LW_Epoch", "LM_Epoch"]
            : ["Nonce"]
          ),
          "STAKED ($WIT)",
        ],
        humanizers: [
          ,, ...(verbose
            ? [helpers.commas, helpers.commas, helpers.commas]
            : [helpers.commas]
          ),
          helpers.commas,
        ],
        colors: [
          ,,, ...(verbose
            ? [colors.magenta, colors.cyan, colors.myellow]
            : [colors.myellow]
          ),
        ],
      }
    )
    console.info(`^ Total deposit: ${colors.lyellow(whole_wits(staked, 2))}`)
  } else {
    console.info("> No delegatees found.")
  }
}

/// ===================================================================================================================
/// --- Internal functions --------------------------------------------------------------------------------------------

async function _loadRadonRequest (options = {}) {
  const args = options?.args || []
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
  )

  if (args.length > 0) {
    // ignore RadonRequests if args were passed from the CLI
    assets = assets.filter(([, artifact]) => !(artifact instanceof Witnet.Radon.RadonRequest))
  }

  // sort Radon assets alphabetically
  assets = assets.sort((a, b) => {
    if (a[0] < b[0]) return -1
    else if (a[0] > b[0]) return 1
    else return 0
  })

  let artifact, key
  if (Object.keys(assets).length === 0) {
    if (options?.pattern) {
      throw Error(`No Radon assets named after "${options.pattern}"`)
    } else {
      throw Error("No Radon assets declared yet")
    }
  } else if (Object.keys(assets).length > 1) {
    const user = await prompt([{
      choices: assets.map(([key]) => key),
      message: "Please, select a Radon asset:",
      name: "key",
      type: "list",
      pageSize: 24,
    }]);
    [key, artifact] = assets.find(([key]) => key === user.key)
  } else {
    [key, artifact] = Object.values(assets)[0]
  }

  if (!(artifact instanceof Witnet.Radon.RadonRequest)) {
    let templateArgs = []
    if (args.length === 0 && artifact?.samples) {
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
      if (templateArgs.length === 0) templateArgs = [...args]
      if (templateArgs.length < artifact.argsCount) {
        throw Error(`${key}: missing ${artifact.argsCount - templateArgs.length} out of ${artifact.argsCount} parameters`)
      }
      artifact = new Witnet.Radon.RadonRequest({ sources: artifact.foldArgs(templateArgs) })
    } else {
      if (artifact instanceof Witnet.Radon.RadonModal) {
        if (templateArgs.length === 0) templateArgs = [...args]
        if (templateArgs.length === 0 && templateArgs.length < artifact.argsCount + 1) {
          throw Error(`${key}: missing ${artifact.argsCount + 1 - templateArgs.length} out of ${artifact.argsCount + 1} parameters.`)
        }
        artifact.providers = templateArgs.splice(0, 1)[0].split(";")
        artifact = artifact.buildRadonRequest(templateArgs)
      } else if (artifact instanceof Witnet.Radon.RadonTemplate) {
        if (templateArgs.length === 0) {
          templateArgs = new Array(artifact.sources.length)
          artifact.sources.forEach((retrieval, index) => {
            templateArgs[index] = args.splice(0, retrieval.argsCount)
            if (templateArgs[index].length < retrieval.argsCount) {
              throw Error(`${key}: missing ${
                retrieval.argsCount - templateArgs[index].length
              } out of ${
                retrieval.argsCount
              } expected args for template source #${index + 1}`)
            }
          })
        }
        artifact = artifact.buildRadonRequest(templateArgs)
      } else {
        throw Error(`${key}: unsupported Radon asset type ${artifact?.constructor.name}`)
      }
    }
  }
  return artifact
}

async function _loadTransactionParams (options = {}) {
  const confirmations = options?.confirmations ? parseInt(options?.confirmations) : (options?.await ? 0 : undefined)
  let fees = options?.fees ? Witnet.Coins.fromWits(options.fees) : (options?.fees === 0 ? Witnet.Coins.zero() : undefined)
  const value = options?.value ? (options?.value.toLowerCase() === "all" ? "all" : options.value) : undefined
  if (fees === undefined) {
    if (value === "all") {
      throw Error("--fees must be specified if --value is set to `all`")
    }
    let priority = (!options?.priority && options?.force) ? Witnet.TransactionPriority.Medium : options?.priority
    if (!priority) {
      const priorities = {
        "< 60 seconds": Witnet.TransactionPriority.Opulent,
        "< 5 minutes": Witnet.TransactionPriority.High,
        "< 15 minutes": Witnet.TransactionPriority.Medium,
        "< 1 hour": Witnet.TransactionPriority.Low,
        "< 6 hours": Witnet.TransactionPriority.Stinky,
      }
      const user = await prompt([{
        choices: Object.keys(priorities),
        message: "Please, select time to block expectancy:",
        name: "priority",
        type: "list",
      }])
      priority = priorities[user.priority]
    } else if (!Object.values(Witnet.TransactionPriority).includes(priority)) {
      throw Error(`Invalid priority "${priority}"`)
    }
    fees = Witnet.TransactionPriority[priority.charAt(0).toUpperCase() + priority.slice(1)]
  }
  return {
    await: options?.await,
    confirmations,
    fees,
    from: options?.from,
    force: options?.force,
    value,
    verbose: options?.verbose,
    witnesses: options?.witnesses,
  }
}

async function _loadWallet (options = {}) {
  if (!process.env.WITNET_SDK_WALLET_MASTER_KEY) {
    throw Error("No WITNET_SDK_WALLET_MASTER_KEY is settled in environment")
  } else {
    const provider = new Witnet.Provider(options?.provider)
    const strategies = {
      "small-first": Witnet.UtxoSelectionStrategy.SmallFirst,
      "slim-fit": Witnet.UtxoSelectionStrategy.SlimFit,
      "big-first": Witnet.UtxoSelectionStrategy.BigFirst,
      random: Witnet.UtxoSelectionStrategy.Random,
    }
    if (options?.strategy && !strategies[options.strategy]) {
      throw Error(`Unrecognised UTXO selection strategy "${options.strategy}"`)
    }
    const strategy = strategies[options?.strategy || "slim-fit"] || Witnet.UtxoSelectionStrategy.SlimFit
    const gap = options?.gap || 10
    let wallet; const xprv = options?.xprv || process.env.WITNET_SDK_WALLET_MASTER_KEY
    if (xprv.length === 293) {
      const user = await prompt([{ type: "password", mask: "*", message: "Enter password:", name: "passwd" }])
      wallet = Witnet.Wallet.fromEncryptedXprv(xprv, user.passwd, {
        gap,
        provider,
        strategy,
        limit: options?.limit,
        onlyWithFunds: !options["no-funds"],
      })
    } else {
      wallet = Witnet.Wallet.fromXprv(xprv, {
        gap,
        provider,
        strategy,
        limit: options?.limit,
        onlyWithFunds: !options["no-funds"],
      })
    }

    return options["no-funds"] ? await wallet : await helpers.prompter(wallet)
  }
}
