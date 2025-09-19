const {
  RadonModal,
  RadonScript,
  // filters,
  // reducers,
  retrievals,
  types,
} = require("../../../../src/lib/radon")

module.exports = {
  WitOracleEthBlockNumber: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.eth.blockNumber(),
      script: RadonScript(types.RadonString).asFloat().floor(),
    }),
  }),
  WitOracleEthGetBalance: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.eth.getBalance("\\0\\"),
      script: RadonScript(types.RadonString).asFloat().floor(),
    }),
  }),
  WitOracleEthGetTransactionReceipt: new RadonModal({
    retrieval: retrievals.JsonRPC({
      rpc: retrievals.rpc.eth.getTransactionByHash("\\0\\"),
      script: RadonScript(types.RadonString).parseJSONMap(),
    }),
  }),
}
