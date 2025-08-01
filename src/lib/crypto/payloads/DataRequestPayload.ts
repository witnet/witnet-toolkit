const Long = require("long")

import { Root as ProtoRoot } from "protobufjs"
const protoRoot = ProtoRoot.fromJSON(require("../../../../witnet/witnet.proto.json"))

import { fromHexString, toHexString } from "../../../bin/helpers"

import { RadonRequest, RadonTemplate } from "../../radon"
import { Hash, HexString, IJsonRpcProvider } from "../../types"

import { ILedger } from "../interfaces"
import { TransactionPayloadMultiSig } from "../payloads"
import { Coins, PublicKeyHash, TransactionParams, TransactionPriority } from "../types"
import { BigMath, sha256 } from "../utils"

export type DataRequestTemplateArgs = any | string | string[] | string[][]
    
export type DataRequestParams = TransactionParams & {
    args?: DataRequestTemplateArgs,
    maxResultSize?: number,
    witnesses?: number,
}

type DataRequestOutputSLA = {
    collateral: number,
    commitAndRevealFee: number,
    minConsensusPercentage: number,
    witnesses: number,
    witnessReward?: number,
}

const DR_COMMIT_TX_WEIGHT = 400
const DR_REVEAL_TX_WEIGHT = 200
const DR_TALLY_TX_WEIGHT = 100

const DR_TX_WEIGHT_ALPHA = 1
const DR_TX_WEIGHT_BETA = 1

const TX_WEIGHT_INPUT_SIZE = 133
const TX_WEIGHT_OUTPUT_SIZE = 36

export class DataRequestPayload extends TransactionPayloadMultiSig<DataRequestParams> {

    public static DEFAULT_WITNESSES = 12
    public static MAX_WEIGHT = 80_000
    public static MIN_COLLATERAL = 20_000_000_000n
    public static MIN_CONSENSUS_PERCENTAGE = 51;

    protected _request?: RadonRequest 
    public readonly template?: RadonTemplate
    
    constructor (protoTypeName: string, radon: RadonRequest | RadonTemplate, initialTarget?: DataRequestParams) {
        super(protoTypeName, initialTarget)
        if (radon instanceof RadonRequest) {
            this._request = radon
        } else if (radon instanceof RadonTemplate) {
            this.template = radon
        } else {
            throw new TypeError(`DataRequestPayload: unsupported Radon asset type: ${(radon as any)?.constructor.name}`)
        }
    }

    public get droHash(): Hash | undefined {
        const obj = this._toDrOutputProtobuf()
        if (obj) {
            const DataRequestOutput = protoRoot.lookupType("DataRequestOutput")
            const err = DataRequestOutput.verify(obj)
            if (err) {
                throw TypeError(err)
            } else {
                // console.log("\ndroHash.obj =>", JSON.stringify(obj))
                const message = DataRequestOutput.fromObject(obj)
                // console.log("\ndroHash.message =>", JSON.stringify(message))
                const bytecode = DataRequestOutput.encode(message).finish()
                // console.log("\ndroHash.bytecode =>", bytecode)
                return toHexString(sha256(bytecode))
            }
        } else {
            return undefined
        }
    }

    public get droSLA(): DataRequestOutputSLA | undefined {
        if (this._target && this._fees) {
            const minConsensusPercentage = DataRequestPayload.MIN_CONSENSUS_PERCENTAGE
            const witnesses = (
                typeof this._target.witnesses === 'object'
                    ? Object.keys(this._target.witnesses).length 
                    : this._target.witnesses || 0
            );
            const commitAndRevealFee = this._fees2UnitaryCommitRevealReward(this._fees, witnesses)
            const witnessReward = this._fees2UnitaryReward(this._fees, witnesses) 
            const collateral = witnessReward * BigInt(witnesses)
            if (collateral > Number.MAX_SAFE_INTEGER) 
                throw new TypeError(`${this.constructor.name}: too much witness collateral: ${collateral.toString()} > ${Number.MAX_SAFE_INTEGER}`);
            else if (witnessReward > Number.MAX_SAFE_INTEGER)
                throw new TypeError(`${this.constructor.name}: too much witness reward: ${witnessReward.toString()} > ${Number.MAX_SAFE_INTEGER}`);
            else if (commitAndRevealFee > Number.MAX_SAFE_INTEGER)
                throw new TypeError(`${this.constructor.name}: too much commit/reveal fee: ${commitAndRevealFee.toString()} > ${Number.MAX_SAFE_INTEGER}`);
            return {
                collateral: Number(collateral),
                commitAndRevealFee: Number(commitAndRevealFee),
                minConsensusPercentage,
                witnesses,
                witnessReward: Number(witnessReward),
            }
            
        } else {
            return undefined
        }
    }

    public get hash(): Hash | undefined {
        const _bytecode = this.bytecode
        if (_bytecode && this.droHash) {
            return toHexString(sha256(Buffer.concat([
                fromHexString(this.droHash),
                sha256(_bytecode),
            ]))) as Hash
        } else {
            return undefined
        }
    }

