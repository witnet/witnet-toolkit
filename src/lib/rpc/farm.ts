const axios = require("axios").default
const helpers = require("../helpers")

import { IProvider, Provider, ProviderError } from "./provider"
import { 
    Balance, 
    Epoch, 
    Methods, 
    NodeStats, 
    PeerAddr, 
    PublicKeyHashString, 
    StakeAuthorization, 
    StakeEntry,
    SyncStatus,
} from "./types"

export interface INodeFarm extends IProvider {
    addresses(): Promise<Record<string, PublicKeyHashString>>
    balances(): Promise<Record<string, [PublicKeyHashString, Balance]>>
    masterKeys(): Promise<Record<string, [PublicKeyHashString, string]>>
    syncStatus(): Promise<Record<string, SyncStatus>>

    peers(validator?: PublicKeyHashString): Promise<Array<PeerAddr>>;
    stats(): Promise<Record<string, NodeStats>>;
    withdrawers(): Promise<Array<StakeEntry>>;

    addPeers(peers: Array<string>): Promise<Record<string, Boolean>>;
    authorizeStakes(withdrawer: PublicKeyHashString): Promise<Record<string, [PublicKeyHashString, StakeAuthorization]>>;
    clearPeers(): Promise<Record<string, Boolean>>;
    initializePeers(): Promise<Record<string, Boolean>>;
    rewind(epoch: Epoch): Promise<Record<string, Boolean>>;
}

function isPrivateURL(url: string): boolean {
    const [, host, ] = helpers.parseURL(url)
    return helpers.ipIsPrivateOrLocalhost(host.split(':')[0])
}

export class NodeFarm extends Provider implements INodeFarm {
    constructor(url?: string) {
        super(url || process.env.WITNET_TOOLKIT_FARM_NODES || "http://127.0.0.1:21339")
        this.endpoints.forEach(url => {
            if (!isPrivateURL(url)) {
                throw Error(`Witnet.NodeFarm: only local host or private IPs can be provided: ${url}`)
            }
        })
    }

    protected async batchApiPkhMethod<T>(method: string, ...params: Array<any>): Promise<Record<string, [PublicKeyHashString, T]>> {
        return this.addresses()
            .then(async (addresses: Record<string, Error | string>) => {
                const promises = Object.entries(addresses).map(async ([url, pkh]) => [
                    url, [
                        pkh,
                        pkh instanceof Error ? undefined : await this.callApiMethod<T>(url, method, [pkh, ...params])
                    ],
                ]);
                return Promise.all(promises)
            })
            .then(entries => Object.fromEntries(entries.map(([url, [pkh, value]]) => {
                if (value && value instanceof Error) {
                    if ((value as ProviderError)?.error?.message) {
                        value = new Error((value as ProviderError)?.error?.message)
                        delete value.stack
                    }
                }
                return [url, [pkh, value || ""]]
            })))
    }

    protected async batchApiPkhMethodNoPkh<T>(method: string, ...params: Array<any>): Promise<Record<string, [PublicKeyHashString, T]>> {
        return this.addresses()
            .then(async (addresses: Record<string, Error | string>) => {
                const promises = Object.entries(addresses).map(async ([url, pkh]) => [
                    url, [
                        pkh,
                        pkh instanceof Error ? undefined : await this.callApiMethod<T>(url, method, params)
                    ],
                ]);
                return Promise.all(promises)
            })
            .then(entries => Object.fromEntries(entries.map(([url, [pkh, value]]) => {
                if (value && value instanceof Error) {
                    if ((value as ProviderError)?.error?.message) {
                        value = new Error((value as ProviderError)?.error?.message)
                        delete value.stack
                    }
                }
                return [url, [pkh, value || ""]]            
            })))
    }

    protected async batchApiMethod<T>(method: string, params?: Array<any> | any ): Promise<Record<string, T>> {
        const promises = this.endpoints.map(async (url) => 
            axios
                .post(
                    url, {
                        jsonrpc: '2.0',
                        id: + new Date(),
                        method,
                        params,
                    }, {
                        headers: this.headers,
                    }
                ).then((response: any) => {
                    if (response?.error || response?.data?.error) {
                        return [url, new ProviderError(method, params, response?.error || response?.data?.error)]
                    } else {
                        return [url, response?.data?.result as T]
                    }
                })
                .catch((exception: any) => {
                    const error = new Error(exception?.message || exception?.error || exception)
                    delete error.stack
                    return [url, error]
                })
        )
        return Promise.all(promises).then(values => Object.fromEntries(values))
    }

