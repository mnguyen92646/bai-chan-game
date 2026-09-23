const words = {
  en: {
    language:"Language", eyebrow:"A living record of how families play", title:"How does your family play?",
    intro:"Chắn, Bài Chắn, Tổ Tôm, or another game with these cards: tell me the rules you actually use. Different answers are welcome, especially details of a 120-card deck.",
    privacy:"This form is private to the researcher. It does not create a public GitHub issue and needs no account. Please leave out phone numbers, addresses, and other private details. I may summarize rules publicly; your name will appear only if you choose to be credited.",
    back:"← Back", next:"Continue →", review:"Review →", send:"Send rules ✓", sending:"Sending…", saved:"Draft saved on this device", step:"Part", of:"of", optional:"Optional", required:"Required", choose:"Choose one", unknown:"I don't know", other:"Other — explain below", noAnswer:"No answer", about:"Read about the game", game:"Play the game", successTitle:"Thank you for sharing!", successCopy:"Your answers were saved privately. I will compare them with other accounts and credit you only as requested.", reference:"Response reference", newResponse:"Start another response", missing:"Please complete the game name, deck size, source, attribution choice, and at least one rule about the deal, turns, claims, or winning.", failed:"The response could not be saved. Your draft remains on this device; please try again.", reviewLead:"Check the answers below. You can go back and change anything before sending.", sourceHelp:"Your own play, a relative's account, written instructions, or an online game? Please distinguish them.",
    sections:[
      {title:"Your game and deck", lead:"Start with what your group calls it and the physical cards on the table.", fields:[
        ["gameName","What do you call the game?","text","For example: Chắn, Bài Chắn, Tổ Tôm",true],
        ["deckSize","How many cards are in the deck?","select",["120 cards","100 cards","Another number","I don't know"],true],
        ["deckDetails","Which cards are included or removed?","textarea","For example, are Nhất Văn/Vạn/Sách, Lão, Thang, and Chi Chi included?"],
        ["specialCards","How do Nhất and Yêu cards pair or count?","textarea","Which pairs are valid? Can Chi Chi, Lão, or Thang make a winning hand?"]
      ]},
      {title:"Players and the deal", lead:"The exact counts help distinguish one family ruleset from another.", fields:[
        ["players","How many people usually play?","text","Four, five, or another number?"],
        ["dealFour","With four players, how many cards does each person receive?","textarea","Include the starting player and any card set aside."],
        ["dealFive","With five players, how many cards does each person receive?","textarea","Include the starting player if different."],
        ["stock","How many cards remain in the stock, and when does it run out?","textarea","Do you leave any marker or reserve cards aside?"]
      ]},
      {title:"A turn at your table", lead:"Walk through a turn as you would explain it to a new player.", fields:[
        ["turnOrder","Who starts, and which direction does play move?","textarea","What changes after a win or a drawn hand?"],
        ["draw","What happens when someone bốc (draws) a card?","textarea","Is it visible to everyone? Who can use it?"],
        ["discard","What happens when someone đánh (discards) a card?","textarea","Where does it go, and who may claim it?"],
        ["claim","How do players ăn (claim) a card as chắn or cạ?","textarea","Can a player choose a cạ when a chắn is available?"]
      ]},
      {title:"Special calls and restrictions", lead:"Please give a concrete example if your family has an unusual rule.", fields:[
        ["chiu","When may someone chíu four matching cards?","textarea","Who takes priority if another player wants to ù?"],
        ["returnCard","After chíu, where does the returned card go?","textarea","Can someone claim, chíu, or ù using that returned card?"],
        ["passRestrictions","If someone passes a claim or a win, what may they do later?","textarea","Are any cards or calls forbidden after passing?"],
        ["penalties","Are there redeals, prohibited moves, or penalties?","textarea","For example, no chắn after the deal, breaking a pair, or báo/phạt."]
      ]},
      {title:"Winning and scoring", lead:"This is where 100-card and 120-card accounts often differ.", fields:[
        ["winShape","What exactly makes a winning hand (ù)?","textarea","How many cards, chắn, cạ, or other groups? Please describe a real example."],
        ["minPairs","Is there a minimum number of chắn?","textarea","Does it change with four versus five players? How does a chíu count?"],
        ["winSource","Can a player win from a draw, discard, or returned card?","textarea","Can someone win immediately after the initial deal?"],
        ["scoring","How do you score a win?","textarea","Special calls, points, payments, and penalties are welcome."]
      ]},
      {title:"Source and permission", lead:"Help me label the evidence accurately when I compare accounts.", fields:[
        ["region","Where or with whom did you learn to play?","textarea","Region, generation, or family context only if you want to share."],
        ["source","How do you know these rules?","textarea","Your own play, a relative's explanation, a written source, or online?",true],
        ["attribution","May I credit your name or handle when summarizing?","select",["No, summarize anonymously","Yes, credit the name or handle below"],true],
        ["creditName","Name or handle for credit (only if you chose yes)","text","Leave blank for an anonymous summary."]
      ]}
    ]
  },
  vi: {
    language:"Ngôn ngữ",eyebrow:"Ghi lại cách chơi của từng gia đình",title:"Nhà bạn chơi thế nào?",
    intro:"Chắn, Bài Chắn, Tổ Tôm hoặc trò khác dùng bộ bài này: xin kể luật bạn thực sự chơi. Những cách chơi khác nhau đều quý, nhất là chi tiết về bộ 120 quân.",
    privacy:"Phiếu này chỉ gửi riêng cho người nghiên cứu, không tạo issue công khai trên GitHub và không cần tài khoản. Xin đừng ghi số điện thoại, địa chỉ hoặc thông tin riêng. Tôi có thể tóm tắt luật công khai; chỉ ghi tên bạn nếu bạn cho phép.",
    back:"← Quay lại",next:"Tiếp tục →",review:"Xem lại →",send:"Gửi câu trả lời ✓",sending:"Đang gửi…",saved:"Bản nháp đã lưu trên máy này",step:"Phần",of:"trên",optional:"Tùy chọn",required:"Bắt buộc",choose:"Chọn một",unknown:"Không nhớ / chưa biết",other:"Khác — giải thích bên dưới",noAnswer:"Chưa trả lời",about:"Đọc về trò chơi",game:"Chơi thử",successTitle:"Cảm ơn bạn đã chia sẻ!",successCopy:"Câu trả lời đã được lưu riêng. Tôi sẽ đối chiếu với các nguồn khác và chỉ ghi tên bạn theo lựa chọn của bạn.",reference:"Mã phiếu",newResponse:"Tạo phiếu khác",missing:"Xin ghi tên trò chơi, số quân, nguồn hiểu biết, cách ghi tên và ít nhất một luật về chia bài, lượt chơi, ăn bài hoặc ù.",failed:"Chưa lưu được câu trả lời. Bản nháp vẫn ở trên máy này; xin thử lại.",reviewLead:"Xin xem lại trước khi gửi. Có thể quay lại sửa bất cứ phần nào.",sourceHelp:"Bạn đã chơi, nghe người nhà kể, đọc luật hay chơi trực tuyến? Xin phân biệt các nguồn.",
    sections:[
      {title:"Trò chơi và bộ bài",lead:"Trước hết, nhà bạn gọi trò chơi và bộ bài này là gì?",fields:[
        ["gameName","Nhà bạn gọi trò này là gì?","text","Ví dụ: Chắn, Bài Chắn, Tổ Tôm",true],
        ["deckSize","Bộ bài có bao nhiêu quân?","select",["120 quân","100 quân","Số khác","Không nhớ / chưa biết"],true],
        ["deckDetails","Dùng hoặc bỏ những quân nào?","textarea","Có dùng Nhất Văn/Vạn/Sách, Lão, Thang và Chi Chi không?"],
        ["specialCards","Quân Nhất và Yêu ghép đôi hoặc tính thế nào?","textarea","Những cạ nào hợp lệ? Có được ù bằng Chi Chi, Lão hoặc Thang không?"]
      ]},
      {title:"Người chơi và chia bài",lead:"Số quân cụ thể giúp phân biệt các luật gia đình.",fields:[
        ["players","Thường chơi mấy người?","text","Bốn, năm hay số khác?"],
        ["dealFour","Chơi bốn người: mỗi người được chia mấy quân?","textarea","Người đi đầu có khác không? Có để riêng quân nào không?"],
        ["dealFive","Chơi năm người: mỗi người được chia mấy quân?","textarea","Xin ghi riêng người đi đầu nếu khác."],
        ["stock","Nọc còn mấy quân và khi nào hết ván?","textarea","Có quân đánh dấu hay để lại mấy quân không?"]
      ]},
      {title:"Một lượt chơi",lead:"Hãy kể một lượt như khi bạn chỉ người mới chơi.",fields:[
        ["turnOrder","Ai đi đầu và chơi theo chiều nào?","textarea","Ván sau khi ù hoặc hòa thì ai đi đầu?"],
        ["draw","Khi bốc một quân thì làm gì?","textarea","Quân có mở cho mọi người xem không? Ai được dùng?"],
        ["discard","Khi đánh một quân thì làm gì?","textarea","Đưa về cửa nào? Ai được ăn?"],
        ["claim","Ăn quân thành chắn hoặc cạ thế nào?","textarea","Có được chọn cạ khi cũng có thể ăn chắn không?"]
      ]},
      {title:"Chíu và luật hạn chế",lead:"Nếu có luật đặc biệt, xin kể một ví dụ cụ thể.",fields:[
        ["chiu","Khi nào được chíu bốn quân giống nhau?","textarea","Nếu người khác muốn ù cùng quân thì ai được ưu tiên?"],
        ["returnCard","Sau khi chíu, quân trả về cửa nào?","textarea","Có ai được ăn, chíu hoặc ù bằng quân trả không?"],
        ["passRestrictions","Đã bỏ ăn hoặc bỏ ù thì về sau bị cấm gì?","textarea","Có hạn chế quân hoặc cách ăn nào không?"],
        ["penalties","Có chia lại, nước cấm hoặc luật phạt không?","textarea","Ví dụ không có chắn khi chia, đánh vỡ chắn, báo/phạt."]
      ]},
      {title:"Ù và tính điểm",lead:"Đây thường là chỗ cách chơi 100 và 120 quân khác nhau.",fields:[
        ["winShape","Bài thế nào mới được ù?","textarea","Cần bao nhiêu quân, chắn, cạ hoặc bộ khác? Xin cho ví dụ thật."],
        ["minPairs","Cần ít nhất bao nhiêu chắn?","textarea","Bàn bốn và năm người có khác không? Một chíu tính mấy chắn?"],
        ["winSource","Có được ù bằng quân bốc, quân đánh hoặc quân trả không?","textarea","Vừa chia xong đủ bài thì được ù ngay không?"],
        ["scoring","Nhà bạn tính điểm ù thế nào?","textarea","Cước, điểm, trả tiền và phạt nếu có."]
      ]},
      {title:"Nguồn và ghi tên",lead:"Thông tin này giúp tôi ghi rõ nguồn khi đối chiếu các cách chơi.",fields:[
        ["region","Bạn học chơi ở đâu hoặc với ai?","textarea","Vùng miền, thế hệ hoặc gia đình nếu bạn muốn chia sẻ."],
        ["source","Bạn biết luật này từ đâu?","textarea","Tự chơi, người nhà kể, sách, hay trò trực tuyến?",true],
        ["attribution","Tôi có thể ghi tên bạn khi tóm tắt luật không?","select",["Không, xin ghi ẩn danh","Được, ghi tên hoặc biệt danh bên dưới"],true],
        ["creditName","Tên hoặc biệt danh muốn ghi (chỉ nếu chọn đồng ý)","text","Để trống nếu muốn ẩn danh."]
      ]}
    ]
  }
};

