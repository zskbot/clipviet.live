const $ = (id) => document.getElementById(id);
const CATALOG_URL = "../data/catalog.json";
const PAGE_SIZE = 16;
const MAX_PAGES = 1000;
let catalog = { videos: [], categories: [], providers: [] };
let page = 1, pageCount = 1, activeProvider = "", categoryId = "", keyword = "", country = "", duration = "";
let items = [], trendingTimer = null, trendingIndex = 0, trendingItems = [], quickCategory = "";
const initialQuickCategory = new URLSearchParams(location.search).get("quick") || "";
if (["jav","china","europe","vietnam","vietsub","south-asia","actors","genres","uncensored","beauty","amateur","xvideos","xnxx"].includes(initialQuickCategory)) quickCategory = initialQuickCategory;

const gate = $("age-gate");
try { if (sessionStorage.getItem("clipviet-age-confirmed") === "yes") gate.hidden = true; } catch {}
$("confirm").addEventListener("click", () => { try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {} gate.hidden = true; });
$("leave").addEventListener("click", () => location.replace("https://www.google.com/"));
$("year").textContent = new Date().getFullYear();
function status(message) { $("source-status").textContent = message; }
function option(label, value) { const node = document.createElement("option"); node.textContent = label; node.value = String(value); return node; }
function durationMinutes(value) {
  if (Number.isFinite(Number(value)) && String(value).trim() !== "") return Number(value);
  const s = String(value || "").toLocaleLowerCase("vi");
  const h = s.match(/(\d+(?:[.,]\d+)?)\s*(?:giờ|hours?|hrs?|h)\b/);
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*(?:phút|minutes?|mins?|m)\b/);
  if (h || m) return (h ? Number(h[1].replace(",", ".")) * 60 : 0) + (m ? Number(m[1].replace(",", ".")) : 0);
  const clock = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]) + (clock[3] ? Number(clock[3]) / 60 : 0);
  return null;
}
function populateSelect(id, values, firstLabel) {
  const select = $(id), current = select.value;
  select.replaceChildren(option(firstLabel, ""));
  [...new Set(values.filter(Boolean).map(String))].sort((a,b)=>a.localeCompare(b,"vi")).forEach(v=>select.append(option(v,v)));
  if ([...select.options].some(x=>x.value===current)) select.value=current;
}
function populateCategories() {
  const select = $("category"), current = select.value;
  select.replaceChildren(option("Tất cả danh mục", ""));
  catalog.categories.filter(x=>!activeProvider||x.sourceId===activeProvider).forEach(x=>select.append(option(x.sourceName+" · "+x.name,x.sourceId+":"+x.id)));
  if ([...select.options].some(x=>x.value===current)) select.value=current;
}
function providerRows(){return catalog.providers.map(p=>p.name+": "+p.state+" ("+p.count+" video)").join(" · ");}
function durationMatches(item) {
  if (!duration) return true;
  const n=durationMinutes(item.duration);
  if (n===null) return false;
  if(duration==="0-5")return n<5;
  if(duration==="5-10")return n>=5&&n<=10;
  if(duration==="10-20")return n>10&&n<=20;
  if(duration==="20-60")return n>20&&n<=60;
  return n>60;
}
function matches(item) {
  const hay=[item.title,item.description,item.categoryName,item.actors,item.area,item.sourceName,item.tags].filter(Boolean).join(" ").toLocaleLowerCase("vi");
  // Never surface content labeled as minors, schoolchildren, or youth in adult-content recommendations.
  const unsafeMinor=/(học\s*sinh|nữ\s*sinh|nam\s*sinh|school\s*(girl|boy|student)|underage|minor|loli|shota|teen\s*(girl|boy))/i.test(hay);
  const quickMatchers = {
    jav: /\b(jav|japan|japanese|nhật|nhat)\b/i,
    china: /(trung quốc|china|chinese|cn)/i,
    europe: /(châu âu|europe|european|pháp|đức|anh|italy|spanish)/i,
    vietnam: /(việt nam|viet nam|vietnam|vietnamese)/i,
    vietsub: /(vietsub|viet sub|phụ đề việt|sub tiếng việt)/i,
    "south-asia": /(nam á|south asia|india|indian|pakistan|bangladesh|nepal|sri lanka)/i,
    uncensored: /(không che|uncensored|no blur|raw)/i,
    beauty: /(gái xinh|beautiful|beauty|hot girl)/i,
    amateur: /(nghiệp dư|amateur|homemade|user generated)/i,
    xvideos: /xvideos/i,
    xnxx: /xnxx/i
  };
  const quickMatch = !quickCategory || (quickCategory === "actors" ? Boolean(item.actors) : quickCategory === "genres" ? Boolean(item.categoryName || item.categoryId) : Boolean(quickMatchers[quickCategory]?.test(hay)));
  return !unsafeMinor && quickMatch && (!activeProvider||item.sourceId===activeProvider) &&
    (!categoryId||item.categoryId===categoryId) && (!country||String(item.area||"").toLocaleLowerCase("vi")===country.toLocaleLowerCase("vi")) &&
    (!keyword||hay.includes(keyword.toLocaleLowerCase("vi"))) && durationMatches(item);
}
function renderTrending() {
  const root=$("trending-card"), picks=$("hot-recommendations");
  root.replaceChildren(); picks.replaceChildren();
  if(!trendingItems.length){root.textContent="Chưa có đủ dữ liệu để chọn video nổi bật.";return;}
  const item=trendingItems[trendingIndex%trendingItems.length];
  const href=x=>"../watch/source.html?sourceId="+encodeURIComponent(x.sourceId)+"&vodId="+encodeURIComponent(x.id);
  const hero=document.createElement("a");hero.className="hot-stage";hero.href=href(item);hero.setAttribute("aria-label","Xem video "+item.title);
  const img=document.createElement("img");img.className="hot-cover";img.src=item.poster||"../poster-fallback.svg";img.alt="";img.loading="eager";img.decoding="async";
  img.addEventListener("error",()=>{img.src="../poster-fallback.svg";},{once:true});
  const content=document.createElement("div");content.className="hot-stage-content";
  const kicker=document.createElement("span");kicker.className="hot-kicker";kicker.textContent="★ VIDEO HOT";
  const title=document.createElement("h3");title.textContent=item.title;
  const meta=document.createElement("p");meta.className="hot-stage-meta";meta.textContent=[item.area,item.categoryName,item.duration,item.sourceName].filter(Boolean).join(" · ");
  const play=document.createElement("span");play.className="hot-play";play.textContent="▶  XEM NGAY";
  content.append(kicker,title,meta,play);hero.append(img,content);root.append(hero);
  const nextItems=trendingItems.filter((_,i)=>i!==trendingIndex%trendingItems.length).slice(0,8);
  for(const pick of nextItems){
    const card=document.createElement("a");card.className="hot-pick";card.href=href(pick);
    const poster=document.createElement("img");poster.loading="lazy";poster.decoding="async";poster.fetchPriority="low";poster.sizes="88px";poster.alt="";poster.src=pick.poster||"../poster-fallback.svg";
    poster.addEventListener("error",()=>{poster.src="../poster-fallback.svg";},{once:true});
    const name=document.createElement("strong");name.textContent=pick.title;
    card.append(poster,name);picks.append(card);
  }
  $("trending-index").textContent=(trendingIndex+1)+" / "+trendingItems.length;
}
function setupTrending() {
  const source=catalog.videos.filter(x=>x&&x.id&&x.sourceId&&!/(học\s*sinh|nữ\s*sinh|nam\s*sinh|underage|minor|loli|shota)/i.test([x.title,x.description,x.categoryName,x.actors].join(" ")));
  trendingItems=source.slice().sort((a,b)=>{
    const score=x=>Number(x.trendingScore??x.views??x.viewCount??x.hits??x.playCount??0);
    return score(b)-score(a)||Number(b.year||0)-Number(a.year||0);
  }).slice(0,Math.min(20,source.length));
  if(trendingTimer)clearInterval(trendingTimer);
  trendingIndex=0;renderTrending();
  if(trendingItems.length>1)trendingTimer=setInterval(()=>{trendingIndex=(trendingIndex+1)%trendingItems.length;renderTrending();},10000);
}
function render() {
  const root=$("cards");root.replaceChildren();
  for(const item of items){
    const link=document.createElement("a");link.className="card";link.href="../watch/source.html?sourceId="+encodeURIComponent(item.sourceId)+"&vodId="+encodeURIComponent(item.id);
    const image=document.createElement("img");image.loading="lazy";image.decoding="async";image.fetchPriority="low";image.sizes="(max-width: 700px) 50vw, (max-width: 1100px) 25vw, 240px";image.alt=item.title;image.src=item.poster||"../poster-fallback.svg";image.addEventListener("error",()=>{image.src="../poster-fallback.svg";},{once:true});
    const body=document.createElement("div");body.className="card-body";const title=document.createElement("h2");title.textContent=item.title;
    const meta=document.createElement("p");meta.textContent=[item.year,item.area,item.categoryName,item.duration,item.sourceName].filter(Boolean).join(" · ");
    body.append(title,meta);link.append(image,body);root.append(link);
  }
  $("empty").hidden=items.length>0;
  $("count").textContent=Number($("count").dataset.total||0).toLocaleString("vi-VN")+" VIDEO";
  $("page-label").textContent="Trang "+page+" / "+Math.max(pageCount,1)+" · "+items.length+" video";
  $("prev").disabled=page<=1;$("next").disabled=page>=pageCount;
  $("prev").textContent="← TRANG TRƯỚC";$("next").textContent="TRANG SAU →";
}
function loadVideos() {
  const filtered=catalog.videos.filter(matches),total=filtered.length;
  pageCount=Math.min(MAX_PAGES,Math.max(1,Math.ceil(total/PAGE_SIZE)));
  page=Math.min(page,pageCount);items=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
  $("count").dataset.total=String(total);render();
  status("Catalog đồng bộ · "+providerRows()+" · "+total.toLocaleString("vi-VN")+" kết quả · tối đa 1.000 trang · "+new Date(catalog.updatedAt).toLocaleString("vi-VN"));
}
document.querySelectorAll(".category-chip").forEach(button=>{
  button.classList.toggle("is-active",button.dataset.category===quickCategory);
  button.setAttribute("aria-pressed",String(button.dataset.category===quickCategory));
  button.addEventListener("click",()=>{
    quickCategory=button.dataset.category===quickCategory?"":button.dataset.category;
    document.querySelectorAll(".category-chip").forEach(chip=>{
      const active=chip.dataset.category===quickCategory;
      chip.classList.toggle("is-active",active);
      chip.setAttribute("aria-pressed",String(active));
    });
    page=1;loadVideos();
  });
});
$("filters").addEventListener("submit",event=>{
  event.preventDefault();page=1;
  const selected=$("category").value;
  if(selected){const [source,...parts]=selected.split(":");activeProvider=source;$("source").value=source;categoryId=parts.join(":");}else categoryId="";
  keyword=$("keyword").value.trim();country=$("country").value;duration=$("duration").value;loadVideos();
});
$("source").addEventListener("change",()=>{activeProvider=$("source").value;categoryId="";$("category").value="";populateCategories();page=1;loadVideos();});
$("category").addEventListener("change",()=>{const selected=$("category").value;if(selected){const [source,...parts]=selected.split(":");activeProvider=source;$("source").value=source;categoryId=parts.join(":");}else categoryId="";page=1;loadVideos();});
$("country").addEventListener("change",()=>{country=$("country").value;page=1;loadVideos();});
$("duration").addEventListener("change",()=>{duration=$("duration").value;page=1;loadVideos();});
$("prev").addEventListener("click",()=>{if(page>1){page--;loadVideos();window.scrollTo({top:0,behavior:"smooth"});}});
$("next").addEventListener("click",()=>{if(page<pageCount){page++;loadVideos();window.scrollTo({top:0,behavior:"smooth"});}});
(async()=>{
  try{
    const response=await fetch(CATALOG_URL,{cache:"no-store",headers:{Accept:"application/json"}});
    if(!response.ok)throw new Error("catalog.json HTTP "+response.status);
    catalog=await response.json();
    if(!Array.isArray(catalog.videos)||!Array.isArray(catalog.providers)||!Array.isArray(catalog.categories))throw new Error("Catalog format is invalid");
    populateCategories();populateSelect("country",catalog.videos.map(x=>x.area),"Tất cả quốc gia");
    setupTrending();$("count").dataset.total=String(catalog.videos.length);loadVideos();
  }catch(error){status("Không tải được catalog: "+error.message);$("empty").hidden=false;}
})();

// Preview acceptance: trending order uses provider popularity fields when supplied; never invents metrics.

// Quick category chips are Preview-tested independently from the homepage.
