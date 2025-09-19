const {
  RadonModal,
  RadonScript,
  retrievals,
  types,
} = require("../../../../src/lib/radon")

module.exports = {
  WitOracleWitGetBalance: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.wit.getBalance("\\0\\"),
      script: RadonScript(types.RadonString).parseJSONMap().getMap("result").values(),
    }),
  }),
  WitOracleWitGetValueTransfer: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.wit.getValueTransfer("\\0\\", "\\1\\"),
      script: RadonScript(types.RadonString).parseJSONMap().getMap("result").getMap("\\1\\").values(),
    }),
  }),
}
