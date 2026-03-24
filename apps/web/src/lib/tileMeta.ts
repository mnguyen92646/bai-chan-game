export type TileInfo = {
  id: string;
  suit?: "van" | "vanh" | "sach";
  rank?: number;
  rankNameVi?: string;
  rankNameEn?: string;
  suitNameVi?: string;
  suitNameEn?: string;
  isSpecial6?: boolean;
  labelVi: string;
  labelEn: string;
};

const rankVi: Record<number, string> = {
  1: "nhất",
  2: "nhì",
  3: "tam",
  4: "tứ",
  5: "ngũ",
  6: "lục",
  7: "thất",
  8: "bát",
  9: "cửu"
};

const rankEn: Record<number, string> = {
  1: "one (nhất)",
  2: "two (nhì)",
  3: "three (tam)",
  4: "four (tứ)",
  5: "five (ngũ)",
  6: "six (lục)",
  7: "seven (thất)",
  8: "eight (bát)",
  9: "nine (cửu)"
};

const suitVi: Record<string, string> = {
  van: "vạn",
  vanh: "văn",
  sach: "sách"
};

const suitEn: Record<string, string> = {
  van: "van",
  vanh: "văn",
  sach: "sách"
};

export function tileInfo(id: string): TileInfo {
  // Special Yêu column tiles
  if (id === "lao" || id === "chi" || id === "thang") {
    const vi = id === "lao" ? "lão" : id === "chi" ? "chi" : "thang";
    const en = id === "lao" ? "lao" : id === "chi" ? "chi" : "thang";
    return {
      id,
      isSpecial6: true,
      labelVi: `yêu · ${vi}`,
      labelEn: `yeu · ${en}`
    };
  }

  const m = id.match(/^(\d)_(van|vanh|sach)$/);
  if (m) {
    const rank = Number(m[1]);
    const suit = m[2] as "van" | "vanh" | "sach";
    const isSpecial6 = rank === 1;
    return {
      id,
      rank,
      suit,
      rankNameVi: rankVi[rank] ?? String(rank),
      rankNameEn: rankEn[rank] ?? String(rank),
      suitNameVi: suitVi[suit] ?? suit,
      suitNameEn: suitEn[suit] ?? suit,
      isSpecial6,
      labelVi: `${rankVi[rank] ?? rank} · ${suitVi[suit] ?? suit}${isSpecial6 ? " (special 6)" : ""}`,
      labelEn: `${rankEn[rank] ?? rank} · ${suitEn[suit] ?? suit}${isSpecial6 ? " (special 6)" : ""}`
    };
  }

  return { id, labelVi: id, labelEn: id };
}
