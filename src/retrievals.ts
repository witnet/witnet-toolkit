import graphQlCompress from "graphql-query-compress"

import { Script, RadonString } from "./types"
import { getMaxArgsIndexFromString, parseURL } from "./utils"

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
            this.url = specs.url
            let parts = parseURL(specs.url)
            this.schema = parts[0]
            if (parts[1] !== "") this.authority = parts[1]
            if (parts[2] !== "") this.path = parts[2]
            if (parts[3] !== "") this.query = parts[3]
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
export const HttpGet = (specs: {
    url: string,
    headers?: Map<string, string>,
    script?: Script,
    tuples?: Map<string, string[]>
}) => new Class(Methods.HttpGet, { url: specs.url, headers: specs.headers, script: specs.script, tuples: specs.tuples });
export const HttpPost = (specs?: {
    url: string,
    body: string,
    headers?: Map<string, string>,
    script?: Script,
    tuples?: Map<string, string[]>   
}) => new Class(Methods.HttpPost, { url: specs?.url, headers: specs?.headers, body: specs?.body, script: specs?.script, tuples: specs?.tuples })
export const GraphQLQuery = (specs: { 
    url: string, 
    query: string, 
    script?: Script,  
    tuples?: Map<string, string[]>,
}) => {
    return new Class(Methods.HttpPost, {
        url: specs.url, 
        body: `{\"query\":\"${graphQlCompress(specs.query).replaceAll('"', '\\"')}\"}`,
        script: specs?.script || new RadonString(),
        tuples: specs?.tuples
    })
}
