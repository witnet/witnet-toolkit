const {
  RadonModal,
  RadonScript,
  retrievals,
  types,
} = require("../../../../src/lib/radon")

module.exports = {
    WitOracleIpfsFileExists: new RadonModal({
        retrieval: retrievals.HttpHead({
            script: RadonScript(types.RadonMap).getString("etag").length().greaterThan(0)
        }),
    }),
    WitOracleIpfsFileSha256: new RadonModal({
        retrieval: retrievals.HttpGet({
            script: RadonScript(types.RadonBytes).hash()
        })
    })
}
