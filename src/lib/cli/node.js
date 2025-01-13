///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    flags: {},
    router: {
        address: {
            hint: "Show node address."
        },
        authorize: {
            hint: "Generate stake authorization code for given withdrawer.",
            params: "WITHDRAWER",
        },
        balance: {
            hint: "Show available Wits on node.",
        },
        peers: {
            hint: "List node peers.",
        },
        masterKey: {
            hint: "Export node's master key.",
        },
        stakes: {
            hint: "List stake entries currently delegated to the node.",
        },
        stats: {
            hint: "Report node stats.",
        },
        status: {
            hint: "Report current sync status.",
        },
    },
    subcommands: {},
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================


