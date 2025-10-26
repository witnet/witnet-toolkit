const {
  RadonModal,
  RadonScript,
  retrievals,
  types,
} = require("../../../../dist/src/lib/radon/index.js")

module.exports = {
    WitOracleIpfsFileExists: new RadonModal({
        retrieval: retrievals.HttpHead({
            script: RadonScript(types.RadonMap)
                .getString("etag")
                .slice(1, -1)
                .match(types.RadonBoolean, { "\\0\\": true }, false)
        }),
    }),
    WitOracleIpfsFileSha256: new RadonModal({
        retrieval: retrievals.HttpGet({
            script: RadonScript(types.RadonBytes).hash()
        })
    })
}
