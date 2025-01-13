const Witnet = require("../../dist")
const retrievals = require("./retrievals")
const templates = require("./templates")
module.exports = {
  WitOracleRequestPriceUsdtWit9: new Witnet.RadonRequest({
    retrieve: [
      Witnet.RadonRetrieve.HttpGet({
        url: "https://api-cloud.bitmart.com/spot/v1/ticker?symbol=WIT_USDT",
        script: Witnet.RadonScript(Witnet.RadonString)
          .parseJSONMap()
          .getMap("data")
          .getArray("tickers")
          .getMap(0)
          .getFloat("last_price")
          .power(-1)
          .multiply(1e9)
          .round(),
      }),
      Witnet.RadonRetrieve.HttpGet({
        url: "https://data.gateapi.io/api2/1/ticker/wit_usdt",
        script: Witnet.RadonScript(Witnet.RadonString)
          .parseJSONMap()
          .getFloat("last")
          .power(-1)
          .multiply(1e9)
          .round(),
      }),
      Witnet.RadonRetrieve.HttpGet({
        url: "https://www.mexc.com/open/api/v2/market/ticker?symbol=WIT_USDT",
        script: Witnet.RadonScript(Witnet.RadonString)
          .parseJSONMap()
          .getArray("data")
          .getMap(0)
          .getFloat("last")
          .power(-1)
          .multiply(1e9)
          .round(),
      }),
    ],
    aggregate: Witnet.RadonReducers.Median(Witnet.RadonFilters.Stdev(1.4)),
    tally: Witnet.RadonReducers.PriceTally(),
  }),
  WitOracleRequestRandomness: new Witnet.RadonRequest({
    retrieve: Witnet.RadonRetrieve.RNG(),
    tally: Witnet.RadonReducers.ConcatHash(),
  }),
}
