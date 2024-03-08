# witnet-toolkit

This package bundles two basic tools for developers willing to build and test data requests compliant with the Witnet Oracle blockchain:

- The **Witnet Radon Typescript** library, for programmatically building Witnet data requests.
- The **Witnet Toolkit** command, for simulating both the resolution steps and the result that witnessing nodes in the Witnet blockchain would obtain if resolving the given data request at the present moment.

## Package install

`$ npm install --save-dev witnet-toolkit`

## Witnet Radon library

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
    decode-query --hex <witnet-bytecode>    Decodes some Witnet data query bytecode
    trace-query --hex <witnet-bytecode>     Resolves some Witnet data query bytecode locally, printing out step-by-step information
    try-query --hex <witnet-bytecode>       Resolves some Witnet data query bytecode locally, returning a detailed JSON report
```

> Hex strings can be programmatically exported from scripts using the Witnet Radon typescript library.
