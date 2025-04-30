const {
  RadonModal,
  RadonScript,
  retrievals,
  types,
} = require("../../../src/lib/radon")

module.exports = {
  web: {
    WitOracleWebFileExists: new RadonModal({
      retrieval: retrievals.HttpHead({
        headers: {},
        script: RadonScript(types.RadonString),
      }),
    }),
    WitOracleWebFileSha256: {},
    WitOracleWebFileSha256Sealed: {},
  },
  web3: {
    // btc: require("./web3/btc"),
    eth: require("./web3/eth.js"),
    // sol: require("./web3/sol"),
    wit: require("./web3/wit.js"),
  },
}
