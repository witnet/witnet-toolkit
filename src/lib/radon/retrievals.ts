import { encode as cborEncode } from "cbor"
const helpers = require("../../bin/helpers")

import graphQlCompress from "graphql-query-compress"
import { RadonAny, RadonScript } from "./types"
import { CrossChainRPC } from "./ccdr"

/**
 * Precompiled Remote Procedure Calls that can be included within
 * Cross Chain Data Requests (i.e. `Witnet.Retrievals.CCDR({ .. })`, 
 * grouped by supported JSON-RPC protocol: E
 * - JSON ETH-RPC 
 * - JSON WIT-RPC 
 */
export * as RPC from "./ccdr"

export enum Methods {
    None = 0x0,
    HttpGet = 0x01,
    HttpHead = 0x04,
    HttpPost = 0x03,
    RNG = 0x02,
}

export interface Specs {
    url?: string,
    headers?: Record<string, string>,
    body?: string,
    script?: RadonAny,
}

export class RadonRetrieval {
    
    public readonly argsCount: number;
    public readonly method: Methods;
    public readonly authority?: string;
    public readonly body?: string;
    public readonly headers?: Record<string, string>;
    public readonly path?: string;
    public readonly query?: string;
    public readonly schema?: string;
    public readonly script?: RadonScript;
    public readonly url?: string;
    
    constructor(method: Methods, specs?: Specs) {
        if (method === Methods.RNG && (specs?.url || specs?.headers?.size || specs?.body)) {
            throw TypeError("RadonRetrieval: RNG accepts no URLs or headers");
        } else if (!specs?.url && (method == Methods.HttpPost || method == Methods.HttpGet)) {
            throw TypeError("RadonRetrieval: URL must be specified");
        } else if (specs?.body && method == Methods.HttpGet) {
            throw TypeError("RadonRetrieval: body cannot be specified in HTTP-GET queries")
        }
        this.method = method
        if (specs?.url) {
            this.url = specs.url
            if (!helpers.isWildcard(specs.url)) {
                try {
                    let parts = helpers.parseURL(specs.url)
                    this.schema = parts[0]
                    if (parts[1] !== "") this.authority = parts[1]
                    if (parts[2] !== "") this.path = parts[2]
                    if (parts[3] !== "") this.query = parts[3]
                } catch {}
            }
        }
        this.headers = specs?.headers
        this.body = specs?.body
        if (specs?.script) this.script = new RadonScript(specs?.script)
        this.argsCount = Math.max(
            helpers.getWildcardsCountFromString(this?.url),
            helpers.getWildcardsCountFromString(this?.body),
            ...Object.keys(this?.headers || {}).map(key => helpers.getWildcardsCountFromString(key)) ?? [],
            ...Object.values(this?.headers || {}).map(value => helpers.getWildcardsCountFromString(value)) ?? [],
            this.script?.argsCount() || 0,
        )
    }
    
    public isParameterized(): boolean {
        return this.argsCount > 0
    }
    
    /**
     * Creates a new Radon Retrieval by orderly replacing indexed wildcards with given parameters.
     * Fails if not parameterized, of if passing too many parameters. 
     */
    public foldArgs(...args: string[]): RadonRetrieval {
        if (this.argsCount === 0) {
            throw new TypeError(`RadonRetrieval: cannot fold unparameterized retrieval`)
        } else if (args.length > this.argsCount) {
            throw new TypeError(`RadonRetrieval: too may args passed: ${args.length} > ${this.argsCount}`)
        }
        return new RadonRetrieval(this.method, {
            url: helpers.replaceWildcards(this.url, args),
            body: helpers.replaceWildcards(this.body, args),
            headers: Object.fromEntries(Object.entries(this.headers || {}).map(([key, value]) => [
                helpers.replaceWildcards(key, args),
                helpers.replaceWildcards(value, args),
            ])),
            script: this.script?.replaceWildcards(...args),
        })
    }
    /**
     * Creates one or more clones of this retrieval, in which the index-0 wildcard
     * will be replaced by the given values. Fails if the retrieval is not parameterized.
     */
    public spawnRetrievals(...values: string[]): RadonRetrieval[] {
        const _spawned: RadonRetrieval[] = []
        if (this.argsCount == 0) {
            throw new TypeError(`RadonRetrieval: cannot spawn from unparameterized retrieval`);
        }
        values.forEach(value => {
            _spawned.push(new RadonRetrieval(this.method, {
                url: helpers.spliceWildcard(this.url, 0, value, this.argsCount),
                body: helpers.spliceWildcard(this.body, 0, value, this.argsCount),
                headers: Object.fromEntries(Object.entries(this.headers || {}).map(([headerKey, headerValue]) => [
                    helpers.spliceWildcard(headerKey, 0, value, this.argsCount),
                    helpers.spliceWildCard(headerValue, 0, value, this.argsCount),
                ])),
                script: this.script?.spliceWildcard(0, value)
            }))
        })
        return _spawned
    }

