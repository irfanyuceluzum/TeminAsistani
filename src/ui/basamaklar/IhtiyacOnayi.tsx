import { useState } from "react";
import { ihtiyacOnayiKontrolleri, type IhtiyacOnayi } from "../../domain/basamaklar";
import { kisi, kisiYazisi } from "../../domain/personel";
import { bugun } from "../bicim";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { miktarYazisi } from "../IhtiyacListesi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { ihtiyacOnayiSayfalari } from "./belgeler";
import { KucukA4 } from "./KucukA4";

export function IhtiyacOnayiBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir } = b;
  const { ayarlar } = b.veri;
  const [onizle, setOnizle] = useState(false);
  const o = dosya.ihtiyacOnayi;
  const personel = ayarlar.personel ?? [];
  const arz = kisi(personel, ayarlar.gorevler?.gerceklestirme ?? null);
  const olur = kisi(personel, ayarlar.gorevler?.harcamaYetkilisi ?? null);
  const kontroller = ihtiyacOnayiKontrolleri(dosya, !!arz && !!olur);
  const sayfalar = ihtiyacOnayiSayfalari({ alim, ayarlar, dosya, kalemler: piyasa.kalemler });

  const degistir = (d: Partial<IhtiyacOnayi>) => dosyaDegistir((x) => ({ ...x, ihtiyacOnayi: { ...x.ihtiyacOnayi, ...d } }));

  return (
    <>
      <div className="iki-sutun">
        <section className="panel genis-form" aria-labelledby="onay-baslik">
          <div>
            <h2 id="onay-baslik">İhtiyaç onayı</h2>
            <p className="soluk kucuk">İhtiyacın neden doğduğunu yazın. Konu, dayanak ve ihtiyaç listesi 1. basamaktan gelir.</p>
          </div>
          <div className="form-izgara">
            <div className="alan">
              <label htmlFor="onay-tarih">Belge tarihi</label>
              <input id="onay-tarih" type="date" value={o.tarih} onChange={(e) => degistir({ tarih: e.target.value })} aria-invalid={!o.tarih} />
            </div>
            <div className="alan">
              <label htmlFor="onay-sayi">Sayı</label>
              <input id="onay-sayi" className="mono" value={o.sayi} onChange={(e) => degistir({ sayi: e.target.value })} placeholder="E-12345678-934-41" />
            </div>
            <div className="alan tam">
              <label htmlFor="onay-gerekce">İhtiyacın gerekçesi</label>
              <textarea
                id="onay-gerekce"
                rows={4}
                value={o.gerekce}
                onChange={(e) => degistir({ gerekce: e.target.value })}
                placeholder="Okulumuzun ikinci dönem temizlik ihtiyacının karşılanması gerekmektedir."
              />
            </div>
          </div>
          <div className="kutu">
            <span className="kalin kucuk">Ek: İhtiyaç listesi</span>
            <span className="kucuk">
              {piyasa.kalemler.length
                ? piyasa.kalemler.map((k) => `${k.ad || "Adsız kalem"} ${miktarYazisi(k.miktar)} ${k.birim}`).join(" · ")
                : "Liste boş; 1. basamakta kalemleri girin."}
            </span>
          </div>
          <dl className="ozet-listesi">
            <div>
              <dt>Arz eden</dt>
              <dd>{arz ? `${kisiYazisi(arz)} · Gerçekleştirme görevlisi` : "Atanmamış"}</dd>
            </div>
            <div>
              <dt>Olur veren</dt>
              <dd>{olur ? `${kisiYazisi(olur)} · Harcama yetkilisi` : "Atanmamış"}</dd>
            </div>
          </dl>
          <p className="soluk kucuk">İmzacılar Personel ve görevler ekranındaki atamalardan gelir.</p>
        </section>

        <section className="panel kucuk-onizleme" aria-labelledby="a4-baslik">
          <div className="panel-baslik-satiri">
            <h2 id="a4-baslik">A4 görünüşü</h2>
            <span className="soluk kucuk">{sayfalar.length} sayfa</span>
          </div>
          <KucukA4>{sayfalar[0]}</KucukA4>
          <button type="button" className="dugme dugme-ana" onClick={() => setOnizle(true)}>
            Önizle ve yazdır
          </button>
          <p className="soluk kucuk">Times New Roman 12 punto, A4. "Geri dön" ile bu sayfaya dönülür.</p>
        </section>
      </div>

      <section className="panel" aria-label="Belge durumu">
        <label className="onay-kutusu">
          <input
            type="checkbox"
            checked={o.imzali}
            onChange={(e) => {
              degistir({ imzali: e.target.checked });
              // Evrak kontrol listesindeki "İhtiyaç talep yazısı" bu belgedir; evrakDegistir denetim izine de yazar.
              void b.evrakDegistir("ihtiyac-yazisi", "İhtiyaç onayı", { tamam: e.target.checked, tarih: o.tarih || bugun(), not: o.sayi.trim() });
            }}
          />
          <span>
            İmzalandı, dosyaya kondu <span className="soluk kucuk">· basamak tamamlandı olarak işaretlenir</span>
          </span>
        </label>
      </section>

      <section className="panel" aria-labelledby="kontrol-baslik" aria-live="polite">
        <h2 id="kontrol-baslik">Kontroller</h2>
        {kontroller.map((k) => (
          <KontrolSatiri key={k.baslik} k={k} />
        ))}
      </section>

      {onizle && <BelgeOnizleme baslik={`İhtiyaç onayı · ${alim.id}`} sayfalar={sayfalar} kapat={() => setOnizle(false)} />}
    </>
  );
}
