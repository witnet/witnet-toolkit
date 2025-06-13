const {
  RadonModal,
  RadonScript,
  // filters,
  // reducers,
  retrievals,
  types,
} = require("../../../../src/lib/radon")

module.exports = {
    WitOracleIpfsFileExists: new RadonModal({
        retrieval: retrievals.HttpHead({
            headers: {},
            script: RadonScript(types.RadonString),
        }),
    }),
    WitOracleIpfsFileSha256: {},
    WitOracleIpfsFileSha256Sealed: {},
}
