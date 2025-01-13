const helpers = require("../helpers")

import { IProvider, Provider } from "./provider"
import { 
    Balance, 
    Epoch, 
    Methods, 
    NodeStats, 
    PeerAddr, 
    PublicKey, 
    PublicKeyHashString, 
    StakeAuthorization, 
} from "./types"

export interface INode extends IProvider {
    nodeStats(): Promise<NodeStats>;
    peers(): Promise<Array<PeerAddr>>;

    getBalance(): Promise<Balance>;
    getMasterKey(): Promise<string>;
    getPkh(): Promise<string>;
    getPublicKey(): Promise<PublicKey>;

    authorizeStake(withdrawer: PublicKeyHashString): Promise<StakeAuthorization>;
    addPeers(peers: Array<string>): Promise<Boolean>;
    clearPeers(): Promise<Boolean>;
    initializePeers(): Promise<Boolean>;
    rewind(epoch: Epoch): Promise<Boolean>;     
}

export class Node extends Provider implements INode {
    constructor(url?: string) {
        super(url || process.env.WITNET_TOOLKIT_PROVIDER_URL || "http://127.0.0.1:21339")
        this.endpoints.forEach(url => {
            const [, host, ] = helpers.parseURL(url)
            if (!helpers.ipIsPrivateOrLocalhost(host.split(':')[0])) {
                throw Error(`Witnet.Node: only local host or private IPs can be provided: ${host}`)
            }
        })
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public async nodeStats(): Promise<NodeStats> {
        return this.callApiMethod<NodeStats>(Methods.NodeStats)
    }
    
    public async peers(): Promise<Array<PeerAddr>> {
        return this.callApiMethod<Array<PeerAddr>>(Methods.Peers)
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public async getBalance(): Promise<Balance> {
        return this.callApiMethod<Balance>(Methods.GetBalance, {
            simple: false,
        })
    }
    
    public async getMasterKey(): Promise<string> {
        return this.callApiMethod<string>(Methods.MasterKeyExport)
    }
    
    public async getPkh(): Promise<PublicKeyHashString> {
        return this.callApiMethod<PublicKeyHashString>(Methods.GetPkh)
    }
    
    public async getPublicKey(): Promise<PublicKey> {
        return this.callApiMethod<PublicKey>(Methods.GetPublicKey)  
    }

    /// ---------------------------------------------------------------------------------------------------------------
    public async authorizeStake(withdrawer: PublicKeyHashString): Promise<StakeAuthorization> {
        return this.callApiMethod<StakeAuthorization>(Methods.AuthorizeStake, { 
            withdrawer,
        })
    }
    
    public async addPeers(peers: Array<string>): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.AddPeers, [...peers, ])
    }
    
    public async clearPeers(): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.ClearPeers)
    }
    
    public async initializePeers(): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.InitializePeers)
    }
    
    public async rewind(epoch: Epoch): Promise<Boolean> {
        return this.callApiMethod<Boolean>(Methods.Rewind, [epoch, ])
    }
}
