export { IJsonRpcNodeFarm } from "./rpc/nodes"
export { IJsonRpcProvider } from "./rpc/provider"

export { 
    Balance2 as Balance, 
    Block, 
    BlockTransactionsHashes,
    ConsensusConstants,
    DataRequestStatus,
    GetDataRequestEtherealReport,
    GetDataRequestFullReport,
    GetDataRequestMode,
    Network,
    Priorities as NetworkPriorities,
    QueryStakesOrder,
    StakeEntry,
    StakesOrderBy,
    StakingCapability,
    SyncStatus, 
    TransactionReport,
    UtxoMetadata,
    ValueTransferOutput,
} from "./rpc/types"

export {
    TimeoutError,
} from "./crypto/types"

export type f64 = number;
export type i32 = number;
export type i64 = number;
export type u8 = number;
export type u16 = number;
export type u32 = number;
export type u64 = number;
export type usize = number;

export type Epoch = i32;
export type Err = string;
export type Hash = string;
export type HexString = string;
export type Nonce = u64;
