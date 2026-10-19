import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useOutletContext, useParams } from "react-router-dom";
import {
  acilisBasamagi,
  basamaklar,
  basamaklariTamamla,
  GRUPLAR,
  ilerleme,
  oncekiSonraki,
  type Basamak,
  type DosyaBasamaklari,
} from "../../domain/basamaklar";
import type { EvrakKaydi } from "../../domain/dosya";
import type { Muayene } from "../../domain/muayene";
import type { Odeme } from "../../domain/odeme";
import { bosArastirma, type PiyasaArastirmasi, type PiyasaKalemi } from "../../domain/piyasa";
import type { Alim } from "../../domain/tipler";
import { olayKaydet } from "../../data/olay";
import { bugun, tl } from "../bicim";
import { FiyatIstemeBasamagi } from "../basamaklar/FiyatIsteme";
import { IhtiyacOnayiBasamagi } from "../basamaklar/IhtiyacOnayi";
import { OnayBelgesiBasamagi } from "../basamaklar/OnayBelgesi";
import { TeklifMektuplariBasamagi } from "../basamaklar/TeklifMektuplari";
import { PiyasaTutanagiBasamagi } from "../basamaklar/PiyasaTutanagi";
import { SiparisBasamagi } from "../basamaklar/SiparisBasamagi";
import { MuayeneBasamagi } from "../basamaklar/MuayeneBasamagi";
import { TasinirBasamagi } from "../basamaklar/TasinirBasamagi";
import { OdemeBasamagi } from "../basamaklar/OdemeBasamagi";
import { VeriGirisi } from "../basamaklar/VeriGirisi";
import { YaklasikMaliyetBasamagi } from "../basamaklar/YaklasikMaliyet";

import type { Veri } from "../useVeri";

type KayitDurumu = "kayitli" | "bekliyor" | "kaydediliyor" | "hata";

// Basamak sayfalarına verilen ortak bağlam
export interface BasamakBaglami {
  veri: Veri;
  alim: Alim;
  piyasa: PiyasaArastirmasi;
  dosya: DosyaBasamaklari;
  kalemler: PiyasaKalemi[];
  evraklar: Record<string, EvrakKaydi>;
  muayene: Muayene | null;
  odeme: Odeme | null;
  basamak: Basamak;
  dosyaDegistir: (f: (d: DosyaBasamaklari) => DosyaBasamaklari) => void;
  kalemleriDegistir: (k: PiyasaKalemi[]) => void;
  // Piyasa araştırması kaydı çalışma alanının otomatik kaydından geçer; basamaklar depoya doğrudan yazmaz.
  piyasaDegistir: (f: (p: PiyasaArastirmasi) => PiyasaArastirmasi) => void;
  evrakDegistir: (kod: string, ad: string, kayit: EvrakKaydi) => Promise<void>;
  alimDegistir: (d: Partial<Alim>, aciklama: string) => Promise<void>;
}

// Değişiklikten yarım saniye sonra kaydeder; sayfadan çıkılırken bekleyen kaydı hemen yazar.
function useOtomatikKayit<T>(deger: T | null, kaydet: (d: T) => Promise<void>): KayitDurumu {
  const [durum, setDurum] = useState<KayitDurumu>("kayitli");
  const son = useRef<T | null>(null);
  const bekleyen = useRef<T | null>(null);
  const kaydetRef = useRef(kaydet);
  kaydetRef.current = kaydet;

  useEffect(() => {
    if (deger === null) return;
    if (son.current === null) {
      son.current = deger;
      return;
    }
    if (son.current === deger) return;
    son.current = deger;
    bekleyen.current = deger;
    setDurum("bekliyor");
    const zaman = setTimeout(async () => {
      bekleyen.current = null;
      setDurum("kaydediliyor");
      try {
        await kaydetRef.current(deger);
        setDurum("kayitli");
      } catch {
        setDurum("hata");
      }
    }, 500);
    return () => clearTimeout(zaman);
  }, [deger]);

  useEffect(
    () => () => {
      if (bekleyen.current !== null) void kaydetRef.current(bekleyen.current);
    },
    [],
  );
  return durum;
}

const KAYIT_YAZISI: Record<KayitDurumu, string> = {
  kayitli: "Kaydedildi",
  bekliyor: "Değişiklik var",
  kaydediliyor: "Kaydediliyor…",
  hata: "Kaydedilemedi",
};

