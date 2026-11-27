"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {useParams} from "next/navigation";
export default function WatchPage(){
 const params=useParams(),id=Array.isArray(params.id)?params.id[0]:params.id;
 const [video,setVideo]=useState(null),[playbackSources,setPlaybackSources]=useState([]),[activeSource,setActiveSource]=useState(null);
 const [playbackState,setPlaybackState]=useState("IDLE"),[playbackMessage,setPlaybackMessage]=useState("Nguồn phát chỉ được truy vấn sau khi bạn nhấn nút Play.");
 const [recommendations,setRecommendations]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{let active=true;async function load(){try{
  if(!String(id||"").startsWith("maccms:"))throw new Error("Liên kết video không hợp lệ.");
  const [detailResponse,listResponse]=await Promise.all([fetch("/api/videos?id="+encodeURIComponent(id),{cache:"no-store"}),fetch("/api/videos?limit=30",{cache:"no-store"})]);
  const detail=await detailResponse.json(),list=await listResponse.json();
  if(!detailResponse.ok||!detail.success||!detail.result)throw new Error(detail.error||"Metadata video chưa được duyệt hoặc không tồn tại.");
  if(active){setVideo(detail.result);setRecommendations((list.results||[]).filter(item=>item.id!==id).slice(0,5));}
 }catch(err){if(active)setError(err.message||"Không thể tải chi tiết video.");}finally{if(active)setLoading(false);}}
 if(id)load();return()=>{active=false;};},[id]);
 async function requestPlayback(){if(!video||playbackState==="LOADING")return;setPlaybackState("LOADING");setPlaybackMessage("Đang kiểm tra quyền phát riêng cho video này…");setActiveSource(null);setPlaybackSources([]);
  try{const response=await fetch("/api/videos/"+encodeURIComponent(id)+"/playback",{cache:"no-store",headers:{Accept:"application/json"}}),payload=await response.json();
   if(!response.ok||!payload.success||!Array.isArray(payload.sources))throw new Error(payload.error||"Nguồn này chưa được cấp quyền phát.");
   const sources=payload.sources.filter(source=>typeof source.url==="string"&&/^https:\/\//i.test(source.url));
   if(!sources.length)throw new Error("Không có nguồn HLS/MP4 HTTPS đã được duyệt cho video này.");
   setPlaybackSources(sources);setActiveSource(sources[0]);setPlaybackState("READY");setPlaybackMessage("Quyền phát đã được xác nhận cho video này.");
  }catch(err){setPlaybackState("BLOCKED");setPlaybackMessage(err.message||"Không thể xác minh quyền phát.");}}
 if(loading)return <main className="container py-24 text-center text-sm text-zinc-500">Đang tải dữ liệu video...</main>;
 if(error||!video)return <main className="container py-24 text-center"><p className="text-sm text-zinc-400">{error||"Không tìm thấy video."}</p><Link href="/" className="mt-5 inline-block text-sm text-red-400">← Về trang chủ</Link></main>;
 return <main className="container py-10"><Link href="/" className="text-xs font-semibold text-zinc-500">← Quay lại thư viện</Link>
  <div className="mt-6 grid gap-9 lg:grid-cols-[minmax(0,1fr)_300px]"><section>
   <div className="aspect-video overflow-hidden border border-white/10 bg-black">{activeSource?<video key={activeSource.url} className="h-full w-full" controls playsInline preload="metadata" referrerPolicy="no-referrer" poster={video.poster} onError={()=>setPlaybackMessage("Safari không phát được nguồn này. Kiểm tra HLS/MP4, CORS và quyền truy cập của máy chủ nguồn.")}><source src={activeSource.url} type={activeSource.url.toLowerCase().includes(".m3u8")?"application/vnd.apple.mpegurl":"video/mp4"}/></video>:<div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"><span className="text-4xl text-zinc-700">▶</span><p className="font-semibold text-zinc-300">Chưa xác minh quyền phát</p><p className="max-w-md text-xs leading-5 text-zinc-500">Nhấn nút bên dưới để kiểm tra quyền phát riêng của video. Metadata không tự động cấp quyền stream.</p></div>}</div>
   <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={requestPlayback} disabled={playbackState==="LOADING"} className="border border-red-500 bg-red-600 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">{playbackState==="LOADING"?"ĐANG KIỂM TRA…":activeSource?"KIỂM TRA LẠI QUYỀN PHÁT":"▶ PLAY"}</button><p className="text-xs text-zinc-500" role="status" aria-live="polite">{playbackMessage}</p></div>
   {playbackSources.length>1&&<label className="mt-4 block max-w-sm text-xs font-semibold text-zinc-400">Chọn tập / nguồn phát<select value={activeSource?.url||""} onChange={event=>setActiveSource(playbackSources.find(source=>source.url===event.target.value)||null)} className="mt-2 h-11 w-full border border-white/10 bg-[#11131a] px-3 text-sm text-white">{playbackSources.map((source,index)=><option key={source.url} value={source.url}>{source.label||"Nguồn "+(index+1)}</option>)}</select></label>}
   <div className="mt-6"><div className="flex flex-wrap gap-2 text-[11px] font-bold"><span className="border border-red-600/30 px-2 py-1 text-red-400">METADATA_APPROVED</span><span className="border border-white/10 px-2 py-1 text-zinc-400">{video.category}</span><span className="border border-white/10 px-2 py-1 text-zinc-400">{video.year}</span><span className="border border-white/10 px-2 py-1 text-zinc-400">{video.duration}</span></div><h1 className="mt-4 text-2xl font-black">{video.title}</h1><p className="mt-3 max-w-3xl text-sm leading-7 text-zinc-400">{video.description}</p><p className="mt-3 text-xs text-zinc-600">ID: {video.id} · Provider: {video.providerName||video.provider}</p></div>
  </section><aside><h2 className="mb-4 text-xs font-black uppercase tracking-[.2em] text-zinc-500">Có thể bạn thích</h2><div className="space-y-4">{recommendations.map(item=><Link href={"/watch/"+encodeURIComponent(item.id)} key={item.id} className="group flex gap-3"><div className="h-20 w-14 shrink-0 overflow-hidden bg-zinc-900">{item.poster&&<img src={item.poster} alt="" loading="lazy" className="h-full w-full object-cover"/>}</div><div className="min-w-0 self-center"><h3 className="line-clamp-2 text-sm font-bold group-hover:text-red-400">{item.title}</h3><p className="mt-2 text-xs text-zinc-500">{item.year} · {item.category}</p></div></Link>)}</div></aside></div>
 </main>;
}
