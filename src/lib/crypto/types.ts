const secp256k1 = require('secp256k1')
import { bech32 } from 'bech32'
import { Epoch, Hash, HexString, Nanowits, UtxoMetadata } from "../types"

import { fromHexString, fromWits, isHexString, toHexString, whole_wits } from "../../bin/helpers"
import { sha256 } from "./utils"

export class Coins {
    readonly pedros: Nanowits;
    public static fromNanowits(nanowits: Nanowits): Coins {
        return new Coins(Math.floor(nanowits))
    }
    public static fromPedros(pedros: number): Coins {
        return new Coins(Math.floor(pedros))
    }
    public static fromValue(value: Coins): Coins {
        return new Coins(value.pedros)
    }
    public static fromWits(wits: number): Coins {
        return new Coins(fromWits(wits))
    }
    public static zero(): Coins {
        return new Coins(0)
    }
    constructor (pedros: Nanowits) {
        this.pedros = pedros
    }
    public get nanowits(): Nanowits {
        return this.pedros
    }
    public get wits(): number {
        return this.pedros / 10 ** 9
    }
    public toString(decimals = 2): string {
        return whole_wits(this.pedros, decimals)
    }
}

export type KeyPath = Array<number>

export type KeyedSignature = {
    signature: { Secp256k1: { der: Array<number> }},
    public_key: {
        bytes: Array<number>;
        compressed: number,
    },
};

export type PublicKeyHashString = HexString

interface Key {
    bytes: Uint8Array;
}

export interface PrivateKey extends Key {
    type: "private";
}

export interface PublicKey extends Key {
    type: "public";
}

export type TransactionCallback = (receipt: TransactionReceipt, error?: any) => any

export type TransactionParams = {
    deadline?: Epoch,
    fees: Nanowits,
}
export type TransactionReceipt = {
    authorization?: HexString;
    blockEpoch?: Epoch;
    blockHash?: Hash;
    blockMiner?: PublicKeyHashString;
    burns?: Nanowits;
    confirmations?: number;
    change?: Nanowits;
    droHash?: Hash;
    error?: Error,
    fees: Nanowits;
    from?: Array<PublicKeyHashString> | PublicKeyHashString;
    hash: Hash;
    outputLock?: number;
    radArgs?: any;
    radHash?: HexString;
    recipients?: Array<[PublicKeyHashString, Nanowits]>;
    status?: TransactionStatus;
    timestamp: number;
    type: string;
    tx?: any;
    value?: Nanowits;
    weight: number;
    withdrawer?: PublicKeyHashString;
    witnesses?: number | Record<PublicKeyHashString, Nanowits>;
}

export enum TransactionStatus {
    /// Awating to be relayed by the RPC provider
    Pending = "pending", 

    /// Remains on-chain after certain amount of epochs since mined
    Confirmed = "confirmed",

    /// Remains on-chain after end of next super-epoch to the one on which the tx got mined
    Finalized = "finalized",
    
    /// Relayed and allegedly included in a block
    Mined = "mined",
    
    /// Relayed to the mempool 
    Relayed = "relayed",
}

export type Transmission = {
    bytecode?: Uint8Array,
    hash?: Hash;
    message: any;
}

export type Utxo = UtxoMetadata & { signer: PublicKeyHashString }

export type UtxoCacheInfo = {
    // total amount of expendable funds with currently cached UTXOs
    expendable: Nanowits, 
    // number of cached UTXOs
    size: number, 
    // earliest of all timelocks in the caché
    timelock: number,
}

export type UtxoPointer = {
    // transaction identifier
    transaction_id: Hash;
    // output index within referred transaction
    output_index: number;
};

export enum UtxoSelectionStrategy {
    BigFirst = "big-first",
    Random = "random",
    SlimFit = "slim-fit",
    SmallFirst = "small-first",
}


///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/// EXPORTED CLASSES 

/// ===================================================================================================================
export class PublicKey implements Key {
    
    public readonly compressed: number;
    public readonly bytes: Uint8Array;

    static fromProtobuf(protobuf: { compressed: number, bytes: Array<number> }): PublicKey {
        return new PublicKey(protobuf.compressed, Uint8Array.from(protobuf.bytes))
    }

    static fromUint8Array(uint8Array: Uint8Array): PublicKey {
        return new PublicKey(
            uint8Array[0],
            uint8Array.slice(1),
        );
    }

    static recoverFrom(recoverable: any, msg: Uint8Array): PublicKey {
        let bytes
        if (isHexString(recoverable)) {
            bytes = fromHexString(recoverable)
        } else if (recoverable instanceof Buffer) {
            bytes = Uint8Array.from(recoverable.buffer)
        } else if (recoverable instanceof Uint8Array) {
            bytes = recoverable
        } else {
            throw new TypeError(`PublicKey: unsupported recoverable signature format: ${recoverable}`)
        }
        if (bytes.length !== 65) {
            throw new TypeError(`PublicKey: expected recoverable signature with length 65: ${toHexString(bytes)}`)
        } 
        const [ recoveryId, signature ] = [ bytes[0], bytes.slice(1) ]
        return PublicKey.fromUint8Array(secp256k1.ecdsaRecover(signature, recoveryId, msg))
    }

    constructor(compressed: number, bytes: Uint8Array) {
        this.compressed = compressed
        this.bytes = bytes
    }

    public equals(pubKey: PublicKey): boolean {
        return pubKey.compressed === this.compressed && matchingUint8Arrays(pubKey.bytes, pubKey.bytes)
    }

    public hash(): PublicKeyHash {
        return PublicKeyHash.fromPublicKey(this)
    }

