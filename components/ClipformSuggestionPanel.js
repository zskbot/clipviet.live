export const CLIPFORM_SUGGESTION_URL = "https://clipform.io/3d76a8c57";

export default function ClipformSuggestionPanel({ compact = false }) {
  return (
    <section className="my-10 border border-white/10 bg-white/[.025] p-4 sm:p-6" aria-labelledby="clipform-suggestion-title">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.22em] text-red-400">COMMUNITY / CLIPFORM</p>
          <h2 id="clipform-suggestion-title" className="mt-2 text-xl font-black text-white">Đề xuất video</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Gửi tên video, nguồn chính thức và lý do đề xuất. Nội dung được kiểm tra thủ công về quyền phân phối trước khi xem xét xuất bản.</p>
        </div>
        <a href={CLIPFORM_SUGGESTION_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center border border-red-500 px-4 py-2 text-xs font-bold text-white hover:bg-red-600">MỞ FORM RIÊNG ↗</a>
      </div>
      {!compact && <iframe title="Biểu mẫu đề xuất video ClipViet.live" src={CLIPFORM_SUGGESTION_URL} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" className="h-[780px] w-full border border-white/10 bg-black" />}
    </section>
  );
}
