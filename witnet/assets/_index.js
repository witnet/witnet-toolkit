const legacy = require("witnet-toolkit/assets").legacy
module.exports = {
  legacy: {
    requests: { ...legacy.requests, ...require("./requests") },
    retrievals: { ...legacy.retrievals, ...require("./retrievals") },
    templates: { ...legacy.templates, ...require("./templates") },
  },
}
