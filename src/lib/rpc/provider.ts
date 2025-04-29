import { default as axios, AxiosHeaders } from "axios"

import { Root as ProtoRoot } from "protobufjs"
const protoRoot = ProtoRoot.fromJSON(require("../../../witnet/witnet.proto.json")) 
const protoBuf = protoRoot.lookupType("ConsensusConstants")

import { PublicKeyHashString, TransactionReceipt } from "../crypto/types"
import { Epoch, Hash, Network, UtxoMetadata } from "../types"
import * as utils from "../utils"

import {
    Balance, Balance2, Block, ConsensusConstants, DataRequestReport, 
    Mempool, Methods, PeerAddr, Priorities, ProtocolInfo, 
    QueryStakes, QueryStakingPowers,
    TransactionReport, SignalingInfo, StakeEntry, StakingPower, 
    SuperblockReport, SyncStatus, UtxoInfo, 
} from "./types"

export interface IProvider {
    network?: Network;
    networkId?: number;
    
    blocks(since: Epoch, limit: number): Promise<Array<[number, Hash/*, PublicKeyHashString*/]>>;
    constants(): Promise<ConsensusConstants>;
    holders(limit?: number): Promise<Record<PublicKeyHashString, Balance2>> 
    mempool(): Promise<Mempool>;
    powers(params?: QueryStakingPowers): Promise<Array<StakingPower>>;
    priorities(): Promise<Priorities>;
    protocolInfo(): Promise<ProtocolInfo>;
    stakes(params: QueryStakes): Promise<Array<StakeEntry>>; 
    syncStatus(): Promise<any>;
    wips(): Promise<SignalingInfo>;

    getBalance(pkh: PublicKeyHashString): Promise<Balance2>;
    getBlock(blockHash: Hash, showTransactionHashes?: boolean): Promise<Block>;
    getDataRequest(drTxHash: Hash): Promise<DataRequestReport>;
    getSuperblock(epoch: Epoch): Promise<SuperblockReport>;
    getTransaction(txHash: Hash): Promise<TransactionReport>;
    getTransactionReceipt(txHash: Hash): Promise<TransactionReceipt>;
    getUtxos(pkh: PublicKeyHashString, smallestFirst?: boolean): Promise<Array<UtxoMetadata>>;
        
    sendRawTransaction(tx: any): Promise<boolean>;
}

export class ProviderError extends Error {
    readonly error?: any;
    readonly method: string;
    readonly params: any[];
    constructor(method: string, params: any[], error?: any) {
        super(`${method}(${JSON.stringify(params)}): ${JSON.stringify(error)})`)
        delete error?.stack
        this.error = error
        this.method = method
        this.params = params
    }
}

export class Provider implements IProvider {
    
    public readonly endpoints: string[]

    public static receipts: Record<Hash, TransactionReceipt> = {};

    protected _constants?: ConsensusConstants
    protected _headers: AxiosHeaders;
    
    static async initialized(url?: string): Promise<Provider> {
        const provider = new Provider(url || process.env.WITNET_TOOLKIT_PROVIDER_URL || "https://rpc.witnet.io")
        return provider.constants().then(() => provider)
    }

    constructor(url?: string) {
        this.endpoints = []
        if (url !== undefined) {
            const urls = url.replaceAll(',', ';').split(';')
            urls.forEach(url => {
                const [schema, ] = utils.parseURL(url)
                if (!schema.startsWith("http://") && !schema.startsWith("https://")) {
                    throw Error(`Witnet.Provider: unsupported URL schema ${schema}`)
                }
            })
            this.endpoints = urls
        } else {
            this.endpoints.push(process.env.WITNET_TOOLKIT_PROVIDER_URL || "https://rpc-01.witnet.io")
        }
        this._headers = new AxiosHeaders({ 
            "Content-Type": "application/json" 
        })
    }

    public get network(): Network | undefined {
        if (this._constants) {
            return this._constants.bootstrapping_committee[0].startsWith('wit') ? "mainnet": "testnet"
        } else {
            return undefined
        }
    }

