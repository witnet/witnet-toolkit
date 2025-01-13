///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE CONSTANTS ===========================================================================================

module.exports = {
    flags: {
        start: { 
            hint: "Epoch from which search starts (default: -2048)",
            param: ":epoch",
        },
        end: {
            hint: "Epoch on which search ends (default: -1)",
            param: ":epoch",
        },
        limit: { hint: "Limit output records (default: 100)", param: ":number", },
    },
    router: {
        dataRequests: {
            hint: "Report most successful data requests.",
        },
        validators: {
            hint: "Report most successful validators.",
        },
        witnesses: {
            hint: "Report most successful witnesses.",
        },
    },
    subcommands: {},
};

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// CLI SUBMODULE COMMANDS ============================================================================================


