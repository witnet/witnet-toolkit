# witnet-toolkit

Interact with the Wit/Oracle blockchain from Javascript without actually running a node. Build your own Witnet-compliant parameterized data requests and test them before broadcasting sending them to the Witnet network and getting the results forever stored in the Wit/Oracle blockchain. 

## Package install

`$ npm install --save-dev witnet-toolkit`

## JS/TS libraries
### Import clauses
```javascript
const Witnet = require('witnet-toolkit')
const { RadonRequest, Signer, Utils } from 'witnet-toolkit'
```
### Usage exmpales
#### Managing Radon Requests
```
const Witnet = require("witnet-toolkit")

// Example 1: CCDR for getting transaction details on a foreign EVM-chain
var ccdr = Witnet.RadonRetrievals.CrossChainRPC({
    rpc: Witnet.RadonRetrievals.RPCs.ETH.getTransactionByHash("\\1\\"),
    script: Witnet.RadonScript().parseJSONMap()
})
var template = new Witnet.RadonTemplate({
    retrieve: ccdr.spawnRetrievals(
        "https://polygon-amoy.gateway.tenderly.co",
        "https://rpc.ankr.com/polygon_amoy",
        "https://polygon-amoy-bor-rpc.publicnode.com",    
    ),
    aggregate: Witnet.RadonReducers.Mode(),
    tally: Witnet.RadonReducers.Mode(),
});
var request = template.buildRequestModal("0xfc3c17407f788c075483b0ad5383b1d5e6fbdc7ba500b08397c80423755c5eba")

// Example 2: Compose a regular randomness request
var request = new Witnet.RadonRequest({
    retrieve: Witnet.RadonRetrievals.RNG(),
    tally: Witnet.RadonReducers.ConcatHash(),
}) 

// Example 3: Leverage a pre-built price feed from the WF's pricefeeds repository
const assets = require('witnet-feeds')
var request = assets.legacy.requests.price.crypto.WitOracleRequestPriceAvaxUsd6;

// Example 4: Get WSB addresses on "conflux:core:mainnet"
var addresses = assets.getAddresses("conflux:core:mainnet")

// Example 5: Serialize a RadonRequest into a hexified buffer
var hexString = request.toBytecode()

// Example 6: Convert RadonRequest into Witnet-compliant protobuf object
var protobuf = request.toProtobuf()

// Example 7: Stringify a Witnet-compliant script
console.info(request.retrieve[0].script.toString())

// Example 8: Decode hexified bytecode into a RadonRequest
var request = Witnet.RadonRequest.from(hexString)

// Example 9: Get result of dry running a RadonRequest, locally
var result = JSON.parse(await request.execDryRun())
```
#### Interacting with the Witnet network
#### Sending a Data Request to the Witnet network

---
## CLI binaries

### Optional environment variables
```
WITNET_TOOLKIT_PRIVATE_KEY=
WITNET_TOOLKIT_PROVIDER_URL=
WITNET_TOOLKIT_REPORTER_URL=
```

