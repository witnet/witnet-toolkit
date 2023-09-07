import graphQlCompress from "graphql-query-compress"

import { Script, RadonString } from "./types"
import * as RPC from "./web3"

export { RPC }

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
            if (!isWildcard(specs.url)) {
                let parts = parseURL(specs.url)
                this.schema = parts[0]
                if (parts[1] !== "") this.authority = parts[1]
                if (parts[2] !== "") this.path = parts[2]
                if (parts[3] !== "") this.query = parts[3]
            }
        }
        this.argsCount = Math.max(
            getMaxArgsIndexFromString(specs?.url),
            getMaxArgsIndexFromString(specs?.body),
            ...this.headers.map(header => getMaxArgsIndexFromString(header[1])),
            specs?.script?._countArgs() || 0,
        )
        this.tuples = specs?.tuples
    }
    public spawn(argIndex: number, values: string[]): Class[] {
        let spawned: Class[] = []
        if (this.argsCount == 0) {
            throw new EvalError(`\x1b[1;33mWitnet.Retrievals: cannot spawn over unparameterized retrieval\x1b[0m`);
        } else if (argIndex > this.argsCount) {
            throw new EvalError(`\x1b[1;33mWitnet.Retrievals: spawning parameter index out of range: ${argIndex} > ${this.argsCount}\x1b[0m`);
        }
        values.map(value => {
            let headers: any 
            if (this.headers) {
                this.headers?.map(header => headers[this.spliceWildcards(header[0], argIndex, value)] = this.spliceWildcards(header[1], argIndex, value))
            }
            spawned.push(new Class(this.method, {
                url: this.spliceWildcards(this.url, argIndex, value),
                body: this.spliceWildcards(this.body, argIndex, value),
                headers, 
                script: this.script, // TODO: replace wildcards on scripts
                
            }))
        })
        return spawned
    }
    protected spliceWildcards(str: string | undefined, argIndex: number, argValue: string): string {
        if (str) return spliceWildcards(str, argIndex, argValue, this.argsCount)
        else return "";
    }
}

function spliceWildcards(str: string, argIndex: number, argValue: string, argsCount: number) {
    const wildcard = `\\${argIndex}\\`
    str = str.replaceAll(wildcard, argValue)
    for (var j = argIndex + 1; j < argsCount; j ++) {
        str =str.replaceAll(`\\${j}\\`, `\\${j - 1}\\`)
    }
    return str;
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

export const CrossChainCall = (specs: {
    url: string,
    rpc: RPC.Call,
    script?: Script,
    tuples?: Map<string, string[]>
}) => new Class(Methods.HttpPost, {
    url: specs.url,
    body: JSON.stringify({
        jsonrpc: "2.0",
        method: specs.rpc.method,
        params: specs.rpc?.params,
        id: 1,
    }).replaceAll('\\\\', '\\'),
    script: specs?.script || new RadonString(),
    tuples: specs?.tuples
});
