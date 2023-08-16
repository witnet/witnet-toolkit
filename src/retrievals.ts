import graphQlCompress from "graphql-query-compress"

import { Script, String as ScriptString } from "./types"
import { getMaxArgsIndexFromString } from "./utils"

export enum Methods {
    None = 0x0,
    HttpGet = 0x01,
    HttpPost = 0x03,
    RNG = 0x02,
}

export interface Specs {
    url?: string,
    headers?: Map<string, string>,
    body?: string,
    script?: Script,
    tuples?: Map<string, string[]>,
}

export class Class {
    public argsCount: number;
    public authority?: string;
    public body?: string;
    public headers?: string[][];
    public method: Methods;
    public path?: string;
    public query?: string;
    public schema?: string;
    public script?: Script;
    public url?: string;
    public tuples?: Map<string, string[]>;
    constructor(method: Methods, specs?: Specs) {
        if (method === Methods.RNG && (specs?.url || specs?.headers || specs?.body)) {
            throw EvalError("\x1b[1;33mWitnet.Retrievals: badly specified RNG\x1b[0m");
        } else if (!specs?.url && (method == Methods.HttpPost || method == Methods.HttpGet)) {
            throw EvalError("\x1b[1;33mWitnet.Retrievals: URL must be specified\x1b[0m");
        } else if (specs?.body && method == Methods.HttpGet) {
            throw EvalError("\x1b[1;33mWitnet.Retrievals: body cannot be specified here\x1b[0m")
        }
        this.method = method
        this.headers = []
        if (specs?.headers) {
            specs.headers.forEach((value, key) => this.headers?.push([ key, value ]))
        }
        this.body = specs?.body
        this.script = specs?.script
        if (specs?.url) {
            let url 
            try {
                url = new URL(specs?.url || "")
                this.schema = url?.protocol + "//"
                this.authority = url.hostname
                if (url.search !== "") this.query = url.search.slice(1)
                if (url.pathname !== "") this.path = url.pathname.slice(1)
            } catch {}
            this.url = specs.url
        }
        this.argsCount = Math.max(
            getMaxArgsIndexFromString(specs?.url),
            getMaxArgsIndexFromString(specs?.body),
            ...this.headers.map(header => getMaxArgsIndexFromString(header[1])),
            specs?.script?._countArgs() || 0,
        )
        this.tuples = specs?.tuples
    }
}

export const RNG = (script?: any) => new Class(Methods.RNG, { script })
export const HttpGet = (specs?: Specs) => new Class(Methods.HttpGet, specs)
export const HttpPost = (specs?: Specs) => new Class(Methods.HttpPost, specs)
export const GraphQLQuery = (specs: { 
    url: string, 
    query: string, 
    script?: Script,  
    tuples?: Map<string, string[]>,
}) => {
    return new Class(Methods.HttpPost, {
        url: specs.url, 
        body: `{\"query\":\"${graphQlCompress(specs.query).replaceAll('"', '\\"')}\"}`,
        script: specs?.script || new ScriptString(),
        tuples: specs?.tuples
    })
}