    public toJSON(humanize?: boolean): any {
        const Kinds = [ "", "HTTP-GET", "RNG", "HTTP-POST", "HTTP-HEAD" ]
        let json: any = {
            kind: Kinds[this.method] // humanize ? Methods[this.method] : this.method,
        }
        if (this.url) json.url = this.url
        if (this.headers) {
            json.headers = this.headers;
        }
        if (this.body) json.body = this.body
        json.script = humanize ? this.script?.toString() : Array.from(helpers.fromHexString(this.script?.toBytecode() || '0x80'))
        return json
    }

    public toProtobuf(): any {
        let protobuf: any = {
            kind: this.method,
        }
        if (this.url) protobuf.url = this.url
        if (this.headers) {
            protobuf.headers = Object.entries(this.headers).map(([headerKey, headerValue]) => { return { 
                left: headerKey, 
                right: headerValue,
            }})
        }
        if (this.body) {
            const utf8Array = helpers.toUtf8Array(this.body)
            protobuf.body = utf8Array
        }
        protobuf.script = Object.values(Uint8Array.from(cborEncode(this.script?.encode() || [])))
        return protobuf
    }

    public opsCount(): any {
        return countOps(this.script?.encode() || [])
    }
}

export class RadonCCDR extends RadonRetrieval {
    constructor (rpc: CrossChainRPC, script?: RadonAny) {
        super(Methods.HttpPost, {
            url: "\\0\\",
            body: JSON.stringify({
                jsonrpc: "2.0",
                methods: rpc.method,
                params: rpc?.params,
                id: 1,
            }).replaceAll('\\\\', '\\'),
            headers: { "Content-Type": "application/json;charset=UTF-8" },
            script
        })
    }
    public isParameterized(): boolean {
        return this.argsCount > 1
    }
}

function countOps(items: any[]): number {
    return items.length > 0 ? items.map(item => Array.isArray(item) ? countOps(item) : 1).reduce((sum, a) => sum + a) : 0
}

/**
 * Creates a Witnet randomness Radon RadonRetrieval.
 * @param script (Optional) Radon Script to apply to the random seed proposed by every single witness, 
 * before aggregation.
  */
export function RNG (script?: RadonAny) { 
    const retrieval = new RadonRetrieval(Methods.RNG, { script }); 
    if (retrieval?.script && retrieval?.script?.inputType?.constructor.name !== "RadonBytes") {
        throw new TypeError("RNG scripts require [RadonBytes] as input type")
    }
    return retrieval
};

/**
 * Creates a Witnet HTTP/GET Radon RadonRetrieval.
 * @param specs RadonRetrieval parameters: URL, http headers (optional), Radon script (optional), 
 * pre-set tuples (optional to parameterized sources, only).
 */
export function HttpGet (specs: {
    url: string,
    headers?: Record<string, string>,
    script?: RadonAny,
    tuples?: Map<string, string[]>
}) {
    return new RadonRetrieval(
        Methods.HttpGet, { 
            url: specs.url, 
            headers: specs.headers, 
            script: specs.script, 
        }
    );
};

/**
 * Creates a Witnet HTTP/HEAD Radon RadonRetrieval.
 * @param specs RadonRetrieval parameters: URL, http headers (optional), Radon script (optional), 
 * pre-set tuples (optional to parameterized sources, only).
 */
export function HttpHead (specs: {
    url: string,
    headers?: Record<string, string>,
    script?: RadonAny,
}) {
    return new RadonRetrieval(
        Methods.HttpHead, { 
            url: specs.url, 
            headers: specs.headers, 
            script: specs.script, 
        }
    );
};

/**
 * Creates a Witnet HTTP/POST Radon RadonRetrieval.
 * @param specs RadonRetrieval parameters: URL, HTTP body (optional), HTTP headers (optional), Radon Script (optional), 
 * pre-set tuples (optional to parameterized sources, only).
 */
export function HttpPost (specs?: {
    url: string,
    body: string,
    headers?: Record<string, string>,
    script?: RadonAny,
}) {
    return new RadonRetrieval(
        Methods.HttpPost, { 
            url: specs?.url, 
            headers: specs?.headers, 
            body: specs?.body, 
            script: specs?.script, 
        }
    );
};

/**
 * Creates a Witnet GraphQL Radon RadonRetrieval (built on top of an HTTP/POST request).
 * @param specs RadonRetrieval parameters: URL, GraphQL query string, Radon Script (optional), 
 * pre-set tuples (optional to parameterized sources, only).
 */
export function GraphQLQuery (specs: { 
    url: string, 
    query: string, 
    script?: RadonAny,  
}) {
    return new RadonRetrieval(Methods.HttpPost, {
        url: specs.url, 
        body: `{\"query\":\"${graphQlCompress(specs.query).replaceAll('"', '\\"')}\"}`,
        headers: {
            "Content-Type": "application/json;charset=UTF-8"
        },
        script: specs?.script,
    });
};

/**
 * Creates a Cross Chain Data Retrievals retrieval on top of a HTTP/POST request.
 */
export function CrossChainDataRetrieval(specs : {
    /**
     * CrossChainRPC object encapsulating RPC method and parameters.
     */
    rpc: CrossChainRPC,
    /**
     * RadonScript to reduce returned value.
     */
    script?: RadonAny
}) {
    return new RadonCCDR(specs.rpc, specs.script)
}
