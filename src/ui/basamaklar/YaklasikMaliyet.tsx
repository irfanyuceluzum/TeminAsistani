import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { yaklasikHesapla, yaklasikKontrolleri, type FiyatIsteme, type MaliyetFirmasi, type YaklasikMaliyet } from "../../domain/basamaklar";
import { tutarCoz } from "../../domain/sihirbaz";
import { tlKurus } from "../bicim";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { miktarYazisi } from "../IhtiyacListesi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { fiyatIstemeSayfalari, yaklasikMaliyetSayfalari } from "./belgeler";

function fiyatYazisi(kurus: number | null | undefined): string {
  return kurus === null || kurus === undefined ? "" : (kurus / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

const hucre = (firma: string, kalem: string) => `${firma}|${kalem}`;

type Onizleme = { tur: "yazi"; firma: string | null } | { tur: "cetvel" } | null;

export function YaklasikMaliyetBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir } = b;
  const { ayarlar, tedarikciler, limitDonemleri } = b.veri;
  const y = dosya.yaklasik;
  const f = dosya.fiyatIsteme;
  const kalemler = piyasa.kalemler;

  const [metinler, setMetinler] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const firma of y.firmalar) for (const k of kalemler) m[hucre(firma.tedarikciId, k.id)] = fiyatYazisi(firma.fiyatlar[k.id]);
    return m;
  });
  const [eklenecek, setEklenecek] = useState("");
  const [onizleme, setOnizleme] = useState<Onizleme>(null);

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad ?? id;
  const sonuc = useMemo(() => yaklasikHesapla(kalemler, y), [kalemler, y]);
  const kontroller = yaklasikKontrolleri(dosya, sonuc, alim, ayarlar, limitDonemleri, firmaAdi);
  const eklenebilir = tedarikciler.filter((t) => !y.firmalar.some((x) => x.tedarikciId === t.id));
  const belge = { alim, ayarlar, dosya, kalemler };

  const maliyetDegistir = (d: Partial<YaklasikMaliyet>) => dosyaDegistir((x) => ({ ...x, yaklasik: { ...x.yaklasik, ...d } }));
  const firmaDegistir = (id: string, d: Partial<MaliyetFirmasi>) =>
    dosyaDegistir((x) => ({ ...x, yaklasik: { ...x.yaklasik, firmalar: x.yaklasik.firmalar.map((fi) => (fi.tedarikciId === id ? { ...fi, ...d } : fi)) } }));
  const yaziDegistir = (d: Partial<FiyatIsteme>) => dosyaDegistir((x) => ({ ...x, fiyatIsteme: { ...x.fiyatIsteme, ...d } }));

  function fiyatGir(firma: MaliyetFirmasi, kalemId: string, metin: string) {
    setMetinler((m) => ({ ...m, [hucre(firma.tedarikciId, kalemId)]: metin }));
    const kurus = metin.trim() === "" ? null : tutarCoz(metin);
    if (metin.trim() !== "" && kurus === null) return;
    dosyaDegistir((x) => ({
      ...x,
      yaklasik: {
        ...x.yaklasik,
        firmalar: x.yaklasik.firmalar.map((fi) => (fi.tedarikciId === firma.tedarikciId ? { ...fi, fiyatlar: { ...fi.fiyatlar, [kalemId]: kurus } } : fi)),
      },
    }));
  }

  if (y.hesaplanmayacak) {
    return (
      <section className="panel" aria-labelledby="ym-baslik">
        <h2 id="ym-baslik">Fiyat isteme ve yaklaşık maliyet</h2>
        <p>Bu dosyada yaklaşık maliyet hesaplanmayacak olarak işaretlendi. Doğrudan Temin Tebliği m.4/4 uyarınca 22/d alımlarında zorunlu değildir; 3. ve 4. basamak atlanır.</p>
        <button type="button" className="dugme kendi-genisligi" onClick={() => maliyetDegistir({ hesaplanmayacak: false })}>
          Yaklaşık maliyeti hesapla
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel" aria-labelledby="istem-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="istem-baslik">3. Fiyat isteme yazısı</h2>
            <p className="soluk kucuk">İhtiyaç listesi ve şartlar ekli yazı firmalara gider; kaşeli ve imzalı cevaplar dosyaya konur.</p>
          </div>
          <span className="dugme-grubu">
            <button type="button" className="dugme kucuk-dugme" onClick={() => setOnizleme({ tur: "yazi", firma: null })}>
              Yazıyı önizle
            </button>
          </span>
        </div>
        <div className="form-izgara">
          <div className="alan">
            <label htmlFor="fi-tarih">Yazı tarihi</label>
            <input id="fi-tarih" type="date" value={f.tarih} onChange={(e) => yaziDegistir({ tarih: e.target.value })} />
          </div>
          <div className="alan">
            <label htmlFor="fi-sayi">Sayı</label>
            <input id="fi-sayi" className="mono" value={f.sayi} onChange={(e) => yaziDegistir({ sayi: e.target.value })} />
          </div>
          <div className="alan">
            <label htmlFor="fi-son">Son bildirim tarihi</label>
            <input
              id="fi-son"
              type="date"
              value={f.sonTarih}
              min={f.tarih || undefined}
              aria-invalid={!!f.tarih && !!f.sonTarih && f.sonTarih < f.tarih}
              onChange={(e) => yaziDegistir({ sonTarih: e.target.value })}
            />
          </div>
        </div>
        <ul className="maliyet-firmalari">
          {y.firmalar.map((fi, i) => (
            <li key={fi.tedarikciId} className="maliyet-firma">
              <span className="kalin">
                {String.fromCharCode(65 + i)}. {firmaAdi(fi.tedarikciId)}
              </span>
              <span className="dugme-grubu">
                <label className="onay-kutusu kucuk">
                  <input type="checkbox" checked={fi.belgeAlindi} onChange={(e) => firmaDegistir(fi.tedarikciId, { belgeAlindi: e.target.checked })} />
                  Kaşeli fiyat belgesi geldi
                </label>
                <button type="button" className="metin-dugme" onClick={() => setOnizleme({ tur: "yazi", firma: fi.tedarikciId })}>
                  Firmaya özel yazı
                </button>
                <button
                  type="button"
                  className="metin-dugme"
                  aria-label={`${firmaAdi(fi.tedarikciId)} firmasını çıkar`}
                  onClick={() => maliyetDegistir({ firmalar: y.firmalar.filter((x) => x.tedarikciId !== fi.tedarikciId) })}
                >
                  Çıkar
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="kalem-satiri">
          <label className="gizli" htmlFor="firma-sec">
            Eklenecek firma
          </label>
          <select id="firma-sec" className="girdi" value={eklenecek} onChange={(e) => setEklenecek(e.target.value)}>
            <option value="">Tedarikçi rehberinden firma seçin</option>
            {eklenebilir.map((t) => (
              <option key={t.id} value={t.id}>
                {t.ad} · {t.kategori}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="dugme kucuk-dugme"
            disabled={!eklenecek}
            onClick={() => {
              maliyetDegistir({ firmalar: [...y.firmalar, { tedarikciId: eklenecek, belgeAlindi: false, fiyatlar: {} }] });
              setEklenecek("");
            }}
          >
            Firma ekle
          </button>
          <Link to="/tedarikciler" className="kucuk">
            Rehberde olmayan firma
          </Link>
        </div>
      </section>

      <section className="panel bosluksuz" aria-labelledby="cetvel-baslik">
        <div className="panel-ust">
          <div>
            <h2 id="cetvel-baslik">4. Yaklaşık maliyet cetveli</h2>
            <p className="soluk kucuk">Kaşeli belgelerdeki birim fiyatları KDV hariç girin.</p>
          </div>
          <div className="filtreler" role="group" aria-label="Hesap yöntemi">
            <button type="button" className="filtre" aria-pressed={y.yontem === "ortalama"} onClick={() => maliyetDegistir({ yontem: "ortalama" })}>
              Ortalama
            </button>
            <button type="button" className="filtre" aria-pressed={y.yontem === "enDusuk"} onClick={() => maliyetDegistir({ yontem: "enDusuk" })}>
              En düşük
            </button>
          </div>
        </div>
        {kalemler.length === 0 || y.firmalar.length === 0 ? (
          <p className="soluk bos">{kalemler.length === 0 ? "İhtiyaç listesi boş; 1. basamakta kalemleri girin." : "Fiyat girmek için yukarıdan firma ekleyin."}</p>
        ) : (
          <div className="tablo-kutu">
            <table className="cetvel">
              <thead>
                <tr>
                  <th scope="col">Kalem</th>
                  <th scope="col" className="sag">
                    Miktar
                  </th>
                  {y.firmalar.map((fi, i) => (
                    <th key={fi.tedarikciId} scope="col" className="sag">
                      {String.fromCharCode(65 + i)} · {firmaAdi(fi.tedarikciId).split(" ")[0]}
                    </th>
                  ))}
                  <th scope="col" className="sag">
                    {y.yontem === "ortalama" ? "Ortalama birim" : "En düşük birim"}
                  </th>
                  <th scope="col" className="sag">
                    Tutar
                  </th>
                </tr>
              </thead>
              <tbody>
                {sonuc.satirlar.map((r) => (
                  <tr key={r.kalem.id}>
                    <td className="kalin">{r.kalem.ad || "Adsız kalem"}</td>
                    <td className="sag">
                      {miktarYazisi(r.kalem.miktar)} {r.kalem.birim}
                    </td>
                    {y.firmalar.map((fi, i) => {
                      const metin = metinler[hucre(fi.tedarikciId, r.kalem.id)] ?? "";
                      const gecersiz = metin.trim() !== "" && tutarCoz(metin) === null;
                      const durum = gecersiz ? "gecersiz" : r.aykirilar.includes(i) ? "aykiri" : r.fiyatlar[i] !== null && r.fiyatlar[i] === r.enDusuk ? "dusuk" : r.fiyatlar[i] === null ? "bos" : "";
                      return (
                        <td key={fi.tedarikciId} className="sag">
                          <input
                            className={`girdi mono fiyat-girdi fiyat-${durum}`}
                            inputMode="decimal"
                            placeholder="—"
                            value={metin}
                            aria-invalid={gecersiz}
                            aria-label={`${r.kalem.ad}, ${firmaAdi(fi.tedarikciId)} birim fiyatı`}
                            onChange={(e) => fiyatGir(fi, r.kalem.id, e.target.value)}
                          />
                        </td>
                      );
                    })}
                    <td className="sag mono">{r.birimFiyat === null ? "—" : tlKurus(r.birimFiyat)}</td>
                    <td className="sag mono kalin">{tlKurus(r.tutar)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={3 + y.firmalar.length} className="sag">
                    Toplam (KDV hariç)
                  </th>
                  <td className="sag mono kalin">{tlKurus(sonuc.toplam)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3 + y.firmalar.length} className="sag">
                    <label htmlFor="kdv-orani">KDV oranı </label>
                    <select id="kdv-orani" className="girdi kucuk-secim" value={y.kdvOrani} onChange={(e) => maliyetDegistir({ kdvOrani: Number(e.target.value) })}>
                      {[1, 10, 20].map((o) => (
                        <option key={o} value={o}>
                          %{o}
                        </option>
                      ))}
                    </select>
                  </th>
                  <td className="sag mono">{tlKurus(sonuc.kdv)}</td>
                </tr>
                <tr>
                  <th scope="row" colSpan={3 + y.firmalar.length} className="sag">
                    Toplam (KDV dahil)
                  </th>
                  <td className="sag mono">{tlKurus(sonuc.kdvDahil)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <div className="kutular">
        <div className="kutu kutu-vurgu">
          <span className="kucuk">Yaklaşık maliyet, KDV hariç</span>
          <span className="kutu-deger mono">{tlKurus(sonuc.toplam)}</span>
        </div>
        <div className="kutu">
          <span className="kucuk">Onay belgesindeki tutar</span>
          <span className="kutu-deger mono">{tlKurus(alim.tutar)}</span>
          {sonuc.hesaplanabilir && sonuc.toplam !== alim.tutar && (
            <button
              type="button"
              className="metin-dugme kendi-genisligi"
              onClick={() => void b.alimDegistir({ tutar: sonuc.toplam }, `Onay tutarı yaklaşık maliyete göre ${tlKurus(sonuc.toplam)} yapıldı`)}
            >
              Yaklaşık maliyeti kullan
            </button>
          )}
        </div>
        <div className="kutu">
          <span className="kucuk">Ödenekten kalan, KDV dahil düşülmüş</span>
          <span className="kutu-deger mono">{dosya.odenek ? tlKurus(dosya.odenek - sonuc.kdvDahil) : "Girilmedi"}</span>
        </div>
      </div>

      <section className="panel" aria-labelledby="kontrol-baslik" aria-live="polite">
        <div className="panel-baslik-satiri">
          <h2 id="kontrol-baslik">Kontroller</h2>
          <button type="button" className="dugme kucuk-dugme" onClick={() => setOnizleme({ tur: "cetvel" })} disabled={!sonuc.satirlar.length || !y.firmalar.length}>
            Cetveli önizle ve yazdır
          </button>
        </div>
        {kontroller.map((k) => (
          <KontrolSatiri key={k.baslik} k={k} />
        ))}
        {alim.bent === "22/d" && (
          <label className="onay-kutusu kucuk">
            <input type="checkbox" checked={false} onChange={() => maliyetDegistir({ hesaplanmayacak: true })} />
            Bu dosyada yaklaşık maliyet hesaplanmayacak (Tebliğ m.4/4)
          </label>
        )}
      </section>

      {onizleme && (
        <BelgeOnizleme
          baslik={onizleme.tur === "cetvel" ? `Yaklaşık maliyet cetveli · ${alim.id}` : `Fiyat isteme yazısı · ${alim.id}`}
          sayfalar={
            onizleme.tur === "cetvel"
              ? yaklasikMaliyetSayfalari(belge, sonuc, firmaAdi)
              : fiyatIstemeSayfalari(belge, onizleme.firma ? tedarikciler.find((t) => t.id === onizleme.firma) ?? null : null)
          }
          kapat={() => setOnizleme(null)}
        />
      )}
    </>
  );
}
