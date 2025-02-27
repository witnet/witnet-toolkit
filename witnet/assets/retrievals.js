const { utils, Witnet } = require("../../dist")

module.exports = {
    CCDR: {
        btc: {},
        ETH: {
            "ccdr/ethCall": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1\\", data: "\\2\\" }),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            "ccdr/ethCallFrom": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1\\", data: "\\2\\", from: "\\3\\" }),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            // "ccdr/ethTokenBalanceOf": Witnet.RadonRetrievals.CrossChainDataRetrieval({
            //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx\\2\\yyyy"}),
            //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            // }),
            // "ccdr/ethTokenOwnerOf": Witnet.RadonRetrievals.CrossChainDataRetrieval({
            //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx\\2\\yyyy"}),
            //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            // }),
            // "ccdr/ethTokenTotalSupply": Witnet.RadonRetrievals.CrossChainDataRetrieval({
            //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx"}),
            //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            // }),
            "ccdr/ethGetLogsAtBlockFromAddressByTopic": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.getLogs({ blockHash: "\\1\\", address: "\\2\\", topics: ["\\3\\"] }),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            "ccdr/ethGetStorageAtFromAddress": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.getStorageAt("\\2\\", "\\1\\"),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            "ccdr/ethGetTransactionByHash": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.getTransactionByHash("\\1\\"),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            "ccdr/ethGetTransactionReceipt": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.ETH.getTransactionReceipt("\\1\\"),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
        },
        sol: {},
        WIT: {
            "ccdr/witGetTransactionByHash": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.WIT.getTransactionByHash("\\1\\"),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
            "ccdr/witSupplyInfo": Witnet.RadonRetrievals.CrossChainDataRetrieval({
                rpc: Witnet.RadonRetrievals.RPC.WIT.getSupplyInfo(),
                script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
            }),
        },
    },
}

// const { Witnet } = require("../../dist")
// module.exports = {
//     ccdr: {
//         BTC: {},
//         ETH: {
//             "ccdr/ethCall": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "\\2\\" }),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             "ccdr/ethCallFrom": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "\\2\\", from: "\\3\\" }),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             // "ccdr/ethTokenBalanceOf": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//             //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx\\2\\yyyy"}),
//             //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             // }),
//             // "ccdr/ethTokenOwnerOf": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//             //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx\\2\\yyyy"}),
//             //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             // }),
//             // "ccdr/ethTokenTotalSupply": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//             //     rpc: Witnet.RadonRetrievals.RPC.ETH.call({ to: "\\1", data: "xxxx"}),
//             //     script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             // }),
//             "ccdr/ethGetLogsAtBlockFromAddressByTopic": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.getLogs({ blockHash: "\\1\\", address: "\\2\\", topics: ["\\3\\"] }),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             "ccdr/ethGetStorageAtFromAddress": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.getStorageAt("\\2\\", "\\1\\"),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             "ccdr/ethGetTransactionByHash": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.getTransactionByHash("\\1\\"),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             "ccdr/ethGetTransactionReceipt": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.ETH.getTransactionReceipt("\\1\\"),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//         },
//         SOL: {},
//         WIT: {
//             "ccdr/witGetTransactionByHash": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.WIT.getTransactionByHash("\\1\\"),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//             "ccdr/witSupplyInfo": Witnet.RadonRetrievals.CrossChainDataRetrieval({
//                 rpc: Witnet.RadonRetrievals.RPC.WIT.getSupplyInfo(),
//                 script: Witnet.RadonScript(Witnet.RadonString).parseJSONMap().getMap("result")
//             }),
//         },
//     },
// };
