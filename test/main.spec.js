import * as Witnet from '../src/index'

Witnet.Retrievals.HttpGet({ url: "", script: Witnet.Script() }).
Witnet.Retrievals.GraphQLQuery("", "")
Witnet.Retrievals.GraphQLQuery("url", "query", Witnet.Script(Witnet.Types.String))