    public toString(): string {
        return toHexString([this.compressed, ...this.bytes])
    }

    public toUint8Array(): Uint8Array {
        return Uint8Array.from([this.compressed, ...this.bytes])
    }
};


/// ===================================================================================================================
export class PublicKeyHash {

    static fromHash(hash: Uint8Array): PublicKeyHash {
        return new PublicKeyHash(bech32.toWords(hash));
    }

    static fromHexString(hash: HexString): PublicKeyHash {
        return PublicKeyHash.fromHash(fromHexString(hash))
    }
    
    static fromPublicKey(pk: PublicKey): PublicKeyHash {
        return PublicKeyHash.fromHash(
            sha256(
                Buffer.from([pk.compressed, ...pk.bytes])
            ).subarray(0, 20)
        );
    }
    
    static fromBech32(pkh: string): PublicKeyHash {
        try {
            pkh = pkh.toLowerCase()
            if (pkh.startsWith('wit')) {
                return new PublicKeyHash(bech32.decode(pkh, 66).words)
            } else if (pkh.startsWith('twit')) {
                return new PublicKeyHash(bech32.decode(pkh, 67).words)
            } else {
                throw new TypeError(`PublicKeyHash: invalid bech32 string: ${pkh}`);
            }
        } catch {
            throw new TypeError(`PublicKeyHash: invalid bech32 string: ${pkh}`);
        }
    }

    protected words: number[];
    
    constructor(words: number[]) {
        this.words = words
    }

    public toBech32(network = "mainnet"): string {
        return network === "mainnet" ? bech32.encode('wit', this.words, 66) : bech32.encode('twit', this.words, 67);
    }

    public toBytes20(): Uint8Array {
        return Uint8Array.from(bech32.fromWords(this.words).slice(0, 20))
    }

    public toBytes32(): Uint8Array {
        return Uint8Array.from([
            ...bech32.fromWords(this.words).slice(0, 20),
            ...new Array(12).fill(0),
        ]);
    }

    public toHexString(): string {
        return toHexString(this.toBytes20())
    }
}


/// ===================================================================================================================
export class Signature {

    static fromHexString(hex: string): Signature {
        return new Signature(fromHexString(hex))
    }

    public readonly bytes: Uint8Array;

    constructor (bytes: Uint8Array) {
        this.bytes = bytes
    }
    
    public toHexString(): string {
        return toHexString(this.bytes)
    }
}


/// ===================================================================================================================
export class RecoverableSignature extends Signature {

    static from(recoverable: any, msg: Uint8Array): RecoverableSignature {
        let bytes
        if (isHexString(recoverable)) {
            bytes = fromHexString(recoverable).slice(1)
        } else if (recoverable instanceof Buffer) {
            bytes = Uint8Array.from(recoverable.buffer).slice(1)
        } else if (recoverable instanceof Uint8Array) {
            bytes = recoverable.slice(1)
        } else {
            throw new TypeError(`RecoverableSignature: unsupported recoverable signature format: ${recoverable}`)
        }
        if (bytes.length !== 64) {
            throw new TypeError(`RecoverableSignatre: expected recoverable signature with length 65: ${toHexString(bytes)}`)
        } 
        return new RecoverableSignature(PublicKey.recoverFrom(recoverable, msg), bytes, msg)
    }

    static fromKeyedSignature(ks: KeyedSignature, msg: Uint8Array): RecoverableSignature {
        return new RecoverableSignature(
            PublicKey.fromProtobuf(ks.public_key),
            secp256k1.signatureImport(Uint8Array.from(ks.signature.Secp256k1.der)),
            msg
        )   
    }

    public readonly message: Uint8Array
    public readonly pubKey: PublicKey
    public readonly recoveryId: number
    
    constructor (pubKey: PublicKey, bytes: Uint8Array, msg: Uint8Array) {
        super(bytes)
        const pubKeyRaw = pubKey.toUint8Array()
        let recoveryId: number;
        for (recoveryId = 0; recoveryId < 4; recoveryId ++) {
            let recovered 
            try {
              recovered = secp256k1.ecdsaRecover(bytes, recoveryId, msg)
              if (matchingUint8Arrays(recovered, pubKeyRaw)) break;
            } catch {}
        }
        this.message = msg
        this.pubKey = pubKey
        this.recoveryId = recoveryId
    }

    public toHexString(): string {
        return toHexString([this.recoveryId, ...this.bytes])
    }

    public toKeyedSignature(): any {
        return {
            signature: { Secp256k1: { der: Array.from(secp256k1.signatureExport(this.bytes)) }},
            public_key: {
                bytes: Array.from(this.pubKey.bytes),
                compressed: this.pubKey.compressed,
            }
        }
    }

    public toProtobuf(): any {
        return {
            signature: { Secp256k1: { der: Array.from(secp256k1.signatureExport(this.bytes)) }},
            publicKey: { publicKey: Array.from([ this.pubKey.compressed, ...this.pubKey.bytes ]) },
        }
    }
}


/// ===================================================================================================================
export class TransmissionError extends Error {
    readonly error?: any;
    readonly inFlight: Transmission;
    constructor(inFlight: Transmission, error?: any) {
        super(JSON.stringify(error))
        delete error?.stack
        this.error = error
        this.inFlight = inFlight
    }
}


/// -------------------------------------------------------------------------------------------------------------------
/// --- Internal functions 

function matchingUint8Arrays(a: Uint8Array, b: Uint8Array) {
    return a.length === b.length && a.every((value, index) => value === b[index])
}
