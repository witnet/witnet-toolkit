export * as cbor from 'cbor'

export {
  fromHexString,
  fromNanowits,
  fromWits,
  ipIsPrivateOrLocalhost,
  isHexString,
  isHexStringOfLength,
  parseURL, 
  toHexString,
  toUtf8Array, 
  utf8ArrayToStr,
} from "../bin/helpers"

export {
  decipherXprv,
  parseXprv,
  sha256
} from "./crypto/utils"

export {
  execRadonBytecode,
  parseRadonScript,
  searchRadonAssets,
} from "./radon/utils"

import { RadonModal, RadonRequest, RadonTemplate } from "./radon"
import { flattenRadonAssets, requireRadonAsset } from "./radon/utils"

export function flattenRadonRequests(assets: any): Array<RadonRequest> {
  return flattenRadonAssets(assets, RadonRequest)
}

export function flattenRadonTemplates(assets: any): Array<RadonTemplate> {
  return flattenRadonAssets(assets, RadonTemplate)
}

export function flattenRadonModals(assets: any): Array<RadonModal> {
  return flattenRadonAssets(assets, RadonModal)
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