    public get networkId(): number | undefined {
        if (this._constants) {
            const obj: any = {}
            obj.activityPeriod = this._constants.activity_period;
            obj.bootstrapHash = { SHA256: Array.from(utils.fromHexString(this._constants.bootstrap_hash)) }
            obj.bootstrappingCommittee = this._constants.bootstrapping_committee
            obj.checkpointZeroTimestamp = this._constants.checkpoint_zero_timestamp
            obj.checkpointsPeriod = this._constants.checkpoints_period
            obj.collateralAge = this._constants.collateral_age
            obj.collateralMinimum = this._constants.collateral_minimum
            obj.epochsWithMinimumDifficulty = this._constants.epochs_with_minimum_difficulty
            obj.extraRounds = this._constants.extra_rounds
            obj.genesisHash = { SHA256: Array.from(utils.fromHexString(this._constants.genesis_hash)) }
            obj.halvingPeriod = this._constants.halving_period
            obj.initialBlockReward = this._constants.initial_block_reward
            obj.maxDrWeight = this._constants.max_dr_weight
            obj.maxVtWeight = this._constants.max_vt_weight
            if (this._constants.minimum_difficulty > 0) obj.minimumDifficulty = this._constants.minimum_difficulty
            obj.miningBackupFactor = this._constants.mining_backup_factor
            obj.miningReplicationFactor = this._constants.mining_replication_factor
            obj.reputationExpireAlphaDiff = this._constants.reputation_expire_alpha_diff
            obj.reputationIssuance = this._constants.reputation_issuance
            obj.reputationIssuanceStop = this._constants.reputation_issuance_stop
            obj.reputationPenalizationFactor = this._constants.reputation_penalization_factor
            obj.superblockCommitteeDecreasingPeriod = this._constants.superblock_committee_decreasing_period
            obj.superblockCommitteeDecreasingStep = this._constants.superblock_committee_decreasing_step
            obj.superblockPeriod = this._constants.superblock_period
            obj.superblockSigningCommitteeSize = this._constants.superblock_signing_committee_size
            // console.log(obj)
            const message = protoBuf.fromObject(obj)
            // console.log(message)
            const buffer = protoBuf.encode(message).finish()
            const hash = utils.toHexString(utils.sha256(buffer)) 
            // console.log(hash)
            const hex = hash.substring(0, 4)
            return parseInt(hex, 16)
        } 
        return undefined
    }
    
    protected nextURL(): string {
        return this.endpoints[Math.floor(Math.random() * this.endpoints.length)]
    }
    
