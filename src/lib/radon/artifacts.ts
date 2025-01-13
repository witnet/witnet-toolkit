import { RadonRetrieval } from "./retrievals"
import { RadonReducer, Mode } from "./reducers"
import * as Utils from '../utils'

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
            throw EvalError("\x1b[1;33mArtifact: cannot build if no sources are specified\x1b[0m")
        }
        specs.retrieve?.forEach((retrieval, index) => {
            if (retrieval === undefined) {
                throw EvalError(`\x1b[1;31mArtifact: RadonRetrieval #${index}\x1b[1;33m: undefined\x1b[0m`)
            } else if (!(retrieval instanceof RadonRetrieval)) {
                throw EvalError(`\x1b[1;31mArtifact: RadonRetrieval #${index}\x1b[1;33m: invalid type\x1b[0m`)
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
    
    public static from(hexString: string) {
        return Utils.decodeRequest(hexString)
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
            throw EvalError("\x1b[1;33mRadonRequest: parameterized retrievals were passed\x1b[0m")
        }
    }
    
    public async execDryRun(): Promise<string> {
        return (await Utils.execDryRun(this.toBytecode(), '--json')).trim()
    }
    
    public radHash(): string {
        return Utils.sha256(Utils.encodeRequest(this.toProtobuf()))//.slice(0, 40)
    }
    
    public toBytecode(): string {
        return Utils.toHexString(Utils.encodeRequest(this.toProtobuf()))
    }

    public toJSON(): any {
        return {
            retrieve: this.retrieve.map(retrieval => retrieval.toJSON()),
            aggregate: this.aggregate.toJSON(),
            tally: this.tally.toJSON(),
        }
    }
    
    public toProtobuf(): any {
        return {
            time_lock: 0,
            retrieve: this.retrieve.map(retrieval => retrieval.toProtobuf()),
            aggregate: this.aggregate.toProtobuf(),
            tally: this.tally.toProtobuf(),
        }
    }

    public weight(): number {
        return this.toBytecode().slice(2).length / 2;
    }
}

export class RadonRequestTemplate extends Class {
    public readonly argsCount: number;
    public readonly tests?: Map<string, Args>;
    constructor(specs: { 
            retrieve: RadonRetrieval | RadonRetrieval[], 
            aggregate?: RadonReducer, 
            tally?: RadonReducer,
        },
        tests?: Map<string, Args>
    ) {
        const retrieve = Array.isArray(specs.retrieve) ? specs.retrieve as RadonRetrieval[] : [ specs.retrieve ]
        super({
            retrieve,
            aggregate: specs?.aggregate || Mode(),
            tally: specs?.tally || Mode(),
        })
        this.argsCount = retrieve.map(retrieval => retrieval?.argsCount).reduce((prev, curr) => Math.max(prev, curr), 0)
        if (this.argsCount == 0) {
            throw EvalError("\x1b[1;33mRadonRequestTemplate: no parameterized retrievals were passed\x1b[0m")
        }
        if (tests) {
            Object.keys(tests).forEach(test => {
                let testArgs: Args = Object(tests)[test]
                if (typeof testArgs === "string") {
                    testArgs =  [ testArgs ] 
                }
                if (testArgs.length > 0) {
                    if (!Array.isArray(testArgs[0])) {
                        Object(tests)[test] = Array(retrieve.length).fill(testArgs)
                        testArgs = Object(tests)[test]
                    } else if (testArgs?.length != retrieve.length) {
                        throw EvalError(`\x1b[1;33mRadonRequestTemplate: arguments mismatch in test \x1b[1;31m'${test}'\x1b[1;33m: ${testArgs?.length} tuples given vs. ${retrieve.length} expected\x1b[0m`)
                    }
                    testArgs?.forEach((subargs, index)=> {
                        if (subargs.length < retrieve[index].argsCount) {
                            throw EvalError(`\x1b[1;33mRadonRequestTemplate: arguments mismatch in test \x1b[1;31m'${test}'\x1b[1;33m: \x1b[1;37mRetrieval #${index}\x1b[1;33m: ${subargs?.length} parameters given vs. ${retrieve[index].argsCount} expected\x1b[0m`)
                        }
                    })
                }
            })
            this.tests = tests
        }
    }

    public buildRequest(...args: string[][]): RadonRequest {
        const retrieve: RadonRetrieval[] = []
        if (args.length !== this.retrieve.length) {
            throw new EvalError(`\x1b[1;33mRadonRequest: mismatching args vectors (${args.length} != ${this.retrieve.length}): [${args}]}\x1b[0m`)
        }
        this.retrieve.forEach((retrieval, index) => {
            if (retrieval.argsCount !== args[index].length) {
                throw new EvalError(`\x1b[1;33mRadonRequest: mismatching args passed to retrieval #${index + 1} (${args[index].length} != ${retrieval.argsCount}): [${args[index]}]\x1b[0m`)
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
                throw new EvalError(`\x1b[1;33mRadonRequest: mismatching args passed to retrieval #${index + 1} (${args.length} != ${retrieval.argsCount}): [${args}]\x1b[0m`)
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
