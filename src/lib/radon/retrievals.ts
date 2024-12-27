const cbor = require("cbor")
const helpers = require("./helpers")

import * as _RPCS from "./rpcs"

import graphQlCompress from "graphql-query-compress"
import { RadonAny, RadonScriptWrapper as RadonScript } from "./types"
import { JsonRPC } from "./rpcs"

/**
 * Precompiled Remote Procedure Calls that can be included within
 * Cross Chain Data Requests (i.e. `Witnet.Retrievals.CCDR({ .. })`, 
 * grouped by supported JSON-RPC protocol: E
 * - JSON ETH-RPC 
 * - JSON WIT-RPC 
 */
export const RPCs: typeof _RPCS = _RPCS;

export enum Methods {
    None = 0x0,
    HttpGet = 0x01,
    HttpHead = 0x04,
    HttpPost = 0x03,
    RNG = 0x02,
}

export interface Specs {
    url?: string,
    headers?: Map<string, string>,
    body?: string,
    script?: RadonAny,
}

export class RadonRetrieval {
    public readonly argsCount: number;
    public readonly method: Methods;
    public readonly authority?: string;
    public readonly body?: string;
    public readonly headers?: string[][];
    public readonly path?: string;
    public readonly query?: string;
    public readonly schema?: string;
    public readonly script?: RadonScript;
    public readonly url?: string;
    
    constructor(method: Methods, specs?: Specs) {
        if (method === Methods.RNG && (specs?.url || specs?.headers?.size || specs?.body)) {
            console.log(specs)  
            throw EvalError("\x1b[1;33mRadonRetrieval: badly specified RNG\x1b[0m");
        } else if (!specs?.url && (method == Methods.HttpPost || method == Methods.HttpGet)) {
            throw EvalError("\x1b[1;33mRadonRetrieval: URL must be specified\x1b[0m");
        } else if (specs?.body && method == Methods.HttpGet) {
            throw EvalError("\x1b[1;33mRadonRetrieval: body cannot be specified in HTTP-GET queries\x1b[0m")
        }
        this.method = method
        if (specs?.url) {
            this.url = specs.url
            if (!helpers.isWildcard(specs.url)) {
                let parts = helpers.parseURL(specs.url)
                this.schema = parts[0]
                if (parts[1] !== "") this.authority = parts[1]
                if (parts[2] !== "") this.path = parts[2]
                if (parts[3] !== "") this.query = parts[3]
            }
        }
        if (specs?.headers) {
            this.headers = []
            if (specs.headers instanceof Map) {
                specs.headers.forEach((value: string, key: string) => this.headers?.push([key, value]))
            } else {
                // this.headers = specs.headers
                Object.entries(specs.headers).forEach((entry: any) => this.headers?.push(entry))
            }
        }
        this.body = specs?.body
        if (specs?.script) this.script = new RadonScript(specs?.script)
        this.argsCount = Math.max(
            helpers.getWildcardsCountFromString(this?.url),
            helpers.getWildcardsCountFromString(this?.body),
            ...this.headers?.map(header => helpers.getWildcardsCountFromString(header[1])) ?? [],
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
            throw new EvalError(`\x1b[1;33mRadonRetrieval: cannot fold unparameterized retrieval\x1b[0m`)
        } else if (args.length > this.argsCount) {
            throw new EvalError(`\x1b[1;33mRadonRetrieval: too may args passed: ${args.length} > ${this.argsCount}\x1b[0m`)
        }
        let headers: Map<string, string> = new Map();
        if (this.headers) {
            this.headers.forEach(header => {
                headers.set(
                    helpers.replaceWildcards(header[0], args),
                    helpers.replaceWildcards(header[1], args),
                )
            })
        }
        return new RadonRetrieval(this.method, {
            url: helpers.replaceWildcards(this.url, args),
            body: helpers.replaceWildcards(this.body, args),
            headers,
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
            throw new EvalError(`\x1b[1;33mRadonRetrieval: cannot spawn from unparameterized retrieval\x1b[0m`);
        }
        values.forEach(value => {
            let headers: Map<string, string> = new Map()
            if (this.headers) {
                this.headers.forEach(header => {
                    headers.set(
                        helpers.spliceWildcard(header[0], 0, value, this.argsCount),
                        helpers.spliceWildcard(header[1], 0, value, this.argsCount),
                    )
                })
            }
            _spawned.push(new RadonRetrieval(this.method, {
                url: helpers.spliceWildcard(this.url, 0, value, this.argsCount),
                body: helpers.spliceWildcard(this.body, 0, value, this.argsCount),
                headers, 
                script: this.script?.spliceWildcard(0, value)
            }))
        })
        return _spawned
    }

    public toJSON(): any {
        let json: any = {
            kind: Methods[this.method],
        }
        if (this.url) json.url = this.url
        if (this.headers && this.headers.length > 0) {
            json.headers = this.headers.map(header => { var obj: any = {}; obj[header[0]] = header[1]; return obj; })
        }
        if (this.body) json.body = this.body
        if (this.script) json.script = this.script.toString()
        return json
    }

    public toProtobuf(): any {
        let protobuf: any = {
            kind: this.method,
        }
        if (this.url) protobuf.url = this.url
        if (this.headers && this.headers.length > 0) {
            protobuf.headers = this.headers.map(header => { return { left: header[0], right: header[1] }})
        }
        if (this.body) {
            var utf8Array = helpers.toUtf8Array(this.body)
            protobuf.body = utf8Array
        }
        protobuf.script = Object.values(Uint8Array.from(cbor.encode(this.script?.encode())))
        return protobuf
    }

    public opsCount(): any {
        return countOps(this.script?.encode() || [])
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
        throw new EvalError("RNG script must expect a [RadonBytes] value as input")
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
    headers?: Map<string, string>,
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
    headers?: Map<string, string>,
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
    headers?: Map<string, string>,
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
        headers: new Map<string,string>().set("Content-Type", "application/json;charset=UTF-8"),
        script: specs?.script,
    });
};

/**
 * Creates a Cross Chain RPC retrieval on top of a HTTP/POST request.
 * @param specs rpc: JsonRPC object encapsulating method and parameters, 
 *              script?: RadonScript to apply to returned value
 *              presets?: Map containing preset parameters (only on parameterized retrievals).
 */
export function CrossChainRPC  (specs: {
    rpc: JsonRPC,
    script?: RadonAny
}) {
    return new RadonRetrieval(Methods.HttpPost, {
        url: "\\0\\",
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: specs.rpc.method,
            params: specs.rpc?.params,
            id: 1,
        }).replaceAll('\\\\', '\\'),
        headers: new Map<string,string>().set("Content-Type", "application/json;charset=UTF-8"),
        script: specs?.script,
    });
};
