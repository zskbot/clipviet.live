import "./globals.css";
import AgeGate from "@/components/AgeGate";
import Header from "@/components/Header";

export const metadata = {
  metadataBase: new URL("https://clipviet.live"),
  title: { default: "ClipViet.live — Video Streaming", template: "%s | ClipViet.live" },
  description: "ClipViet.live — Khám phá danh mục video giải trí dành cho người trưởng thành.",
  applicationName: "ClipViet.live",
  alternates: { canonical: "/" },
  icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
  openGraph: {
    title: "ClipViet.live",
    description: "Khám phá danh mục video giải trí trên ClipViet.live.",
    url: "https://clipviet.live",
    siteName: "ClipViet.live",
    locale: "vi_VN",
    type: "website"
  }
};

export default function RootLayout({ children }) {
  return <html lang="vi"><body><AgeGate /><Header />{children}<footer className="mt-24 border-t border-white/5 py-8 text-center text-xs text-zinc-600"><p>© {new Date().getFullYear()} ClipViet.live — Nền tảng streaming thử nghiệm.</p><p className="mt-2">Chỉ phát nội dung bạn sở hữu hoặc có quyền phân phối.</p></footer></body></html>;
}
