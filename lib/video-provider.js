import { getPublicTelegramVideoPosts } from "@/lib/telegram-public-feed";
import { isTxtopDeployPreview } from "@/lib/telegram-preview-store";
import { getMacCmsFeed } from "@/lib/maccms-provider.mjs";
const text=(value,fallback="")=>typeof value==="string"?value.trim():fallback;
function httpsUrl(value){if(!value)return "";try{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password?url.toString():"";}catch{return "";}}
async function getPublicTelegramVideos(){
 const raw=process.env.TELEGRAM_PUBLIC_POSTS_JSON||"[]";let configured;
 try{configured=JSON.parse(raw);}catch{throw new Error("TELEGRAM_PUBLIC_POSTS_JSON must be valid JSON.");}
 if(!Array.isArray(configured))throw new Error("TELEGRAM_PUBLIC_POSTS_JSON must be an array.");
 let received=[];
 if(isTxtopDeployPreview()){try{const {getDeployStore}=await import("@netlify/blobs");const store=getDeployStore("txtop-telegram-preview");received=(await store.get("posts-index",{type:"json"}))||[];if(!Array.isArray(received))received=[];}catch(error){console.error("[telegram-preview-feed]",error);}}
 const scraped=isTxtopDeployPreview()?await getPublicTelegramVideoPosts():[];
 const merged=[...received,...scraped,...configured];
 const unique=[...new Map(merged.map(post=>[`${post.channel||"txtop18"}:${post.messageId}`,post])).values()];
 return unique.slice(0,100).flatMap(post=>{
  if(!post||typeof post!=="object"||(post.type&&post.type!=="video"))return [];
  const channel=text(post.channel,"txtop18").replace(/^@/,""),messageId=String(post.messageId??"");
  if(!/^[A-Za-z0-9_]{5,32}$/.test(channel)||!/^\d{1,12}$/.test(messageId)||Number(messageId)<1)return [];
  const body=text(post.text||post.caption||post.description),title=text(post.title||body.split("\n")[0],`Video Telegram #${messageId}`).slice(0,240);
  return [{id:`telegram-public:${channel}:${messageId}`,title,description:body.slice(0,4000),category:"Telegram",
   year:Number(post.date)>0?new Date(Number(post.date)*1000).getFullYear():new Date().getFullYear(),
   duration:post.video?.duration?`${Math.floor(post.video.duration/60)} phút`:"Telegram",rating:"NR",views:0,
   poster:httpsUrl(post.poster),backdrop:httpsUrl(post.poster),videoUrl:"",embedUrl:"",
   sourceUrl:`https://t.me/${channel}/${messageId}`,updatedAt:"",provider:"telegram-public"}];
 });
}
export async function getVideoFeed(){
 const [telegramVideos,macCms]=await Promise.all([getPublicTelegramVideos(),getMacCmsFeed()]);
 const results=[...telegramVideos,...macCms.results],sources=[macCms.results.length?"maccms":"",telegramVideos.length?"telegram":""].filter(Boolean);
 return {results,source:sources.join("+")||"none",providerStatus:macCms.providers,providerErrors:macCms.errors};
}
