const merge = require("lodash.merge")
const assets = require("../../dist/assets")

module.exports = {
  legacy: {
    requests: merge(assets?.legacy?.requests, require("./requests")),
    retrievals: merge(assets?.legacy?.retrievals, require("./retrievals")),
    templates: merge(assets?.legacy?.templates, require("./templates")),
  },
};
