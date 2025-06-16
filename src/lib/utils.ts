export * as cbor from 'cbor'

export {
  fromHexString,
  ipIsPrivateOrLocalhost,
  isHexString,
  isHexStringOfLength,
  parseURL, 
  toHexString,
  toUtf8Array, 
  utf8ArrayToStr,
  toUtf16Bytes,
} from "../bin/helpers"

export {
  ecdsaVerify,
  decipherXprv,
  parseXprv,
  sha256,
  totalCoins,
} from "./crypto/utils"

export {
  execRadonBytecode,
  parseRadonScript,
  searchRadonAssets,
} from "./radon/utils"

import { toHexString, toUtf16Bytes } from "../bin/helpers"
import { sha256 } from "./crypto/utils"
import { RadonModal, RadonRequest, RadonTemplate } from "./radon"
import { flattenRadonAssets, requireRadonAsset } from "./radon/utils"

export function digestMessage(text: string): Buffer<ArrayBufferLike> {
  return sha256(
    new Uint8Array(toUtf16Bytes(text))
  );
}

export function flattenRadonRequests(assets: any): Record<string, RadonRequest> {
  return Object.fromEntries(
    flattenRadonAssets(assets, RadonRequest).map(asset => Object.entries(asset))
  )
}

export function flattenRadonTemplates(assets: any): Record<string, RadonTemplate> {
  return Object.fromEntries(
    flattenRadonAssets(assets, RadonTemplate).map(asset => [ asset.key, asset. artifact ])
  )
}

export function flattenRadonModals(assets: any): Record<string, RadonModal> {
  return Object.fromEntries(
    flattenRadonAssets(assets, RadonModal).map(asset => Object.entries(asset))
  )
}

export function requireRadonRequest(artifact: string, assets?: any): RadonRequest | undefined {
  return requireRadonAsset({ artifact, assets, type: RadonRequest })
}

export function requireRadonTemplate(artifact: string, assets?: any): RadonTemplate | undefined {
  return requireRadonAsset({ artifact, assets, type: RadonTemplate })
}

export function requireRadonModal(artifact: string, assets?: any): RadonModal | undefined {
  return requireRadonAsset({ artifact, assets, type: RadonModal })
}

export function txJsonReplacer(key: string, value: string) {
  switch (key) {
      case 'bytes':
      case 'der':
          return toHexString(value, true)
      case 'tx':
          return JSON.stringify(value, txJsonReplacer)
      case 'data_request':
          return RadonRequest.fromProtobuf(value)
      default:
          return value
  }
}