    public get maxWeight(): number {
        return DataRequestPayload.MAX_WEIGHT
    }

    public get parameterized(): boolean {
        return !!this.template
    }

    public get prepared(): boolean {
        return (
            this.covered
                && this._inputs.length > 0
                && !!this._request
                && !!this._target
        )
    }

    public get radArgs(): DataRequestTemplateArgs | undefined {
        return this.template ? this._target?.args : undefined
    }

    public get radHash(): HexString | undefined {
        return this.request?.radHash
    }

    public get request(): RadonRequest | undefined {
        return this._request
    }

    public get value(): Coins {
        if (this._target && this._fees) {
            return Coins.fromPedros(this._fees2Value(this._fees, this._target.witnesses || 0))
        } else {
            return Coins.zero()
        }
    }

    public get weight(): number {
        if (this._request && this._target) {
            const witnesses = typeof this._target.witnesses === 'object' ? Object.keys(this._target.witnesses).length : this._target.witnesses || 0
            return (
                DR_TX_WEIGHT_ALPHA * (this._request.weight() + 8 + 2 + 8 + 4 + 8),
                    + this._inputs.length * TX_WEIGHT_INPUT_SIZE 
                    + this._outputs.length * TX_WEIGHT_OUTPUT_SIZE 
                    + witnesses * (
                            DR_COMMIT_TX_WEIGHT
                                + DR_REVEAL_TX_WEIGHT * DR_TX_WEIGHT_BETA  
                                + TX_WEIGHT_OUTPUT_SIZE // TODO V2.1: typeof this._target.witnesses === 'object' ? TX_WEIGHT_OUTPUT_SIZE : 0
                    )
                    + Math.max(DR_TALLY_TX_WEIGHT, this._target?.maxResultSize || 0) * DR_TX_WEIGHT_BETA
            );
        } else {
            return 0
        }
    }

    public async consumeUtxos(ledger: ILedger, reload?: boolean): Promise<bigint> {
        if (!this._target) {
            throw new Error(`${this.constructor.name}: internal error: no in-flight params.`)
        
        } else if ((this._target as any)?.fees instanceof Coins) {
            this._fees = (this._target as any).fees.pedros;
            return super.consumeUtxos(ledger, reload)
        }

        if (!this.covered) {
            if (!this._target.witnesses) {
                this._target.witnesses = Math.min(
                    DataRequestPayload.DEFAULT_WITNESSES, 
                    await ledger.provider.witnesses()
                )
                if (this._target.witnesses < 3) {
                    delete this._target.witnesses
                    throw new Error(`${this.constructor.name}: cannot estimate witnesses: network not ready for witnessing.`)    
                
                } else if (this.weight > DataRequestPayload.MAX_WEIGHT * 0.8) {
                    const delta = this.weight - DataRequestPayload.MAX_WEIGHT * 0.8
                    this._target.witnesses -= Math.ceil(delta / (DR_COMMIT_TX_WEIGHT + DR_REVEAL_TX_WEIGHT * TX_WEIGHT_OUTPUT_SIZE))
                    if (this._target.witnesses < 3) {
                        delete this._target.witnesses
                        throw new Error(`${this.constructor.name}: cannot estimate witnesses: radon request too complex: ${this.weight} weight units`)
                    }
                }
            }
            const priority = (this._target as any)?.fees as TransactionPriority || TransactionPriority.Opulent
            let estimatedFees = await this._estimateNetworkFees(ledger.provider, priority);
            while (this._fees < estimatedFees) {
                this._fees = estimatedFees
                this._outputs = []
                this._inputs = []
                this._covered = 0n
                // consume utxos as to cover for estimated value and estimated fees 
                const value = this._fees2Value(this._fees, this._target.witnesses)
                const utxos = await ledger.selectUtxos({ 
                    value: Coins.fromPedros(value + this._fees - this._covered), 
                    reload,
                })
                this._covered += utxos.map(utxo => BigInt(utxo.value)).reduce((prev, curr) => prev + curr, 0n)
                this._inputs.push(...utxos)
                ledger.consumeUtxos(...utxos)
                this._change = this._covered - (value + this._fees)
                if (this._change >= 0) {
                    this.prepareOutputs({ value: this._change })
                    estimatedFees = await this._estimateNetworkFees(ledger.provider, priority)
                } else {
                    // insufficient funds ...
                    break
                }
            }
        }
        return this._change
    }

    public intoReceipt(target: DataRequestParams): any {
        return {
            droHash: this.droHash,
            radArgs: this.radArgs,
            radHash: this.radHash,
            witnesses: target.witnesses,
        }
    }

    public prepareOutputs(change?: { value: bigint }): any {
        if (change?.value) {
            this._outputs.push({
                pkh: this._inputs[0].signer,
                value: change.value,
                time_lock: 0,
            })
        }
    }

