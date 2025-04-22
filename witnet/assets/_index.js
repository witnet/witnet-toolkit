const { assets } = require("witnet-toolkit")

module.exports = {
  legacy: assets,
  requests: require("./requests"),
  sources: require("./sources"),
  templates: require("./templates"),
};
