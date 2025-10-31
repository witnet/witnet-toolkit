const {
	RadonRequest,
	RadonScript,
	filters,
	reducers,
	retrievals,
	types,
} = require("../../dist/src/lib/radon/index.js");

module.exports = {
	defi: {
		tickers: {
			crypto: {
				WitOracleRequestPriceCryptoWitUsdt6: new RadonRequest({
					sources: [
						retrievals.HttpGet({
							url: "https://api.mexc.com/api/v3/ticker/price?symbol=WITUSDT",
							script: RadonScript(types.RadonString)
								.parseJSONMap()
								.getFloat("price")
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
							url: "https://api.mexc.com/api/v3/ticker/price?symbol=WITUSDT",
							script: RadonScript(types.RadonString)
								.parseJSONMap()
								.getFloat("price")
								.multiply(1e6)
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
};
