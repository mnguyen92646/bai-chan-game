/* eslint-disable @next/next/no-img-element */
"use client";
import { useLanguage } from "@/lib/useLanguage";
import { tileInfo } from "@/lib/tileMeta";
import { tilePngSrc } from "@/lib/tileSrc";

const ranks = ["Nhất", "Nhì", "Tam", "Tứ", "Ngũ", "Lục", "Thất", "Bát", "Cửu"];
const suits = [{ id: "van", name: "Vạn" }, { id: "vanh", name: "Văn" }, { id: "sach", name: "Sách" }];
function Cards({ tiles }: { tiles: string[] }) {
  return <div className="guide-cards">{tiles.map((tile, index) => {
    const info = tileInfo(tile);
    const label = info.rank ? `${ranks[info.rank - 1]} ${info.suitNameVi}` : tile === "chi" ? "Chi Chi" : tile === "lao" ? "Lão" : "Thang";
    return <figure key={`${tile}-${index}`}><img src={tilePngSrc(tile)} alt={label} width="68" height="174" loading="lazy" /><figcaption>{label}</figcaption></figure>;
  })}</div>;
}
export function RulesGuide() {
  const { locale } = useLanguage();
  const copy = (vi: string, en: string) => locale === "vi" ? vi : en;
  return <article className="rules-guide">
    <p>{copy("Hướng dẫn bộ 120 quân và luật bàn chơi này. Học cách nhận quân, ghép bài và đi một lượt.", "A guide to this table’s 120-card deck: recognize cards, build combinations, and follow a turn.")}</p>
    <nav aria-label={copy("Mục lục", "Guide contents")}>
      <a href="#guide-cards">{copy("Nhận mặt quân", "Card reference")}</a>
      <a href="#guide-pairs">{copy("Chắn và cạ", "Pairs")}</a>
      <a href="#guide-turns">{copy("Lượt chơi", "Turns")}</a>
      <a href="#guide-win">{copy("Ù và hết nọc", "Winning & wall end")}</a>
    </nav>
    <section id="guide-cards">
      <h3>{copy("1. Hàng và chất", "1. Ranks and suits")}</h3>
      <p>{copy("Mỗi quân thường có một hàng (số 1–9) và một chất: Vạn, Văn hoặc Sách. Ví dụ: Tam Văn là hàng 3, chất Văn. Cùng hàng không có nghĩa là cùng quân: Tam Văn khác Tam Sách.", "Each numbered card has a rank (1–9) and a suit: Vạn, Văn, or Sách. Tam Văn means rank 3 in the Văn suit. Equal ranks do not make identical cards: Tam Văn differs from Tam Sách.")}</p>
      <p>{copy("Tên hàng: 1 Nhất · 2 Nhì · 3 Tam · 4 Tứ · 5 Ngũ · 6 Lục · 7 Thất · 8 Bát · 9 Cửu. Dùng ảnh và nhãn dưới đây để đối chiếu khi chơi.", "Rank names: 1 Nhất · 2 Nhì · 3 Tam · 4 Tứ · 5 Ngũ · 6 Lục · 7 Thất · 8 Bát · 9 Cửu. Compare the pictures and labels below with your hand.")}</p>
      <p>{copy("Có 27 mặt quân theo hàng và chất, cộng Chi Chi, Lão, Thang: 30 mặt quân. Mỗi mặt có 4 bản giống nhau, tổng cộng 120 quân.", "There are 27 rank-and-suit faces, plus Chi Chi, Lão, and Thang: 30 faces. Four identical copies of each make 120 cards.")}</p>
      <div className="guide-catalog">{ranks.map((rank, i) => <details key={rank} open={i === 2 ? true : undefined}>
        <summary>{i + 1} · {rank}</summary>
        <Cards tiles={suits.map(s => `${i + 1}_${s.id}`)} />
      </details>)}</div>
      <h4>{copy("Nhóm sáu quân đặc biệt", "The six special faces")}</h4>
      <Cards tiles={["1_van", "1_vanh", "1_sach", "chi", "lao", "thang"]} />
      <p>{copy("Theo luật bàn này, ba quân Nhất và Chi Chi, Lão, Thang có thể ghép với nhau thành cạ. Hai quân giống hệt nhau vẫn là chắn. Riêng Lão + Thang vẫn là mặc định cũ đang chờ xác nhận. Nếu nhóm Nhất/Yêu trên tay có số quân lẻ, được ăn cạ bằng quân lẻ để làm tròn bài, giữ lại các chắn. Cạ Nhất/Yêu có thể nằm trong bài ù, nhưng không được lấy cạ này làm đôi cuối để ù.", "At this table, the three Nhất faces and Chi Chi, Lão, Thang can pair with each other as cạ. Two identical copies still form Chắn. Lão + Thang remains an existing default awaiting confirmation. If the held Nhất/Yêu group has an odd number of cards, you may eat cạ with a spare card while keeping exact pairs intact. A mixed Nhất/Yêu pair may be in a winning hand, but cannot be the final pair that completes Ù.")}</p>
    </section>
    <section id="guide-pairs">
      <h3>{copy("2. Xếp bài thành bộ", "2. Build combinations")}</h3>
      <h4>Chắn</h4><Cards tiles={["3_vanh", "3_vanh"]} />
      <p>{copy("Hai quân giống hệt nhau: cùng hàng và cùng chất. Chắn trên tay được tính, không cần Ăn rồi hạ xuống bàn mới thành chắn.", "Two identical cards: same rank and suit. Concealed Chắn count; you do not have to claim and expose them first.")}</p>
      <h4>Cạ</h4><Cards tiles={["3_vanh", "3_sach"]} />
      <p>{copy("Hai quân cùng hàng, khác chất. Có thể Ăn để tạo cạ trước khi đủ chắn, nhằm làm tròn bài dần. Không cần đợi đủ chắn mới được ăn cạ.", "Two cards of the same rank in different suits. You may claim cạ before reaching your Chắn target, building pairs as the hand develops.")}</p>
      <h4>{copy("Không phải một cạ", "Not a cạ")}</h4><Cards tiles={["3_vanh", "4_sach"]} />
      <p>{copy("Tam Văn và Tứ Sách khác hàng nên không ghép thành cạ. Nhóm sáu quân đặc biệt là ngoại lệ đã nêu ở trên.", "Tam Văn and Tứ Sách have different ranks and cannot form cạ. The six special faces are the exception described above.")}</p>
      <h4>Chíu</h4><Cards tiles={["5_van", "5_van", "5_van", "5_van"]} />
      <p>{copy("Có ba quân giống hệt trên tay, bạn có thể Chíu khi quân thứ tư xuất hiện và được phép lấy. Hạ cả bốn quân; một Chíu tính là hai chắn. Chíu là lựa chọn của người chơi, không tự động thực hiện.", "With three identical cards in hand, you can claim Chíu when the fourth appears and the claim is allowed. Expose all four; one Chíu counts as two Chắn. Chíu is a player choice, not automatic.")}</p>
    </section>
    <section id="guide-turns">
      <h3>{copy("3. Chia bài và lượt chơi", "3. Deal and turn flow")}</h3>
      <p>{copy("Chơi 4 người: người đi đầu có 24 quân, ba người còn lại mỗi người 23 quân. Chơi 5 người: người đi đầu có 20 quân, bốn người còn lại mỗi người 19 quân. Người đi đầu đánh ngay, không bốc thêm; nếu bài đã đủ điều kiện thì có thể ù ngay. Các lượt đi theo chiều kim đồng hồ. Người ù mở đầu ván kế tiếp.", "Four players: the opener receives 24 cards, the others 23 each. Five players: the opener receives 20 cards, the others 19 each. The opener discards without drawing, or declares an immediate opening win if qualified. Play proceeds clockwise; the winner opens the next hand.")}</p>
      <dl>
        <dt>{copy("Nọc / Bốc", "Wall / Draw")}</dt>
        <dd>{copy("Nọc là chồng bài chưa dùng. Bốc phải lật quân ra bàn, không đưa thẳng vào tay kín. Người đủ điều kiện có thể phản ứng với quân đó.", "The wall is the undealt pile. A draw exposes a card on the table; it does not go straight into a concealed hand. Eligible players can react to it.")}</dd>
        <dt>Ăn / Đánh</dt>
        <dd>{copy("Ăn ghép quân trên bàn với một quân phù hợp trên tay, rồi hạ bộ đó. Sau khi ăn, chọn một quân để đánh. Đánh là đưa quân ra bàn cho lượt tiếp theo.", "Ăn combines an offered card with a matching card from your hand and exposes the pair. After eating, choose a card to discard (Đánh), offering it to the next turn.")}</dd>
        <dt>{copy("Chíu ngoài lượt: trả cửa", "Out-of-turn Chíu: return a card")}</dt>
        <dd>{copy("Ví dụ B bốc, D Chíu: D hạ bộ Chíu và trả một quân cho B. B có thể ăn quân đó rồi đánh quân khác, hoặc đánh tiếp chính quân D vừa trả. Không bỏ qua người chơi để chuyển lượt theo chỗ của D.", "Example: B draws and D claims Chíu. D exposes the quartet and returns a card to B. B may eat it and discard another card, or pass that same returned card onward. The interruption does not skip seats by continuing from D.")}</dd>
      </dl>
      <h4>{copy("Bỏ ăn", "Passing a match")}</h4>
      <p>{copy("Bỏ ăn chắn thì không được ăn, chíu hoặc đánh quân cùng mặt về sau, kể cả khi quân đó được bốc từ nọc. Bỏ cạ vẫn có thể chíu về sau; phạm vi cấm ăn cạ và việc ăn lại thành chắn còn đang có ý kiến khác nhau. Đã đánh một quân thì không được ăn lại quân cùng mặt thành chắn hoặc cạ. Đã ăn cạ thì không được đánh cả hai quân của một cạ. Không được tách một cạ đang có để ăn cạ khác cùng nhóm.", "After declining Chắn, you cannot later eat, Chíu or discard that face, including when it appears from the wall. Passing cạ still permits a later Chíu; the scope of the cạ ban and later Chắn claims remain disputed. A face you discarded cannot later be eaten as Chắn or cạ. After eating cạ, you cannot discard both sides of a cạ. You cannot split an existing cạ to eat another cạ of that group.")}</p>
    </section>
    <section id="guide-win">
      <h3>{copy("4. Ù và kết thúc ván", "4. Winning and ending a hand")}</h3>
      <p>{copy("Mốc chắn đã xác nhận: 5 người cần 6 chắn; 4 người cần 8 chắn. Chắn trên tay và bài đã hạ đều được tính; Chíu tính hai chắn. Toàn bộ bài phải ghép hết thành đôi: 10 đôi khi chơi 5 người, 12 đôi khi chơi 4 người; các đôi còn lại có thể là chắn hoặc cạ. Không được còn quân lẻ. Không được ù bằng Chi Chi, Lão hoặc Thang, kể cả chíu-ù. Vẫn được chíu Yêu nếu không ù.", "Confirmed Chắn targets: six with five players, eight with four. Concealed and exposed combinations count; Chíu counts as two Chắn. Every card must belong to a pair: 10 pairs with five players, 12 with four. Remaining pairs may be Chắn or cạ, with no unpaired cards. Chi Chi, Lão and Thang cannot complete a win, including Chíu-Ù. Nonwinning Chíu of Yêu is allowed.")}</p>
      <p>{copy("Quân bốc công khai có thể giúp bất kỳ người đủ điều kiện nào ù. Quân người khác đánh chỉ được dùng để chíu-ù. Xét ù trước chíu; nếu nhiều người cùng ù thì xét từ cửa có quân theo thứ tự chỗ ngồi. Quân trả cửa được chíu hoặc chíu-ù; ù thường bằng quân trả vẫn chờ làm rõ.", "Any eligible player may win on a public wall draw. Another player's discard can win only through Chíu-Ù. Wins take priority over Chíu; competing wins follow seat order from the active gate. Return cards allow Chíu and Chíu-Ù; ordinary wins on returns still need clarification.")}</p>
      <p>{copy("Bấm Bỏ ù thì không được ù bằng quân xuất hiện sau trong ván đó. Nếu đánh thay vì ù ngay lúc mở đầu, bạn cũng mất quyền ù về sau. Chưa áp dụng thời hạn tự động khi người chơi im lặng hoặc mất kết nối; hạn nhận lại chính quân vừa bỏ vẫn đang được hỏi thêm.", "Explicitly passing Ù gives up wins on later cards in that hand. Discarding instead of taking an opening win also gives up later wins. Silence or disconnection does not trigger a timeout; the deadline for reclaiming the same offered card remains unresolved.")}</p>
      <p>{copy("Khi ù, phải mở toàn bộ bài để mọi người kiểm tra. Hết nọc mà không ai ù thì kết thúc ván, không có người thắng; không trộn bài đã đánh trở lại nọc.", "A winner must expose the full hand so everyone can inspect it. An exhausted wall without a winner ends the hand as a draw; discards are not recycled.")}</p>
      <aside className="rules-note">{copy("Luật mới áp dụng từ ván chia tiếp theo. Còn ý kiến khác nhau về: ưu tiên chắn hay cạ, bỏ cạ rồi ăn chắn, số quân để lại trong nọc, trả cửa khi chíu liên tiếp, người mở đầu sau ván hòa và cách phạt. Các mặc định cũ ở những mục này vẫn giữ nguyên: ưu tiên chắn, bỏ cạ chỉ cấm cạ cùng mặt và vẫn cho ăn chắn, không để lại quân nọc, chíu tiếp trả về cửa bị gián đoạn, xử lý hết lượt cuối. Chưa tính cước hoặc báo/phạt.", "Updated rules apply to newly dealt hands. Disputes remain about Chắn versus cạ choice, later Chắn after passing cạ, the wall reserve, repeated Chíu returns, the opener after a drawn hand, and penalties. Existing defaults stay in place: prefer Chắn, an exact-face cạ pass ban that still allows later Chắn, no wall reserve, repeated returns to the interrupted gate, and completing the final turn. Scoring and penalty adjudication are not implemented.")}</aside>
    </section>
  </article>;
}
