/* eslint-disable no-unused-vars */

const Witnet = require("witnet-toolkit")
const retrievals = require("./retrievals")

module.exports = {
  /// //// REQUEST TEMPLATES ///////////////////////////////////////////////////////
  // path: { ... path: {
  //      WitOracleRequestTemplateXXX: Witnet.RequestTemplate({
  //          retrieve: [ 
  //              retrievals..XX1,
  //              // ...
  //              retrievals..XX2.foldArgs(...args: string[]),
  //              // ...
  //              Witnet.Radon.Retrievals..
  //              // ...
  //          ],
  //          aggregate?: Witnet.Radon.Reducers..,
  //          tally?: Witnet.Radon.Reducers..,
  //          tests?: {
  //              "test-description-1": [
  //                  [ "..", ... ], // source #0 args (string[])
  //                  ...
  //              ],
  //              ...
  //          }
  //      }),
  //      WitOracleRequestTemplateYYY: Witnet.RequestTemplate({
  //          retrieve: retrievals..YY1.spawnRetrievals(argIndex = 0, ...values: string[])
  //          aggregate?: Witnet.Radon.Reducers..,
  //          tally?: Witnet.Radon.Reducers..,
  //      }),  
  //      ...
  // }, ... },
}