const $ = id => document.getElementById(id);
const storageKey = "bai-chan-public-rules-v1";
let saved;
try { saved = JSON.parse(localStorage.getItem(storageKey) || "null"); } catch {}
const state = saved && typeof saved === "object" && saved.answers && typeof saved.answers === "object" ? saved : { answers:{}, step:0, startedAt:Date.now() };
const initialLocale = new URLSearchParams(location.search).get("lang");
let locale = initialLocale === "vi" || initialLocale === "en" ? initialLocale : (navigator.language.toLowerCase().startsWith("vi") ? "vi" : "en");
let busy = false;
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{}}
function node(tag,attributes={},text){const el=document.createElement(tag);for(const [key,value] of Object.entries(attributes))el.setAttribute(key,value);if(text!==undefined)el.textContent=text;return el;}
function render(){
  const w=words[locale],count=w.sections.length;document.documentElement.lang=locale;document.title=w.title+" · Bài Chắn";
  $("language").value=locale;$("language-label").textContent=w.language;$("eyebrow").textContent=w.eyebrow;$("title").textContent=w.title;$("intro").textContent=w.intro;$("privacy").textContent=w.privacy;
  $("about-link").textContent=w.about;$("about-link").href=`https://michaelnguyen.net/baichan${locale==="vi"?"-vi":""}.html`;$("game-link").textContent=w.game;
  $("step-count").textContent=`${w.step} ${Math.min(state.step+1,count)} ${w.of} ${count}`;$("saved").textContent=w.saved;$("progress-fill").style.width=`${(Math.min(state.step+1,count)/count)*100}%`;
  $("back").textContent=w.back;$("back").hidden=state.step===0;$("next").textContent=state.step<count-1?w.next:state.step===count-1?w.review:w.send;
  const panel=$("questions");panel.replaceChildren();$("error").hidden=true;
  if(state.step<count){
    const section=w.sections[state.step];panel.append(node("h2",{},section.title),node("p",{class:"lead"},section.lead));
    for(const [key,label,type,help,required] of section.fields){
      const wrap=node("label",{class:"field"}),heading=node("span",{},label),control=type==="textarea"?node("textarea",{rows:"4",maxlength:"2000"}):type==="select"?node("select"):node("input",{type:"text",maxlength:"2000"});
      if(required)heading.append(node("small",{},w.required));
      if(type==="select"){
        control.append(node("option",{value:""},w.choose));
        for(const [index,option] of help.entries())control.append(node("option",{value:words.en.sections[state.step].fields.find(field=>field[0]===key)[3][index]},option));
      }else control.placeholder=help;
      control.value=state.answers[key]||"";control.addEventListener("input",()=>{state.answers[key]=control.value;persist();});
      wrap.append(heading,control);panel.append(wrap);
    }
    panel.append(node("p",{class:"hint"},locale==="vi"?"Có thể bỏ qua câu chưa nhớ và ghi cách chơi khác trong ô trả lời.":"You can skip details you do not remember and describe another way of playing in the answer box."));
  }else{
    panel.append(node("h2",{},locale==="vi"?"Xem lại câu trả lời":"Review your answers"),node("p",{class:"lead"},w.reviewLead));
    for(const section of w.sections){const group=node("div",{class:"review"});group.append(node("h3",{},section.title));const lines=section.fields.map(([key,label])=>state.answers[key]?`${label}\n${state.answers[key]}`:null).filter(Boolean);group.append(node("p",{},lines.length?lines.join("\n\n"):w.noAnswer));panel.append(group);}
  }
}
function showError(message){$("error").textContent=message;$("error").hidden=false;$("error").scrollIntoView({behavior:"smooth",block:"center"});}
$("back").addEventListener("click",()=>{state.step=Math.max(0,state.step-1);persist();render();window.scrollTo(0,0);});
$("survey").addEventListener("submit",event=>event.preventDefault());
$("next").addEventListener("click",async()=>{
  if(state.step<words[locale].sections.length){state.step++;persist();render();window.scrollTo(0,0);return;}
  if(busy)return;
  const a=state.answers,w=words[locale];if(!a.gameName?.trim()||!a.deckSize||!a.source?.trim()||!a.attribution||!["dealFour","dealFive","turnOrder","claim","winShape"].some(k=>a[k]?.trim())){showError(w.missing);return;}
  busy=true;$("next").disabled=true;$("next").textContent=w.sending;
  try{
    const response=await fetch("/api/submissions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,answers:a,startedAt:state.startedAt,website:$("website").value})});
    const result=await response.json();if(!response.ok)throw new Error(result.error||w.failed);
    $("survey").hidden=true;$("success").hidden=false;$("success-title").textContent=w.successTitle;$("success-copy").textContent=w.successCopy;$("reference").textContent=`${w.reference}: ${result.id}`;$("new-response").textContent=w.newResponse;
    try{localStorage.removeItem(storageKey);}catch{}
    window.scrollTo(0,0);
  }catch(error){showError(error instanceof Error?error.message:w.failed);$("next").textContent=w.send;}
  finally{busy=false;$("next").disabled=false;}
});
$("new-response").addEventListener("click",()=>location.reload());
$("language").addEventListener("change",event=>{locale=event.target.value;const url=new URL(location);url.searchParams.set("lang",locale);history.replaceState({},"",url);render();});
render();
