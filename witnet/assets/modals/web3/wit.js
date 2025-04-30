const {
  RadonModal,
  RadonScript,
  // filters,
  // reducers,
  retrievals,
  types,
} = require("../../../../src/lib/radon")

module.exports = {
  WitOracleWitGetBalance: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.wit.getBalance("\\1\\"),
      script: RadonScript(types.RadonString).asFloat().floor(),
    }),
  }),
  WitOracleWitGetTransaction: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.wit.getTransaction("\\1\\"),
      script: RadonScript(types.RadonString).parseJSONMap().getMap("result"),
    }),
  }),
}
