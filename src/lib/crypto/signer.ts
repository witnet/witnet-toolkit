const secp256k1 = require('@noble/secp256k1')
import * as utils from "../utils"

import { Balance, Network, QueryStakesOrder, StakeEntry, UtxoMetadata } from "../types"
import { IBIP32, IProvider, ISigner } from "./interfaces"
import { KeyedSignature, PublicKey, PublicKeyHashString, UtxoSelectionStrategy } from "./types"

export class Signer implements ISigner {
    
    protected node: IBIP32;
    protected utxos: Array<UtxoMetadata> = []
    
    public readonly provider: IProvider;
    public strategy: UtxoSelectionStrategy;

    constructor(node: IBIP32, provider: IProvider, strategy?: UtxoSelectionStrategy) {
        this.node = node
        this.provider = provider
        this.strategy = strategy || UtxoSelectionStrategy.SmallFirst
        if (!provider.network) {
            throw Error(`Signer: interal error: unintialized provider.`)
        }
    }

    public get network(): Network {
        return this.provider.network || "mainnet"
    }

    public get pkh(): string {
        return this.publicKey.hash().toBech32(this.network)
    }

    public get publicKey(): PublicKey {
        return PublicKey.fromUint8Array(this.node.publicKey)
    }

    public addUtxos(...utxos: Array<UtxoMetadata>) {
        // avoid adding duplicates
        const existingPointers = new Set(this.utxos.map(cached => cached.output_pointer));
        const newUtxos = utxos.filter(utxo => !existingPointers.has(utxo.output_pointer))
        this.utxos.push(...newUtxos)
    }

    public consumeUtxos(index: number): any {
        this.utxos.splice(0, index)
    }

    public async getDelegateNonce(validator: PublicKeyHashString): Promise<number> {
        return this.provider
            .stakes({ filter: {
                validator,
                withdrawer: this.pkh
            }}).then(([entry, ]) => entry.value.nonce)
    }

    public async getUtxos(reload = false): Promise<Array<UtxoMetadata>> {
        if (reload) this.consumeUtxos(0)
        if (this.utxos.length === 0) {
            const now = Math.floor(Date.now() / 1000)
            this.utxos = (await this.provider.getUtxoInfo(this.pkh)).filter(utxo => utxo.timelock <= now)
        }
        return this.utxos
    }

    public async selectUtxos(strategy?: UtxoSelectionStrategy): Promise<Array<UtxoMetadata>> {
        if (this.utxos.length === 0) {
            await this.getUtxos()
        }
        switch (strategy || this.strategy) {
            case UtxoSelectionStrategy.BigFirst:
                this.utxos = this.utxos.sort((a, b) => b.value - a.value)
                break

            case UtxoSelectionStrategy.Random:
                const len = this.utxos.length
                for (let i = 0; i < len; i ++) {
                    const index = Math.floor(Math.random() * len - i)
                    const tmp = this.utxos[index]
                    this.utxos[index] = this.utxos[len - i - 1]
                    this.utxos[len - i - 1] = tmp
                }
                break

            case UtxoSelectionStrategy.SmallFirst:
                this.utxos = this.utxos.sort((a, b) => a.value - b.value)
                break
        }
        return this.utxos
    }

    public signHash(hash: any): KeyedSignature {
        let buffer: Buffer;
        if (hash instanceof Uint8Array) {
            buffer = Buffer.from(hash)
        } else if (hash instanceof Buffer) {
            buffer = hash
        } else if (typeof hash === 'string') {
            buffer = Buffer.from(utils.fromHexString(hash))           
        } else {
            throw new Error(`${this.constructor.name}: unsupported hash value: ${hash}`)
        }
        if (!buffer || buffer.length !== 32) {
            throw new Error(`${this.constructor.name}: invalid hash length: ${buffer.length} != 32`)
        } else if (this.node.privateKey) {
            const msg = Uint8Array.from(buffer)
            const privateKey = Uint8Array.from(Buffer.from(this.node.privateKey))
            const signature = secp256k1.ecdsaSign(msg, privateKey).signature
            const der = secp256k1.signatureExport(signature)
            return {
                public_key: {
                    compressed: this.publicKey.compressed,
                    bytes: Array.from(this.publicKey.bytes),
                },
                signature: {
                    Secp256k1: {
                        der: Array.from(der),
                    }
                }
            }
        } else {
            throw Error(`Signer: invalid BIP32 node: no private key`)
        }
    }

    /// IAccountable ----------------------------------------------------------

    public async countUtxos(reload?: boolean): Promise<number> {
        if (reload || this.utxos.length === 0) await this.getUtxos(true)
        return this.utxos.length
    }

    public async getBalance(): Promise<Balance> {
        return this.provider.getBalance(this.pkh)
    }

    public async getDelegates(order?: QueryStakesOrder): Promise<Array<StakeEntry>> {
        return this.provider.stakes({
            filter: { withdrawer: this.pkh },
            params: { order },
        })
    }
}
