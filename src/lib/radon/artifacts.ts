import { decode as cborDecode } from 'cbor'

import {
    execRadonBytecode,
    fromHexString,
    isHexString,
    parseURL,
    toHexString,
    utf8ArrayToStr,
} from "../../bin/helpers"

import { sha256 } from "../crypto/utils"
import { parseRadonScript } from "./utils"

import { RadonFilter } from "./filters"
import { RadonReducer, Mode } from "./reducers"
import { RadonCCDR, RadonRetrieval } from "./retrievals"

const protoBuf = require("protobufjs").Root.fromJSON(require("../../../witnet/witnet.proto.json"))
const RADRequest = protoBuf.lookupType("RADRequest")

export type Args = string[] | string[][];

export interface Specs {
    retrieve: RadonRetrieval[];
    aggregate: RadonReducer;
    tally: RadonReducer;
}

class Class {    
    
    public readonly retrieve: RadonRetrieval[];
    public readonly aggregate: RadonReducer;
    public readonly tally: RadonReducer;
    
    constructor(specs: Specs) {
        if (!specs.retrieve || !Array.isArray(specs.retrieve) || specs.retrieve.length == 0) {
            throw TypeError("RadonArtifact: cannot build if no retrievals are passed")
        }
        specs.retrieve?.forEach((retrieval, index) => {
            if (retrieval === undefined) {
                throw TypeError(`RadonArtifact: retrieval #${index} is undefined`)
            } else if (!(retrieval instanceof RadonRetrieval)) {
                throw TypeError(`RadonArtifact: retrieval #${index}: invalid type`)
            }
        })
        this.retrieve = specs.retrieve;
        this.aggregate = specs.aggregate;
        this.tally = specs.tally;
    }

    public opsCount(): number {
        return (this.retrieve?.map(retrieval => retrieval.opsCount()).reduce((sum, a) => sum + a) || 0)
            + this.aggregate?.opsCount()
            + this.tally?.opsCount()
    }
}

export class RadonRequest extends Class {   
   
    /**
     * Decodes a RadonRequest artifact out from a Protobuf-serialized bytecode.
     * @param bytecode Radon request bytecode.
     * @returns RadonRequest object.
     */
    public static fromBytecode(bytecode: any) {
        let buffer
        if (isHexString(bytecode)) {
            buffer = fromHexString(bytecode)
        } else if (bytecode instanceof Uint8Array) {
            buffer = Buffer.from(bytecode)
        } else if (bytecode instanceof Buffer) {
            buffer = bytecode
        } else {
            throw new TypeError(`RadonRequest: unsupported bytecode format: ${bytecode}`)
        }
        const obj: any = RADRequest.decode(buffer)
        const retrieve = obj.retrieve.map((retrieval: any) => {
            const specs: any = {}
            if (retrieval?.url) { specs.url = retrieval.url }
            if (retrieval?.headers) {
                specs.headers = retrieval.headers.map((stringPair: any) => [
                    stringPair.left,
                    stringPair.right
                ])
            }
            if (retrieval?.body && retrieval.body.length > 0) {
                specs.body = utf8ArrayToStr(Object.values(retrieval.body))
            }
            if (retrieval?.script) specs.script = parseRadonScript(toHexString(retrieval.script))
            return new RadonRetrieval(retrieval.kind, specs)
        })
        const decodeFilter = (f: any) => {
            if (f?.args && f.args.length > 0) return new RadonFilter(f.op, cborDecode(f.args))
            else return new RadonFilter(f.op);
        }
        return new RadonRequest({
            retrieve,
            aggregate: new RadonReducer(obj.aggregate.reducer, obj.aggregate.filters?.map(decodeFilter)),
            tally: new RadonReducer(obj.tally.reducer, obj.tally.filters?.map(decodeFilter))
        })
    }

    public static fromCCDR(
            ccdr: RadonCCDR, 
            providers: string[], 
            args: string[],
            tally?: RadonReducer
        ): RadonRequest
    {
        if (!(ccdr instanceof RadonCCDR)) {
            throw new TypeError(
                `RadonRequest: cannot create from ${
                    (ccdr as any)?.constructor ? `instance of ${(ccdr as any).constructor.name}.` : `object: ${ccdr}`
                }`
            )
        }
        const template = RadonTemplate.fromCCDR({ ccdr, providers, tally })
        return template.buildRequestModal(...args)
    }
    
    constructor(specs: { 
        retrieve: RadonRetrieval | RadonRetrieval[], 
        aggregate?: RadonReducer, 
        tally?: RadonReducer,
    }) {
        const retrieve = Array.isArray(specs.retrieve) ? specs.retrieve as RadonRetrieval[] : [ specs.retrieve ]
        super({
            retrieve,
            aggregate: specs?.aggregate || Mode(),
            tally: specs?.tally || Mode(),
        })
        let argsCount = retrieve.map(retrieval => retrieval.argsCount).reduce((prev, curr) => prev + curr)
        if (argsCount > 0) {
            throw TypeError("RadonRequest: parameterized retrievals were passed")
        }
    }

    protected _encode(): Buffer {
        const payload = this.toProtobuf()
        const errMsg = RADRequest.verify(payload)
        if (errMsg) {
            throw Error(errMsg);
        } else {
            const message = RADRequest.fromObject(payload);
            return RADRequest.encode(message).finish()
        }
    }
    
    public async execDryRun(): Promise<string> {
        return (await execRadonBytecode(this.toBytecode(), '--json')).trim()
    }
    
    public radHash(): string {
        return toHexString(sha256(this._encode()))//.slice(0, 40)
    }
    
