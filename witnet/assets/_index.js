const { legacy } = require("witnet-toolkit/assets")
const merge = require("lodash.merge")
module.exports = {
  legacy: {
    requests: merge(legacy?.requests, require("./requests")),
    retrievals: merge(legacy?.retrievals, require("./retrievals")),
    templates: merge(legacy?.templates, require("./templates")),
  },
}