    public resetTarget(target: DataRequestParams): any {
        this._change = 0n
        this._covered = 0n
        this._fees = 0n
        this._inputs = []
        this._outputs = []
        this._target = target
        if (this.droSLA?.collateral && this.droSLA.collateral < DataRequestPayload.MIN_COLLATERAL) {
            throw new TypeError(
                `${this.constructor.name}: witnessing collateral below minimum: ${
                    this.droSLA.collateral
                } < ${
                    DataRequestPayload.MIN_COLLATERAL
                }`
            );
        }
        if (this.template) {
            const args = target?.args
            if (args === undefined) {
                throw new TypeError(`${this.constructor.name}: no template args were passed.`)
            } else if (typeof args === 'string') {
                this._request = this.template.buildRadonRequest([args])
            } else {
                this._request = this.template.buildRadonRequest(args)
            }
        }
        delete this._priorities
    }

    public toJSON(humanize = false): any {
        const droSLA = this.droSLA        
        return {
            inputs: this.inputs
                .map(utxo => ({ output_pointer: utxo.output_pointer })),
            outputs: this.outputs.map(vto => ({ 
                pkh: vto.pkh,
                time_lock: vto.time_lock,
                value: vto.value.toString(),
            })),
            dr_output: {
                ...(this._request ? { data_request: this._request.toJSON(humanize) } : {}),
                commit_and_reveal_fee: droSLA?.commitAndRevealFee,
                min_consensus_percentage: droSLA?.minConsensusPercentage,
                witnesses: droSLA?.witnesses,
                witness_reward: droSLA?.witnessReward,
                collateral: droSLA?.collateral
            }
        }
    }   

    public toProtobuf(): any {
        if (this.prepared && this._target && this._request) {
            return {    
                inputs: this.inputs
                    .map(utxo => { 
                        const transactionId = utxo.output_pointer.split(':')[0]
                        const outputIndex = parseInt(utxo.output_pointer.split(':')[1])
                        return {
                            outputPointer: {
                                transactionId: { SHA256: Array.from(fromHexString(transactionId)) },
                                ...(outputIndex > 0 ? { outputIndex } : {}),
                            },
                        }
                    }),
                outputs: this.outputs.map(vto => ({ 
                    pkh: { hash: Array.from(PublicKeyHash.fromBech32(vto.pkh).toBytes20()), },
                    value: Long.fromValue(vto.value),
                    ...(vto.time_lock > 0 ? { timeLock: vto.time_lock } : {}),
                })),
                drOutput: this._toDrOutputProtobuf(),
            }
        }
    }

    public validateTarget(target?: any): DataRequestParams | undefined {
        target = this._cleanTargetExtras(target)
        if (target && Object.keys(target).length > 0) {
            if (!(
                target
                    && (
                        !target?.fees 
                        || (
                            target.fees instanceof Coins && (target.fees as Coins).pedros > 0 
                            || Object.values(TransactionPriority).includes(target.fees)
                        )
                    )
                    && (target?.witnesses || target?.witnesses === undefined)
                    && (!this.template || target?.args)
            )) {
                throw new TypeError(`${this.constructor.name}: invalid options: ${JSON.stringify(target)}`)
            } else if (target?.witnesses) {
                if (typeof target.witnesses === 'object') {
                    throw new TypeError(`${this.constructor.name}: explicit witnessing committees not yet supported: ${target.witnesses}`)
                } 
                target.witnesses = parseInt(target.witnesses as string)
            }
            return target as DataRequestParams
        } else {
            return undefined
        }
    }

    protected _cleanTargetExtras(target?: any): any {
        if (target) {
            return Object.fromEntries(
                Object.entries(target).filter(([key,]) => [
                    'args',
                    'fees',
                    'maxResultSize',
                    'witnesses',
                ].includes(key))
            )
        }
    }

    protected async _estimateNetworkFees(provider: IJsonRpcProvider, priority = TransactionPriority.Medium): Promise<bigint> {
        if (!this._priorities) {
            this._priorities = await provider.priorities()
        }
        return BigInt(Math.floor(
            this._priorities[`drt_${priority}`].priority * (
                this.covered ? this.weight : (
                    this.weight
                    // estimate weight of one single output in case there was change to pay back
                    + TX_WEIGHT_OUTPUT_SIZE 
                )
            )
        ));
    }

    protected _fees2UnitaryCommitRevealReward(fees: bigint, witnesses: number): bigint {
        return fees / BigInt(witnesses) || 1n
    }

    protected _fees2UnitaryReward(fees: bigint, witnesses: number): bigint {
        return BigMath.max(
            fees,
            1n + DataRequestPayload.MIN_COLLATERAL / BigInt(witnesses)
        );
    }
    protected _fees2Value(fees: bigint, witnesses: number): bigint {
        return (
            BigInt(witnesses) * (
                this._fees2UnitaryReward(fees, witnesses)
                + 2n * this._fees2UnitaryCommitRevealReward(fees, witnesses)
            )
        );
    }

    protected _toDrOutputProtobuf(): any {
        if (this._request) {
            return {
                ...this.droSLA,
                dataRequest: this._request.toProtobuf()
            }
        }
    }
}

