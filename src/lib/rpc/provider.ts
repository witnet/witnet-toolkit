const axios = require("axios").default
const helpers = require("../helpers")

import { AxiosHeaders } from "axios"
import { 
    Balance, Block, ConsensusConstants, DataRequestReport, DataRequestTransaction, Epoch, Hash,
    Mempool, Methods, PeerAddr, Priorities, ProtocolInfo, PublicKeyHashString, 
    Transaction, SignalingInfo, StakeDelegate, StakeEntry, Stake, StakingCapability, StakingPower, 
    Superblock, SyncStatus, ValueTransferTransaction, UtxoInfo, Nanowits,
} from "./types"

export interface IProvider {
    blocks(since: Epoch, limit: number): Promise<Array<[number, Hash/*, PublicKeyHashString*/]>>;
    constants(): Promise<ConsensusConstants>;
    holders(limit?: number): Promise<Record<PublicKeyHashString, Balance2>> 
    mempool(): Promise<Mempool>;
    powers(params?: QueryPowersParams): Promise<Array<StakingPower>>;
    priorities(): Promise<Priorities>;
    protocolInfo(): Promise<ProtocolInfo>;
    syncStatus(): Promise<any>;
    wips(): Promise<SignalingInfo>;

    getBalance(pkh: PublicKeyHashString): Promise<Balance2>;
    getBlock(blockHash: Hash, showTransactionHashes?: boolean): Promise<Block>;
    getDataRequest(drTxHash: Hash): Promise<DataRequestReport>;
    getTransaction(txHash: Hash): Promise<Transaction>;
    getStake(withdrawer: PublicKeyHashString): Promise<Stake>;
    getStakingPowers(pkh: PublicKeyHashString, capability: StakingCapability): Promise<Array<StakingPower>>;
    getSuperblock(epoch: Epoch): Promise<Superblock>;
    getUtxoInfo(pkh: PublicKeyHashString, smallestFirst?: boolean): Promise<Array<UtxoMetadata>>;
        
    sendRawDataRequest(drt: DataRequestTransaction): Promise<Boolean>;
    sendRawValueTransfer(vtt: ValueTransferTransaction): Promise<Boolean>;
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
    readonly endpoints: string[]
    protected headers: AxiosHeaders
    constructor(url?: string) {
        this.endpoints = []
        if (url !== undefined) {
            const urls = url.replaceAll(',', ';').split(';')
            urls.forEach(url => {
                const [schema, ] = helpers.parseURL(url)
                if (!schema.startsWith("http://") && !schema.startsWith("https://")) {
                    throw Error(`Witnet.Provider: unsupported URL schema ${schema}`)
                }
            })
            this.endpoints = urls
        } else {
            this.endpoints.push(process.env.WITNET_TOOLKIT_PROVIDER_URL || "https://rpc-01.witnet.io")
        }
        this.headers = new AxiosHeaders({ 
            "Content-Type": "application/json" 
        })
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
                    headers: this.headers,
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
        return this.callApiMethod<ConsensusConstants>(Methods.GetConsensusConstants);
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
    public async powers(params = { capability: StakingCapability.Mining }): Promise<Array<StakingPower>> {
        return this
            .callApiMethod<Array<StakingPower>>(Methods.QueryStakingPowers, [params.capability, ])
            .then((powers: Array<StakingPower>) => {
                return powers.map((entry, index) => {
                    entry.rank = index + 1
                    return entry
                })
            })
    }
    
    /// Get a full list of current stake entries  Query the amount of nanowits staked by an address.
    public async stakers(): Promise<Array<StakeEntry>> {
        return this
            .callApiMethod<Array<StakeEntry>>(Methods.QueryStakes, {
                all: true,
            })
            .then((stakers: Array<StakeEntry>) => {
                return stakers.sort((a, b) => {
                    if (a.value.coins < b.value.coins) return 1;
                    else if (a.value.coins > b.value.coins) return -1;
                    else return 0;
                })
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
    public async getSuperblock(epoch: Epoch): Promise<Superblock> {
        return this.callApiMethod<Superblock>(Methods.GetSuperblock, { "block_epoch": epoch });
    }
    
    public async getTransaction(txHash: Hash): Promise<Transaction> {
        return this.callApiMethod<Transaction>(Methods.GetTransaction, [txHash, ]);
    }
    
    /// Get utxos
    public getUtxoInfo(pkh: PublicKeyHashString, smallestFirst = true): Promise<Array<UtxoMetadata>> {
        return this
            .callApiMethod<UtxoInfo>(Methods.GetUtxoInfo, [pkh, ])
            .then((result: UtxoInfo) => {
                const inversor = smallestFirst ? 1 : -1
                return result.utxos.sort((a, b) => {
                    if (a.value > b.value) return inversor;
                    else if (a.value < b.value) return - inversor;
                    else return 0;
                })
            })
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public async sendRawDataRequest(drt: DataRequestTransaction): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.Inventory, { "transaction": drt })
    }
    
    public async sendRawValueTransfer(vtt: ValueTransferTransaction): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.Inventory, { "transaction": vtt })
    }
}