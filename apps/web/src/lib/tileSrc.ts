import { ASSET_VERSION } from "./assetVersion";

export function tilePngSrc(tileId: string) {
  return `/tiles/png/${tileId}.png?v=${encodeURIComponent(ASSET_VERSION)}`;
}

export function backPngSrc() {
  return `/tiles/back.png?v=${encodeURIComponent(ASSET_VERSION)}`;
}
