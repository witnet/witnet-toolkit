const { assets } = require("@witnet/sdk")

module.exports = {
  legacy: assets,
  requests: require("./requests"),
  sources: require("./sources"),
  templates: require("./templates"),
}
