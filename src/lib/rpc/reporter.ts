import { IJsonRpcProvider, JsonRpcProvider } from "./provider"
import { GetDataRequestEtherealReport, GetDataRequestFullReport, Methods, PeerAddr, SupplyInfo, } from "./types"
import { Hash } from "../types"

export interface IReporter extends IJsonRpcProvider {
    providers(): Promise<Array<string>>
    supplyInfo(): Promise<SupplyInfo>;

    getDataRequest(drTxHash: Hash, channel?: string): Promise<GetDataRequestEtherealReport | GetDataRequestFullReport>
    searchDataRequests(radHash: Hash): Promise<any>;
}

export class Reporter extends JsonRpcProvider implements IReporter {
    constructor(url?: string) {
        super(url || process.env.WITNET_TOOLKIT_REPORTER_URL || "https://kermit.witnet.io")
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public peers(): Promise<Array<PeerAddr>> {
        return this.callApiMethod<Array<PeerAddr>>(Methods.KnownPeers);
    }
    
    public async providers(): Promise<Array<string>> {
        return this.callApiMethod<Array<string>>(Methods.Providers)
    }
    
    /// Get supply info
    public async supplyInfo(): Promise<SupplyInfo> {
        return this.callApiMethod<SupplyInfo>(Methods.GetSupplyInfo)
    }
    
    /// ---------------------------------------------------------------------------------------------------------------
    public async reportDataRequest(drTxHash: Hash, channel?: string): Promise<DataRequestReport> {
        return this.callApiMethod<DataRequestReport>(Methods.DataRequestReport, [drTxHash, channel, ])
    }
    
    public async searchDataRequests(radHash: Hash): Promise<any> {
        return this.callApiMethod<any>(Methods.SearchDataRequests, [radHash, ])
    }
}