interface Yuk {
  evraklar: Record<string, EvrakKaydi>;
  muayene: Muayene | null;
  odeme: Odeme | null;
}

export function DosyaCalismaAlani() {
  const { alimId = "" } = useParams();
  return <CalismaAlani key={alimId} alimId={alimId} />;
}

function CalismaAlani({ alimId }: { alimId: string }) {
  const { no } = useParams();
  const veri = useOutletContext<Veri>();
  const { depo, alimlar, ayarlar, yenile } = veri;
  const alim = alimlar.find((a) => a.id === alimId);

  const [piyasa, setPiyasa] = useState<PiyasaArastirmasi | null>(null);
  const [dosya, setDosya] = useState<DosyaBasamaklari | null>(null);
  const [yuk, setYuk] = useState<Yuk | null>(null);
  const [hata, setHata] = useState("");

  const kayitlariYukle = useCallback(async () => {
    const [evraklar, muayene, odeme] = await Promise.all([depo.evraklar(alimId), depo.muayeneGetir(alimId), depo.odemeGetir(alimId)]);
    setYuk({ evraklar, muayene, odeme });
  }, [depo, alimId]);

  useEffect(() => {
    let iptal = false;
    Promise.all([depo.piyasaGetir(alimId), depo.basamaklarGetir(alimId), kayitlariYukle()]).then(([p, d]) => {
      if (iptal) return;
      setPiyasa(p ?? bosArastirma(alimId));
      setDosya(basamaklariTamamla(d ?? { alimId }, bugun()));
    });
    return () => {
      iptal = true;
    };
  }, [depo, alimId, kayitlariYukle]);

  const piyasaDurumu = useOtomatikKayit(piyasa, (p) => depo.piyasaKaydet(p));
  const dosyaDurumu = useOtomatikKayit(dosya, (d) => depo.basamaklarKaydet(d));
  const kayit: KayitDurumu = [piyasaDurumu, dosyaDurumu].includes("hata")
    ? "hata"
    : [piyasaDurumu, dosyaDurumu].find((d) => d !== "kayitli") ?? "kayitli";

  const liste = useMemo(
    () => (alim && piyasa && dosya && yuk ? basamaklar({ alim, piyasa, dosya, ...yuk }) : null),
    [alim, piyasa, dosya, yuk],
  );

  if (!alim) {
    return (
      <div className="sayfa">
        <div className="bant bant-hata" role="alert">
          {alimId} numaralı dosya bulunamadı. <Link to="/dosyalar">Dosya listesine dönün.</Link>
        </div>
      </div>
    );
  }
  if (!liste || !piyasa || !dosya || !yuk) return <p className="soluk">Dosya yükleniyor…</p>;

  const secili = liste.find((b) => String(b.no) === no);
  if (!secili) return <Navigate to={`/dosyalar/${alimId}/basamak/${acilisBasamagi(liste)}`} replace />;

  const { biten, gerekli } = ilerleme(liste);
  const gezinme = oncekiSonraki(liste, secili.no);
  const onceki = gezinme.onceki;
  const sonraki = gezinme.sonraki;
  const yol = (n: number) => `/dosyalar/${alimId}/basamak/${n}`;

  const baglam: BasamakBaglami = {
    veri,
    alim,
    piyasa,
    dosya,
    kalemler: piyasa.kalemler,
    ...yuk,
    basamak: secili,
    dosyaDegistir: (f) => setDosya((d) => (d ? f(d) : d)),
    kalemleriDegistir: (k) => setPiyasa((p) => (p ? { ...p, kalemler: k } : p)),
    piyasaDegistir: (f) => setPiyasa((p) => (p ? f(p) : p)),
    evrakDegistir: async (kod, ad, k) => {
      setHata("");
      try {
        await depo.evrakKaydet(alimId, kod, k);
        await olayKaydet(depo, ayarlar, alimId, "evrak", `${ad}: ${k.tamam ? "tamamlandı" : "geri alındı"}`);
        await kayitlariYukle();
      } catch (e) {
        setHata(`Kaydedilemedi. ${String(e)}`);
      }
    },
    alimDegistir: async (d, aciklama) => {
      setHata("");
      try {
        await depo.alimGuncelle(alimId, d);
        await olayKaydet(depo, ayarlar, alimId, "dosya", aciklama);
        await yenile();
      } catch (e) {
        setHata(`Kaydedilemedi. ${String(e)}`);
      }
    },
  };

  let icerik;
  if (secili.no === 1) icerik = <VeriGirisi b={baglam} />;
  else if (secili.no === 2) icerik = <IhtiyacOnayiBasamagi b={baglam} />;
  else if (secili.no === 3) icerik = <FiyatIstemeBasamagi b={baglam} />;
  else if (secili.no === 4) icerik = <YaklasikMaliyetBasamagi b={baglam} />;
  else if (secili.no === 5) icerik = <OnayBelgesiBasamagi b={baglam} />;
  else if (secili.no === 6) icerik = <TeklifMektuplariBasamagi b={baglam} />;
  else if (secili.no === 7) icerik = <PiyasaTutanagiBasamagi b={baglam} />;
  else if (secili.no === 8) icerik = <SiparisBasamagi b={baglam} />;
  else if (secili.no === 9 || secili.no === 10 || secili.no === 11) icerik = <MuayeneBasamagi b={baglam} />;
  else if (secili.no === 12) icerik = <TasinirBasamagi b={baglam} />;
  else if (secili.no === 13) icerik = <OdemeBasamagi b={baglam} />;
  else icerik = null;


  return (
    <div className="sayfa">
      <header className="sayfa-ust">
        <div>
          <span className="kucuk soluk">
            <Link to="/dosyalar">Alım dosyaları</Link> / <span className="mono">{alim.id}</span>
          </span>
          <h1>{alim.konu}</h1>
          <p className="cipler">
            <span className="cip cip-vurgu">{alim.bent}</span>
            <span className="cip">{piyasa.kalemler.length} kalem</span>
            <span className="cip mono">{tl(alim.tutar)} + KDV</span>
            {alim.sureliIs && <span className="cip">Süreye yayılan iş</span>}
          </p>
        </div>
        <div className="ust-araclar">
          <span className={`kayit-durumu ${kayit === "hata" ? "hata-yazi" : "soluk"}`} role="status">
            {KAYIT_YAZISI[kayit]}
          </span>
          <Link to={`/dosyalar/${alim.id}/ozet`} className="dugme kucuk-dugme">
            Dosya özeti ve denetim izi
          </Link>
        </div>
      </header>

      {hata && (
        <div className="bant bant-hata" role="alert">
          {hata}
        </div>
      )}

      <div className="calisma">
        <nav className="basamak-rayi" aria-label="Dosya basamakları">
          <div className="ray-ust">
            <span className="ray-baslik">
              <span className="kalin">Dosya basamakları</span>
              <span className="soluk">
                {biten} / {gerekli}
              </span>
            </span>
            <span className="cubuk" role="progressbar" aria-label="Tamamlanan basamaklar" aria-valuenow={biten} aria-valuemin={0} aria-valuemax={gerekli}>
              <span className="cubuk-dolu cubuk-basari" style={{ width: `${gerekli ? (biten * 100) / gerekli : 0}%` }} />
            </span>
          </div>
          <ol className="ray-listesi">
            {GRUPLAR.map((grup) => (
              <li key={grup}>
                <span className="ray-grup">{grup}</span>
                <ol>
                  {liste
                    .filter((b) => b.grup === grup)
                    .map((b) => (
                      <li key={b.no}>
                        <Link to={yol(b.no)} className={`ray-ogesi ray-${b.durum}`} aria-current={b.no === secili.no ? "step" : undefined}>
                          <span className="ray-isaret" aria-hidden="true">
                            {b.durum === "tamam" ? "✓" : b.durum === "gerekmiyor" ? "–" : b.no}
                          </span>
                          <span className="ray-metin">
                            <span>
                              {b.no}. {b.ad}
                            </span>
                            <span className="ray-not">{b.not}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                </ol>
              </li>
            ))}
          </ol>
          <p className="ray-dipnot">Basamaklar sırayla açılır. Önceki basamaktaki eksik uyarı olarak görünür, ilerlemeyi engellemez.</p>
        </nav>

        <div className="calisma-icerik">
          {icerik}
          <div className="alt-dugmeler">
            {onceki ? (
              <Link to={yol(onceki.no)} className="dugme">
                ‹ Önceki: {onceki.ad}
              </Link>
            ) : (
              <span />
            )}
            {sonraki && (
              <Link to={yol(sonraki.no)} className="dugme">
                Sonraki: {sonraki.ad} ›
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