### Usage
**`npx witnet`**
```
USAGE:
    npx witnet <COMMAND> [<params> ...]

FLAGS:
    --json          Output data in JSON format
    --indent <:nb>  Number of white spaces used to prefix every output line
    --verbose       Report step-by-step detailed information

COMMANDS:
    decodeRadonRequest <drBytecode>  Disassemble hexified bytecode into a Radon request.
    dryrunRadonRequest <drBytecode>  Resolve a Radon request given its hexified bytecode, locally.

    network         Network commands suite for reading or interacting with the Witnet blockchain.
    version         Show version of the installed witnet_toolkit binary.
```
**`npx witnet network`**
```
USAGE:
    npx witnet network <COMMAND> [<params> ...]

FLAGS:
    --json             Output data in JSON format
    --indent <:nb>     Number of white spaces used to prefix every output line
    --verbose          Report network detailed information

NETWORK FLAGS:
    --epoch <:nb>      Extract data from or at specified epoch
    --limit <:nb>      Limit number of entries to fetch
    --timeout <:secs>  Limit seconds to wait for a result

NETWORK COMMANDS:
    address            Public Witnet address corresponding to your WITNET_TOOLKIT_PRIVATE_KEY.
    blocks             Lately consolidated blocks in the Witnet blockhain.
    fees               Lately consolidated transaction fees in the Witnet blockchain.
    peers              Search public P2P nodes in the Witnet network.
    protocol           Lorem ipsum.
    providers          Search public RPC providers in the Witnet network.
    reporter           Show Witnet network reporter's URL.
    stakes             Current staking entries in the Witnet network, ordered by power.
    supply             Current status of the Witnet network.
    wips               Lorem ipsum.

    getBalance         <pkhAddress> Get balance of the specified Witnet address.
    getUtxoInfo        <pkhAddress> Get unspent transaction outputs of the specified Witnet address.

    getBlock           <blockHash>  Get details for the specified Witnet block.
    getDataRequest     <d|drTxHash> Get current status or result of some unique data request transaction.
    getTransaction     <txHash>     Get details for specified Witnet transaction

    decodeRadonRequest <radHash>    Disassemble the Radon request given its network RAD hash.
    dryrunRadonRequest <radHash>    Resolve the Radon request identified by the given network RAD hash, locally.
    searchDataRequests <radHash>    Search data request transactions containing the given network RAD hash.

    sendDataRequest    <radHash>   --unitary-fee <:nanoWits> --num-witnesses <:number>
    sendValue          <:nanoWits> --fee <:nanoWits> --to <:pkhAddress>
```

### Creating parameterized Witnet data sources

```javascript
const Witnet = require("witnet-toolkit")
const http_get_source_1 = Witnet.Sources.HttpGet({
    url: "https://api.coinbase.com/v2/exchange-rates?currency=\\1\\",
    script: Witnet.Script()
        .parseJSONMap()
        .getMap("data")
        .getMap("rates")
        .getFloat("\\0\\")
        .power(-1)
        .multiply(1e6).round(),
});
// ...
```

### Creating parameterized Witnet request templates

```javascript
// ...
const WitnetRequestTemplateCoinbaseTicker = Witnet.RequestTemplate({
    retrieve: [ http_get_coinbase_ticker, ],
    aggregate: Witnet.Reducers.PriceAggregate(),
    tally: Witnet.Reducers.PriceTally(),
});
// ...
```

### Creating static Witnet data requests

```javascript 
// ...
const WitnetStaticRequestCoinbaseEthUsd6 = Witnet.StaticRequest({
    retrieve: [
        Witnet.Sources.HttpGet({
            url: "https://api.coinbase.com/v2/exchange-rates?currency=USD",
            script: Witnet.Script()
                .parseJSONMap()
                .getMap("data")
                .getMap("rates")
                .getFloat("BTC")
                .power(-1)
                .multiply(1e6).round(),
        }),
    ],
    aggregate: Witnet.Reducers.Median([Witnet.Filters.Stdev(1.4), ]),
    tally: Witnet.Reducers.Mean(),
});
```

### Instantiate parameterized Witnet data requests

```javascript
const WitnetRequestCoinbaseEthUsd6 = Witnet.RequestFromTemplate(WitnetRequestTemplateCoinbaseTicker, [ "BTC", "USD" ]),
```

### Generate Witnet data request bytecodes

```javascript
const witnet_dr_bytecode = WitnetRequestCoinbaseEthUsd6.encode();
```

## Using the Witnet data request dry-runner

```console
$ npx witnet-toolkit
USAGE:
    npx witnet-toolkit <SUBCOMMAND>

FLAGS:
    --help      Prints help information
    --verbose   Prints detailed information of the subcommands being run
    --version   Prints version information

SUBCOMMANDS:
    decode --hex <witnet-bytecode>    Decodes some Witnet data query bytecode
    graph --hex <witnet-bytecode>     Resolves some Witnet data query bytecode locally, printing out step-by-step information
    try-query --hex <witnet-bytecode>       Resolves some Witnet data query bytecode locally, returning a detailed JSON report
```

> Hex strings can be programmatically exported from scripts using the Witnet Radon typescript library.
