import { Class as Retrieval } from "./retrievals"
import { Class as Reducer, Mode } from "./reducers"

export interface Specs {
    retrieve: Retrieval[];
    aggregate: Reducer;
    tally: Reducer;
    maxSize?: number;
}

export class Class {
    public specs: Specs
    constructor(specs: Specs) {
        this.specs = specs
        if (!specs.retrieve || specs.retrieve.length == 0) {
            throw EvalError("\x1b[1;33mCannot build if no retrievals are specified\x1b[0m")
        }
        specs.retrieve.map((retrieval, index) => {
            if (retrieval === undefined) {
                throw EvalError(`\x1b[1;31mRetrieval #${index}\x1b[1;33m: undefined\x1b[0m`)
            } else if (!(retrieval instanceof Retrieval)) {
                throw EvalError(`\x1b[1;31mRetrieval #${index}\x1b[1;33m: invalid type\x1b[0m`)
            }
        })
        this.specs.maxSize = specs?.maxSize || 0
    }
}

export class Template extends Class {
    public argsCount: number;
    public tests?: Map<string, string[][]>;
    constructor(specs: { 
            retrieve: Retrieval[], 
            aggregate?: Reducer, 
            tally?: Reducer,
        },
        tests?: Map<string, string[][]>
    ) {
        super({
            retrieve: specs.retrieve,
            aggregate: specs?.aggregate || Mode(),
            tally: specs?.tally || Mode(),
        })
        this.argsCount = specs.retrieve.map(retrieval => retrieval?.argsCount).reduce((prev, curr) => Math.max(prev, curr), 0)
        if (this.argsCount == 0) {
            throw EvalError("\x1b[1;33mCannot build Template if provided retrievals require no arguments\x1b[0m")
        }
        this.tests = tests
        if (tests) {
            Object.keys(tests).map(test => {
                const testArgs: string[][] | undefined = Object(tests)[test]
                if (testArgs?.length != specs.retrieve.length) {
                    throw EvalError(`\x1b[1;33mArguments mismatch in test \x1b[1;31m'${test}'\x1b[1;33m: ${testArgs?.length} tuples given vs. ${specs.retrieve.length} expected\x1b[0m`)
                } else {
                    testArgs.map((subargs, index)=> {
                        if (subargs.length != specs.retrieve[index].argsCount) {
                            throw EvalError(`\x1b[1;33mArguments mismatch in test \x1b[1;31m'${test}'\x1b[1;33m: \x1b[1;37mRetrieval #${index}\x1b[1;33m: ${subargs?.length} parameters given vs. ${specs.retrieve[index].argsCount} expected\x1b[0m`)
                        }
                    })
                }
            })
        }
    }
}

export class Parameterized extends Class {
    public args: string[][]
    constructor(template: Template, args: string[][]) {
        super(template.specs)
        this.specs.retrieve.map((retrieve, index) => {
            if (args[index].length !== retrieve.argsCount) {
                throw EvalError(`\x1b[1;31mRetrieval #${index}\x1b[1;33m: parameters mismatch: ${args[index].length} given vs. ${retrieve.argsCount} required\x1b[0m`)
            }
        })
        this.args = args
    }
}

export class Precompiled extends Class {
    constructor(specs: { retrieve: Retrieval[], aggregate?: Reducer, tally?: Reducer }) {
        super({
            retrieve: specs.retrieve,
            aggregate: specs?.aggregate || Mode(),
            tally: specs?.tally || Mode(),
        })
        let argsCount = specs.retrieve.map(retrieval => retrieval.argsCount).reduce((prev, curr) => prev + curr)
        if (argsCount > 0) {
            throw EvalError("\x1b[1;33mStatic requests cannot be built if provided retrievals require parameters\x1b[0m")
        }
    }
}
