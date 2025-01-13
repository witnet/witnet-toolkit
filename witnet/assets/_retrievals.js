/* eslint-disable no-unused-vars */

const Witnet = require("witnet-toolkit")

module.exports = {
  // path: { ... path: {
  /// //// HTTP-GET RETRIEVALS /////////////////////////////////////////////////////
  //      RadonRetrievalXX1: Witnet.Radon.Retrievals.HttpGet(
  //          url: "http-or-https://authority/path?query",
  //          headers?: {
  //              "http-header-tag": "http-header-value",
  //              ...,
  //          },
  //          script?: Witnet.Radon.Script()..,
  //      }),
  /// //// HTTP-POST RETRIEVALS ////////////////////////////////////////////////////
  //      RadonRetrievalXX2: Witnet.Radon.Retrievals.HttpPost(
  //          url: "http-or-https://authority/path?query",
  //          body?: "...",
  //          headers?: {
  //              "http-header-tag": "http-header-value",
  //              ...,
  //          },
  //          script?: Witnet.Radon.Script()..,
  //      }),
  /// //// GRAPH-QL QUERIES ////////////////////////////////////////////////////////
  //      RadonRetrievalXX3: Witnet.Radon.Retrievals.GraphQLQuery(
  //          url: "http-or-https://authority/path?query",
  //          query: "...",
  //          headers?: {
  //              "http-header-tag": "http-header-value",
  //              ...,
  //          },
  //          script?: Witnet.Radon.Script()..,
  //      }),
  // }, ... },
}
