const {
  RadonRequest,
  RadonScript,
  filters,
  reducers,
  retrievals,
  types,
} = require("../../src/lib/radon")

module.exports = {

  defi: {
    tickers: {
      crypto: {
        WitOracleRequestPriceCryptoWitUsdt6: new RadonRequest({
          sources: [
            retrievals.HttpGet({
              url: "https://api-cloud.bitmart.com/spot/v1/ticker?symbol=WIT_USDT",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getMap("data")
                .getArray("tickers")
                .getMap(0)
                .getFloat("last_price")
                .multiply(1e6)
                .round(),
            }),
            retrievals.HttpGet({
              url: "https://data.gateapi.io/api2/1/ticker/wit_usdt",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getFloat("last")
                .multiply(1e6)
                .round(),
            }),
            retrievals.HttpGet({
              url: "https://www.mexc.com/open/api/v2/market/ticker?symbol=WIT_USDT",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getArray("data")
                .getMap(0)
                .getFloat("last")
                .multiply(1e6)
                .round(),
            }),
          ],
          sourcesReducer: reducers.Median(filters.Stdev(1.4)),
          witnessReducer: reducers.PriceTally(),
        }),
        WitOracleRequestPriceCryptoUsdtWit9: new RadonRequest({
          sources: [
            retrievals.HttpGet({
              url: "https://api-cloud.bitmart.com/spot/v1/ticker?symbol=WIT_USDT",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getMap("data")
                .getArray("tickers")
                .getMap(0)
                .getFloat("last_price")
                .power(-1)
                .multiply(1e9)
                .round(),
            }),
            retrievals.HttpGet({
              url: "https://data.gateapi.io/api2/1/ticker/wit_usdt",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getFloat("last")
                .power(-1)
                .multiply(1e9)
                .round(),
            }),
            retrievals.HttpGet({
              url: "https://www.mexc.com/open/api/v2/market/ticker?symbol=WIT_USDT",
              script: RadonScript(types.RadonString)
                .parseJSONMap()
                .getArray("data")
                .getMap(0)
                .getFloat("last")
                .power(-1)
                .multiply(1e9)
                .round(),
            }),
          ],
          sourcesReducer: reducers.Median(filters.Stdev(1.4)),
          witnessReducer: reducers.PriceTally(),
        }),
      },
    },
  },
  WitOracleRequestRandomness: new RadonRequest({
    sources: retrievals.RNG(),
    witnessReducer: reducers.ConcatHash(),
  }),
}