    protected async callApiMethod<T>(url: string, method: string, params?: Array<any> | any ): Promise<Error | any> {
        return (
            axios
                .post(
                    url, {
                        jsonrpc: '2.0',
                        id: + new Date(),
                        method,
                        params,
                    }, {
                        headers: this.headers,
                    }
                ).then((response: any) => {
                    if (response?.error || response?.data?.error) {
                        const error = new ProviderError(method, params, response?.error || response?.data?.error)
                        delete error?.stack
                        return error
                    } else {
                        return response?.data?.result as T
                    }
                })
                .catch((exception: any) => {
                    const error = new Error(exception?.message || exception?.error || exception)
                    delete error?.stack
                    return error
                })
        )
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    
    public async addresses(): Promise<Record<string, PublicKeyHashString>> {
        return this.batchApiMethod<PublicKeyHashString>(Methods.GetPkh)
    }

    public async balances(): Promise<Record<string, [PublicKeyHashString, Balance]>> {
        return this.batchApiPkhMethod<Balance>(Methods.GetBalance)
    }

    public async masterKeys(): Promise<Record<string, [PublicKeyHashString, string]>> {
        return this.batchApiPkhMethodNoPkh<string>(Methods.MasterKeyExport)
    }

    public async peers(): Promise<Array<PeerAddr>> {
        return this.batchApiMethod<Array<PeerAddr>>(Methods.Peers)
            .then((results: Record<string, PeerAddr[]>) => {
                let peers: PeerAddr[] = []
                Object.values(results).forEach((morePeers: Error | PeerAddr[]) => {
                    if (!(morePeers instanceof Error)) { 
                        morePeers.forEach(peer => {
                            if (!peers.includes(peer)) {
                                peers.push(peer)
                            }
                        })
                    }
                })
                return peers
            })
    }

    public async stats(): Promise<Record<string, NodeStats>> {
        return this.batchApiMethod<NodeStats>(Methods.NodeStats)
    }

    public async syncStatus(): Promise<Record<string, SyncStatus>> {
        return this.batchApiMethod<SyncStatus>(Methods.SyncStatus)
    }

    public async withdrawers(): Promise<Array<StakeEntry>> {
        return this.addresses()
            .then(async (addresses: Record<string, Error | string>) => {
                const promises = Object.entries(addresses).map(async ([url, validator]) => [
                    url, 
                    validator instanceof Error 
                        ? undefined 
                        : await this.callApiMethod<Array<StakeEntry>>(
                            url, 
                            Methods.QueryStakes, 
                            { validator }
                        ),
                ]);
                return Promise.all(promises)
            })
            .then(entries => Object.fromEntries(entries.map(([url, stakes]) => {
                if (stakes && stakes instanceof Error) {
                    if ((stakes as ProviderError)?.error?.message) {
                        stakes = new Error((stakes as ProviderError)?.error?.message)
                        delete stakes.stack
                    }
                }
                return [url, stakes]
            })))
            .then((results: Record<string, Error | Array<StakeEntry>>) => {
                let withdrawers: StakeEntry[] = []
                Object.values(results).forEach(moreEntries => {
                    if (moreEntries && !(moreEntries instanceof Error)) { 
                        withdrawers.push(...moreEntries)
                    }
                })
                return withdrawers
            })
    }

    /// ---------------------------------------------------------------------------------------------------------------

    public async addPeers(peers: Array<string>): Promise<Record<string, Boolean>> {
        return this.batchApiMethod<Boolean>(Methods.AddPeers, peers)
    }

    public async authorizeStakes(withdrawer: PublicKeyHashString): Promise<Record<string, [PublicKeyHashString, StakeAuthorization]>> {
        return this.batchApiPkhMethodNoPkh<StakeAuthorization>(Methods.AuthorizeStake, withdrawer)
    }

    public async clearPeers(): Promise<Record<string, Boolean>> {
        return this.batchApiMethod<Boolean>(Methods.ClearPeers)
    }

    public async initializePeers(): Promise<Record<string, Boolean>> {
        return this.batchApiMethod<Boolean>(Methods.InitializePeers)
    }

    public async rewind(epoch: Epoch): Promise<Record<string, Boolean>> {
        return this.batchApiMethod<Boolean>(Methods.Rewind, [epoch, ])
    }
}
