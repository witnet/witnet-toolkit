# witnet-toolkit

Interact with the Witnet network without needing to run a Witnet node of your own. Manage and stake your wits. Build and test out your own Witnet-compliant parameterized data requests before asking the Wit/Oracle to attest and forever store results into the Wit/Oracle blockchain.

## Package install

`$ npm install --save-dev witnet-toolkit`

## JS/TS libraries
### Import clauses
```javascript
const Witnet = require('witnet-toolkit')
const { RadonRequest, Wallet, Utils } from 'witnet-toolkit'
```
### Usage exmpales
#### Managing Radon Requests
```
const Witnet = require("witnet-toolkit")

// Example 1: CCDR for getting transaction details on a foreign EVM-chain
const ccdr = Witnet.RadonRetrievals.CrossChainRPC({
    rpc: Witnet.RadonRetrievals.RPCs.ETH.getTransactionByHash("\\1\\"),
    script: Witnet.RadonScript().parseJSONMap()
})
const template = new Witnet.RadonTemplate({
    retrieve: ccdr.spawnRetrievals(
        "https://polygon-amoy.gateway.tenderly.co",
        "https://rpc.ankr.com/polygon_amoy",
        "https://polygon-amoy-bor-rpc.publicnode.com",    
    ),
    aggregate: Witnet.RadonReducers.Mode(),
    tally: Witnet.RadonReducers.Mode(),
});
const request = template.buildRequestModal("0xfc3c17407f788c075483b0ad5383b1d5e6fbdc7ba500b08397c80423755c5eba")

// Example 2: Compose a regular randomness request
const request = new Witnet.RadonRequest({
    retrieve: Witnet.RadonRetrievals.RNG(),
    tally: Witnet.RadonReducers.ConcatHash(),
}) 

// Example 3: Leverage a pre-built price feed from the WF's pricefeeds repository
const assets = require('witnet-feeds')
const request = assets.legacy.requests.price.crypto.WitOracleRequestPriceAvaxUsd6;

// Example 4: Get WSB addresses on "conflux:core:mainnet"
const addresses = assets.getAddresses("conflux:core:mainnet")

// Example 5: Serialize a RadonRequest into a hexified buffer
const hexString = request.toBytecode()

// Example 6: Convert RadonRequest into Witnet-compliant protobuf object
const protobuf = request.toProtobuf()

// Example 7: Stringify a Witnet-compliant script
console.info(request.retrieve[0].script.toString())

// Example 8: Decode hexified bytecode into a RadonRequest
const request = Witnet.RadonRequest.from(hexString)

// Example 9: Get result of dry running a RadonRequest, locally
const result = JSON.parse(await request.execDryRun())
```
#### Interacting with the Witnet network
#### Sending a Data Request to the Witnet network

---
## CLI binaries

### Optional environment constiables
```
WITNET_TOOLKIT_WALLET_KEY=
WITNET_TOOLKIT_PROVIDER_URL=
WITNET_TOOLKIT_REPORTER_URL=
```

### General-purpose usage
```
$ npx witnet
USAGE:
    npx witnet [FLAGS] <COMMAND>

FLAGS:
    --help      Describes command or subcommand usage
    --update    Forces update of underlying binaries
    --version   Prints toolkit name and version as first line

COMMANDS:
    fetch     Fetch public data from the Wit/Oracle blockchain.
    history   Aggregated historical data from the Wit/Oracle blockchain.
    network   Current information about the Wit/Oracle P2P network.
    node      Interact with private Wit/Oracle nodes, if reachable.
    radon     Manage Radon requests and templates within your project.
    wallet    Simple CLI wallet for spending and staking your Wits.
```
### Setting up your own Radon assets workspace
``` 
$ npx witnet radon init
...

$ npx witnet radon
...
```
