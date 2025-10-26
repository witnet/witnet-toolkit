const { assets } = require("@witnet/sdk")

module.exports = {
  legacy: assets,
  requests: require("./requests.cjs"),
  sources: require("./sources.cjs"),
  templates: require("./templates.cjs"),
}