    public toBytecode(): string {
        return toHexString(this._encode())//encodeRADRequest(this.toProtobuf()), true)
    }

    public toJSON(humanize?: boolean): any {
        return {
            retrieve: this.retrieve.map(retrieval => retrieval.toJSON(humanize)),
            aggregate: this.aggregate.toJSON(humanize),
            tally: this.tally.toJSON(humanize),
            ...(humanize ? {} : { time_lock: 0 }),
        }
    }
    
    public toProtobuf(): any {
        return {
            //timeLock: 0,
            retrieve: this.retrieve.map(retrieval => retrieval.toProtobuf()),
            aggregate: this.aggregate.toProtobuf(),
            tally: this.tally.toProtobuf(),
        }
    }

    public weight(): number {
        return this.toBytecode().slice(2).length / 2;
    }
}

export class RadonTemplate extends Class {
    public readonly argsCount: number;
    public readonly homogeneous: boolean;
    public readonly samples?: Record<string, Args>;

    public static fromCCDR(
            specs: {
                ccdr: RadonCCDR, 
                providers: string[], 
                tally?: RadonReducer
            }, 
            samples?: Record<string, Args>,
        ): RadonTemplate
    {
        if (!(specs.ccdr instanceof RadonCCDR)) {
            throw new TypeError(
                `RadonRequest: cannot create from ${
                    (specs.ccdr as any)?.constructor ? `instance of ${(specs.ccdr as any).constructor.name}.` : `from object: ${specs.ccdr}`
                }`
            )
        }
        if (specs.ccdr.argsCount < 2) {
            throw TypeError(`RadonTemplate.fromCCDR: requires parameterized CCDR.`)
        }
        specs.providers.forEach(provider => {
            const [schema, ] = parseURL(provider)
            if (!schema.startsWith("http://") && !schema.startsWith("https://")) {
                throw TypeError(`RadonTemplate.fromCCDR: invalid provider: ${provider}`)
            }
        })
        return new RadonTemplate({
            retrieve: specs.ccdr.spawnRetrievals(...specs.providers),
            aggregate: Mode(),
            tally: specs.tally || Mode(),
        }, samples)
    }
    
    constructor(
        specs: { 
            retrieve: RadonRetrieval | RadonRetrieval[], 
            aggregate?: RadonReducer, 
            tally?: RadonReducer,
        },
        samples?: Record<string, Args>
    ) {
        const retrieve = Array.isArray(specs.retrieve) ? specs.retrieve as RadonRetrieval[] : [ specs.retrieve ]
        super({
            retrieve,
            aggregate: specs?.aggregate || Mode(),
            tally: specs?.tally || Mode(),
        })
        this.argsCount = retrieve.map(retrieval => retrieval?.argsCount).reduce((prev, curr) => Math.max(prev, curr), 0)
        if (this.argsCount == 0) {
            throw TypeError("RadonTemplate: no parameterized retrievals were passed")
        }
        this.homogeneous = !retrieve.find(retrieval => retrieval.argsCount !== this.argsCount)
        if (samples) {
            Object.keys(samples).forEach(sample => {
                let sampleArgs: Args = Object(samples)[sample]
                if (typeof sampleArgs === "string") {
                    sampleArgs =  [ sampleArgs ] 
                }
                if (sampleArgs.length > 0) {
                    if (!Array.isArray(sampleArgs[0])) {
                        Object(samples)[sample] = Array(retrieve.length).fill(sampleArgs)
                        sampleArgs = Object(samples)[sample]
                    } else if (sampleArgs?.length != retrieve.length) {
                        throw TypeError(`RadonTemplate: arguments mismatch in sample "${sample}": ${sampleArgs?.length} tuples given vs. ${retrieve.length} expected`)
                    }
                    sampleArgs?.forEach((subargs, index)=> {
                        if (subargs.length < retrieve[index].argsCount) {
                            throw TypeError(`\x1b[1;33mRadonRequestTemplate: arguments mismatch in test \x1b[1;31m'${sample}'\x1b[1;33m: \x1b[1;37mRetrieval #${index}\x1b[1;33m: ${subargs?.length} parameters given vs. ${retrieve[index].argsCount} expected\x1b[0m`)
                        }
                    })
                }
            })
            this.samples = samples
        }
    }

    public buildRequest(...args: string[][]): RadonRequest {
        const retrieve: RadonRetrieval[] = []
        if (args.length !== this.retrieve.length) {
            throw new TypeError(`RadonRequest: mismatching args vectors (${args.length} != ${this.retrieve.length}): [${args}]}`)
        }
        this.retrieve.forEach((retrieval, index) => {
            if (retrieval.argsCount !== args[index].length) {
                throw new TypeError(`RadonRequest: mismatching args passed to retrieval #${index + 1} (${args[index].length} != ${retrieval.argsCount}): [${args[index]}]`)
            }
            retrieve.push(retrieval.foldArgs(...args[index]))
        })
        return new RadonRequest({
            retrieve,
            aggregate: this.aggregate,
            tally: this.tally,
        })
    }

    public buildRequestModal(...args: string[]): RadonRequest {
        const retrieve: RadonRetrieval[] = []
        this.retrieve.forEach((retrieval, index) => {
            if (retrieval.argsCount !== args.length) {
                throw new TypeError(`RadonRequest: mismatching args passed to retrieval #${index + 1} (${args.length} != ${retrieval.argsCount}): [${args}]`)
            }
            retrieve.push(retrieval.foldArgs(...args))
        })
        return new RadonRequest({
            retrieve,
            aggregate: this.aggregate,
            tally: this.tally,
        })
    }
}
