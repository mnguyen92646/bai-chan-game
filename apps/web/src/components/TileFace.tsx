import Image from "next/image";

export type TileCode = "chi" | `${2|3|4|5|6|7|8|9}_${"van"|"vanh"|"sach"}`;

export function TileFace({
  tile,
  size = 64,
  className = "",
  format = (process.env.NEXT_PUBLIC_TILE_FORMAT as "png" | "svg" | undefined) ?? "png"
}: {
  tile: TileCode;
  size?: number;
  className?: string;
  format?: "png" | "svg";
}) {
  // Asset contract (for future replacements):
  //   public/tiles/png/<tile>.png
  //   public/tiles/svg/<tile>.svg
  const v = encodeURIComponent(require("@/lib/assetVersion").ASSET_VERSION);
  const src = format === "png" ? `/tiles/png/${tile}.png?v=${v}` : `/tiles/svg/${tile}.svg?v=${v}`;
  const w = size;
  const h = Math.round((size * 4) / 3);

  return (
    <div className={className} style={{ width: w, height: h }}>
      <Image src={src} alt={tile} width={w} height={h} priority />
    </div>
  );
}