    protected async callApiMethod<T>(method: string, params?: Array<any> | any ): Promise<Error | any> {
        const url = this.nextURL()
        return axios
            .post(
                url,
                {
                    jsonrpc: '2.0',
                    id: + new Date(),
                    method,
                    params,
                },
                {
                    headers: this._headers,
                }
            
            ).then((response: any) => {
                if (response?.error || response?.data?.error) {
                    throw new ProviderError(method, params, response?.error || response?.data?.error);

                } else return response?.data?.result as T;
            })
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
   
    /**
     * Get the list of block hashes within given range, as known by the provider.
     * @param {number} since - First epoch for which to return block hashes. If negative, return block hashes from the last n epochs.
         * @param {number} limit - Number of block hashes to return. If negative, return the last n block hashes from this epoch range.
     */
    public async blocks(since: number = -1, limit: number = 1,): Promise<Array<[number, Hash]>> {
        return this.callApiMethod<[Number, Hash]>(Methods.GetBlockChain, [since, limit, ]);
    }
    
    /// Get consensus constants used by the node
    public async constants(): Promise<ConsensusConstants> {
        if (!this._constants) {
            return this
                .callApiMethod<ConsensusConstants>(Methods.GetConsensusConstants)
                .then((constants: ConsensusConstants) => {
                    this._constants = constants
                    return constants
                })
        } else {
            return this._constants
        }    
    }

    /// Get limited list of currently top holders, as known by the provider.
    public async holders(minBalance = 0, maxBalance?: number): Promise<Record<PublicKeyHashString, Balance2>> {
        return this
            .callApiMethod<Record<PublicKeyHashString, Balance>>(Methods.GetBalance2, {
                all: {
                    minBalance,
                    ... maxBalance ? { maxBalance } : {}
                }
            }).then((balances: Record<PublicKeyHashString, Balance2>) => {
                const reverseCompare = (a: Balance2, b: Balance2) => {
                    const a_tot = a.locked + a.unlocked + a.staked
                    const b_tot = b.locked + b.unlocked + b.staked
                    if (a_tot < b_tot) return 1;
                    else if (a_tot > b_tot) return -1;
                    else return 0;
                }
                return Object.fromEntries(
                    Object.entries(balances)
                        .sort((a: (string | Balance2)[], b: (string | Balance2)[]) => reverseCompare(a[1] as Balance2, b[1] as Balance2))
                );
            })
    }
    
    /// Get list of known peers
    public async knownPeers(): Promise<Array<PeerAddr>> {
        return this.callApiMethod<Array<PeerAddr>>(Methods.KnownPeers);
    }
    
    /// Get all the pending transactions
    public async mempool(): Promise<Mempool> {
        return this.callApiMethod<Mempool>(Methods.GetMempool);
    }    
    
    /// Get priority and time-to-block estimations for different priority tiers.
    public async priorities(): Promise<Priorities> {
        return this.callApiMethod<Priorities>(Methods.Priority)
    }
    
    /// Get information about protocol versions and which version is currently being enforced.
    public async protocolInfo(): Promise<ProtocolInfo> {
        return this.callApiMethod<ProtocolInfo>(Methods.Protocol)
    }
    
    /// Get a full list of staking powers ordered by rank
    public async powers(query?: QueryStakingPowers): Promise<Array<StakingPower>> {
        return this.callApiMethod<Array<StakingPower>>(Methods.QueryStakingPowers, query)
    }
    
    /// Get a full list of current stake entries  Query the amount of nanowits staked by an address.
    public async stakes(query?: QueryStakes): Promise<Array<StakeEntry>> {
        return this
            .callApiMethod<Array<StakeEntry>>(Methods.QueryStakes, query)
            .catch(err => {
                if (err?.error?.message && err.error.message.indexOf("not registered") > -1) {
                    return []
                } else {
                    throw err
                }
            })
    }
    
    /// Get node status
    public async syncStatus(): Promise<SyncStatus> {
        return this.callApiMethod<SyncStatus>(Methods.SyncStatus);
    }
    
    public async wips(): Promise<SignalingInfo> {
        return this.callApiMethod<SignalingInfo>(Methods.SignalingInfo)
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    /// Get balance
    public async getBalance(pkh: PublicKeyHashString): Promise<Balance2> {
        return this.callApiMethod<Balance2>(Methods.GetBalance2, { pkh });
    }
    
    /**
     * Get block info by hash
     * @param {Hash} blockHash - Hash of the block that we are querying.
     * @param {boolean} showTransactionHash - Whether to include an extra field containing array of transaction hashes.
     */
    public async getBlock(
            blockHash: Hash,
            showTransactionHash = false,
        ): Promise<Block>
    {
        return this.callApiMethod<Block>(Methods.GetBlock, [blockHash, showTransactionHash, ])
    }
    
    public async getDataRequest(drTxHash: Hash): Promise<DataRequestReport> {
        return this.callApiMethod<DataRequestReport>(Methods.DataRequestReport, [drTxHash, ])
    }
    
    /// Get the blocks that pertain to the superblock index
    public async getSuperblock(epoch: Epoch): Promise<SuperblockReport> {
        return this.callApiMethod<SuperblockReport>(Methods.GetSuperblock, { "block_epoch": epoch });
    }
    
    public async getTransaction(txHash: Hash): Promise<TransactionReport> {
        return this.callApiMethod<TransactionReport>(Methods.GetTransaction, [txHash, ]);
    }

    public async getTransactionReceipt(txHash: Hash): Promise<TransactionReceipt> {
        // todo: fetch/update receipt from provider, if not cached
        return Provider.receipts[txHash]
    }
    
    /// Get utxos
    public getUtxoInfo(pkh: PublicKeyHashString, smallFirst = true): Promise<Array<UtxoMetadata>> {
        return this
            .callApiMethod<UtxoInfo>(Methods.GetUtxoInfo, [pkh, ])
            .then((result: UtxoInfo) => {
                const inversor = smallFirst ? 1 : -1
                return result.utxos.sort((a, b) => {
                    if (a.value > b.value) return inversor;
                    else if (a.value < b.value) return - inversor;
                    else return 0;
                })
            })
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public async sendRawTransaction(transaction: any): Promise<boolean> {
        return this.callApiMethod<boolean>(Methods.Inventory, { transaction })
    }
}