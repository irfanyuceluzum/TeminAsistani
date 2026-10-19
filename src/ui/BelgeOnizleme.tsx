import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useParams } from "react-router-dom";
import { pdfDosyaAdi } from "./bicim";

// Belgeyi tam ekran, A4 kâğıtlar hâlinde öne getirir. Her sayfa ayrı kâğıttır; yazdırırken de ayrı sayfaya düşer.
// Esc ve "Geri dön" kapatır. Uygulamanın geri kalanı yazdırılmaz.
// PDF, sistemin yazdırma penceresinden kaydedilir; pencere açıkken sayfa başlığı önerilen dosya adı olur.
export function BelgeOnizleme({
  baslik,
  sayfalar,
  kapat,
  yatay = false,
}: {
  baslik: string;
  sayfalar: ReactNode[];
  kapat: () => void;
  yatay?: boolean;
}) {
  const geriRef = useRef<HTMLButtonElement>(null);
  // Üst bileşen her çizimde yeni kapat işlevi verebilir; odak ve kaydırma kilidi yalnızca açılışta kurulur.
  const kapatRef = useRef(kapat);
  kapatRef.current = kapat;
  const { alimId } = useParams();
  const dosyaAdi = pdfDosyaAdi(baslik, alimId);
  const [pdfIpucu, setPdfIpucu] = useState(false);
  // Yazdırma bitince (ya da önizleme kapanınca) asıl sayfa başlığı geri gelir.
  const asilBaslik = useRef<string | null>(null);
  const basligiGeriAl = () => {
    if (asilBaslik.current !== null) document.title = asilBaslik.current;
    asilBaslik.current = null;
  };

  const yazdir = (pdf: boolean) => {
    setPdfIpucu(pdf);
    // İpucu çizilsin diye yazdırma penceresi bir sonraki karede açılır; pencere açıkken sayfa donar.
    window.setTimeout(() => {
      if (asilBaslik.current === null) asilBaslik.current = document.title;
      document.title = dosyaAdi;
      window.addEventListener("afterprint", basligiGeriAl, { once: true });
      window.print();
    }, 50);
  };

  useEffect(() => {
    const onceki = document.activeElement as HTMLElement | null;
    const eskiTasma = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("onizleme-acik");
    geriRef.current?.focus();
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") kapatRef.current();
    };
    window.addEventListener("keydown", tus);
    return () => {
      window.removeEventListener("keydown", tus);
      window.removeEventListener("afterprint", basligiGeriAl);
      basligiGeriAl();
      document.body.style.overflow = eskiTasma;
      document.body.classList.remove("onizleme-acik");
      onceki?.focus();
    };
  }, []);

  return createPortal(
    <div className={`onizleme-katmani ${yatay ? "onizleme-katmani-yatay" : ""}`} role="dialog" aria-modal="true" aria-label={baslik}>
      {yatay && (
        <style>{`
          @page { size: A4 landscape !important; margin: 8mm 10mm !important; }
        `}</style>
      )}
      <div className="onizleme-arac">
        <button type="button" className="onizleme-dugme" onClick={kapat} ref={geriRef}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
          Geri dön
        </button>
        <span className="onizleme-baslik">
          {baslik}
          <span className="onizleme-bilgi">
            {pdfIpucu
              ? `Yazıcı olarak "PDF olarak kaydet" (Windows'ta "Microsoft Print to PDF") seçin · Dosya adı: ${dosyaAdi}`
              : `${yatay ? "A4 Yatay" : "A4"} · ${sayfalar.length} sayfa`}
          </span>
        </span>
        <button type="button" className="onizleme-dugme" onClick={() => yazdir(true)} title={`${dosyaAdi}.pdf`}>
          PDF olarak kaydet
        </button>
        <button type="button" className="onizleme-dugme onizleme-yazdir" onClick={() => yazdir(false)}>
          Yazdır
        </button>
      </div>
      <div className="onizleme-alan">
        {sayfalar.map((s, i) => (
          <section key={i} className={`a4-sayfa ${yatay ? "a4-yatay" : ""}`} aria-label={`Sayfa ${i + 1}`}>
            <div className={`belge-metni ${yatay ? "belge-metni-yatay" : ""}`}>{s}</div>
            {sayfalar.length > 1 && (
              <span className="a4-no" aria-hidden="true">
                {i + 1} / {sayfalar.length}
              </span>
            )}
          </section>
        ))}
      </div>
    </div>,
    document.body,
  );
}
