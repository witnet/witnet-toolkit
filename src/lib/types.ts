export { INodeFarm } from "./rpc/nodes"
export { IProvider } from "./rpc/provider"
export { IReporter } from "./rpc/reporter"

export { 
    Balance2 as Balance, 
    Block, 
    BlockTransactionsHashes,
    Network,
    QueryStakesOrder,
    StakeEntry,
    StakesOrderBy,
    StakingCapability,
    SyncStatus, 
    TransactionReport,
    UtxoMetadata,
    ValueTransferOutput,
} from "./rpc/types"

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
export type Nanowits = number;
export type Nonce = u64;
