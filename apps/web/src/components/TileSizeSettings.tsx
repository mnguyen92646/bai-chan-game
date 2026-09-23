"use client";
import { useLanguage } from "@/lib/useLanguage";
import type { TileSize } from "@/lib/useTileSize";
import { Card } from "@/components/GameTable";

export function TileSizeSettings({ size, change }: { size: TileSize; change: (size: TileSize) => void }) {
  const { locale } = useLanguage();
  const copy = (en: string, vi: string) => locale === "vi" ? vi : en;
  return <section className="tile-size-settings">
    <fieldset>
      <legend>{copy("Tile size", "Cỡ quân bài")}</legend>
      <div className="tile-size-options">{([
        [1, copy("Automatic", "Tự động")],
        [1.5, copy("Large", "Lớn")],
        [2, copy("Extra large", "Rất lớn")],
      ] as const).map(([value, label]) => <label key={value} className={size === value ? "selected" : ""}>
        <input type="radio" name="tile-size" checked={size === value} onChange={() => change(value)} />
        <span>{label}</span>
      </label>)}</div>
    </fieldset>
    <div className="tile-size-preview" aria-hidden="true"><Card tile="3_vanh" /><Card tile="5_sach" /></div>
    <p>{copy("Saved on this device. Your phone’s larger text size is always respected. Bigger cards may use more rows.", "Lưu trên thiết bị này. Vẫn giữ cỡ lớn nếu điện thoại đã tăng cỡ chữ. Quân bài lớn hơn có thể xếp thành nhiều hàng.")}</p>
  </section>;
}
