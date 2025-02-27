const secp256k1 = require("secp256k1")

import { bech32 } from 'bech32'
import { createDecipheriv, createHash, pbkdf2Sync } from 'crypto'

export { bech32 } from 'bech32'

export { PrivateKey, PublicKey, PublicKeyHash, KeyedSignature, RecoverableSignature, Signature } from "./types"

const CHAIN_CODE_LENGTH = 32
const DEPTH_LENGTH = 1
const KEY_LENGTH = 33
const KEY_PATH_LENGTH = 4

const BECH32_LIMIT = (
    DEPTH_LENGTH 
        + ((Math.pow(256, DEPTH_LENGTH) - 1) * KEY_PATH_LENGTH) 
        + CHAIN_CODE_LENGTH 
        + KEY_LENGTH
);

const getExpectedDataLength = (depth: number) => (
    DEPTH_LENGTH
        + depth * KEY_PATH_LENGTH
        + CHAIN_CODE_LENGTH
        + KEY_LENGTH
);

export function decipherXprv(slip32: string, passwd: string): string {
    const { prefix, words } = bech32.decode(slip32, BECH32_LIMIT)
    if (prefix !== "xprv") {
        throw Error(`Invalid XPRV header: "${prefix}" != "xprv"`)
    }
    const buffer = new Uint8Array(bech32.fromWords(words)).buffer
    const iv = buffer.slice(0, 16)
    const salt = buffer.slice(16, 48)
    const data = buffer.slice(48)
    const key = pbkdf2Sync(passwd, Buffer.from(salt), 10000, 32, 'sha256')    
    const decipher = createDecipheriv("aes-256-cbc", key, Buffer.from(iv))
    let decrypted = decipher.update(Buffer.from(data), undefined, 'utf-8')
    decrypted += decipher.final('utf-8')
    return decrypted
}

export const parseXprv = (slip32: string): {
    chainCode: Uint8Array,
    keyPath: Array<number>,
    privateKey: Uint8Array,
} => {
    // decode slip32 string
    const { prefix, words } = bech32.decode(slip32, BECH32_LIMIT)
    const bytes = bech32.fromWords(words)

    // check prefix
    if (prefix !== "xprv") {
        throw Error(`Invalid XPRV: bad header: "${prefix}" != "xprv"`)
    }

    // check expected data length
    const depth = bytes[0]
    if (depth !== 0) {
        throw Error(`Invalid XPRV: not a master private key (depth: ${depth})`)
    }
    const expectedLength = getExpectedDataLength(depth)
    if (bytes.length !== expectedLength) {
        throw Error(
            "Invalid XPRV: bad data length"
                + `(expected: ${expectedLength}, was: ${bytes.length}`
        )
    }
    const buffer = new Uint8Array(bytes).buffer

    // extract key path (32-bit unsigned integers, big endian)
    const keyPath: Array<number> = []
    const keyPathView = new DataView(buffer, DEPTH_LENGTH, depth * KEY_PATH_LENGTH)
    for (let i = 0; i < depth; i++) {
        keyPath.push((keyPathView.getUint32(i * KEY_PATH_LENGTH, false)))
    }

    // extract chain code
    const chainCode: Uint8Array = new Uint8Array(CHAIN_CODE_LENGTH)
    const chainCodeOffset = DEPTH_LENGTH + depth * KEY_PATH_LENGTH
    const chainCodeView = new DataView(buffer, chainCodeOffset, CHAIN_CODE_LENGTH)
    for (let i = 0; i < chainCode.length; i++) {
        chainCode[i] = (chainCodeView.getUint8(i))
    }

    // extract key bytes
    const privateKey: Uint8Array = new Uint8Array(KEY_LENGTH)
    const privateKeyView = new DataView(buffer, chainCodeOffset + CHAIN_CODE_LENGTH)
    for (let i = 0; i < privateKey.length; i++) {
        privateKey[i] = (privateKeyView.getUint8(i))
    }

    // check if private or public key are valid
    if (privateKey[0] !== 0 || !secp256k1.privateKeyVerify(privateKey.slice(1))) {
        throw Error(`Malformed slip32: not a private key`)
    } 

    return {
        chainCode,
        keyPath,
        privateKey: privateKey.slice(1),
    }
};

export function sha256(buffer: any) {
    const hash = createHash('sha256')
    hash.update(buffer)
    return hash.digest()
}
