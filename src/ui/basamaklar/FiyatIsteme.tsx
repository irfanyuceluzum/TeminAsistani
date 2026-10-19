import { useState } from "react";
import type { FiyatIsteme, MaliyetFirmasi, YaklasikMaliyet } from "../../domain/basamaklar";
import { tutarCoz } from "../../domain/sihirbaz";
import { bosIse, tutarGirdisi } from "../bicim";
import { BelgeOnizleme } from "../BelgeOnizleme";
import { miktarYazisi } from "../IhtiyacListesi";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";
import { fiyatIstemeSayfalari } from "./belgeler";
import { YeniFirmaFormu } from "./YeniFirmaFormu";

const hucre = (firma: string, kalem: string) => `${firma}|${kalem}`;

export function FiyatIstemeBasamagi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir } = b;
  const { ayarlar, tedarikciler } = b.veri;
  const y = dosya.yaklasik;
  const f = dosya.fiyatIsteme;
  const kalemler = piyasa.kalemler;

  const [metinler, setMetinler] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const firma of y.firmalar) for (const k of kalemler) m[hucre(firma.tedarikciId, k.id)] = bosIse(firma.fiyatlar[k.id], tutarGirdisi, "");
    return m;
  });
  const [eklenecek, setEklenecek] = useState("");
  const [onizlemeFirma, setOnizlemeFirma] = useState<string | null | false>(false);

  const firmaAdi = (id: string) => tedarikciler.find((t) => t.id === id)?.ad ?? id;
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
        // Fiyat değiştiğinde 4. basamaktaki yaklaşık maliyet onayını yenilemek gerekir
        onaylandi: false,
        firmalar: x.yaklasik.firmalar.map((fi) => (fi.tedarikciId === firma.tedarikciId ? { ...fi, fiyatlar: { ...fi.fiyatlar, [kalemId]: kurus } } : fi)),
      },
    }));
  }

  if (y.hesaplanmayacak) {
    return (
      <section className="panel" aria-labelledby="fi-baslik">
        <h2 id="fi-baslik">3. Fiyat isteme yazısı</h2>
        <p>Bu dosyada yaklaşık maliyet hesaplanmayacak olarak işaretlendi. Doğrudan Temin Tebliği m.4/4 uyarınca 22/d alımlarında yaklaşık maliyet zorunlu değildir; bu basamak atlanır.</p>
        <button type="button" className="dugme kendi-genisligi" onClick={() => maliyetDegistir({ hesaplanmayacak: false })}>
          Yaklaşık maliyeti hesapla
        </button>
      </section>
    );
  }

  const fiyatliFirmaSayisi = y.firmalar.filter((fi) => Object.values(fi.fiyatlar).some((v) => v !== null && v > 0)).length;

  return (
    <>
      <section className="panel" aria-labelledby="istem-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="istem-baslik">3. Fiyat isteme yazısı ve firma teklifleri</h2>
            <p className="soluk kucuk">
              İhtiyaç listesi ve şartlar ekli fiyat isteme yazısı hazırlanır; firmalardan gelen kaşeli ve imzalı teklif fiyatları bu adımda girilir.
            </p>
          </div>
          <span className="dugme-grubu">
            <button type="button" className="dugme kucuk-dugme" onClick={() => setOnizlemeFirma(null)}>
              Yazıyı önizle ve yazdır
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
            <input id="fi-sayi" className="mono" value={f.sayi} onChange={(e) => yaziDegistir({ sayi: e.target.value })} placeholder="E-12345678-934-…" />
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

        <h3 className="ara-baslik">Fiyat İstenen Firmalar</h3>
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
                <button type="button" className="metin-dugme" onClick={() => setOnizlemeFirma(fi.tedarikciId)}>
                  Firmaya özel yazı
                </button>
                <button
                  type="button"
                  className="metin-dugme"
                  aria-label={`${firmaAdi(fi.tedarikciId)} firmasını çıkar`}
                  onClick={() => maliyetDegistir({ firmalar: y.firmalar.filter((x) => x.tedarikciId !== fi.tedarikciId), onaylandi: false })}
                >
                  Çıkar
                </button>
              </span>
            </li>
          ))}
          {y.firmalar.length === 0 && (
            <li className="soluk kucuk">Henüz firma eklenmedi. Aşağıdan en az 3 firma eklemeniz önerilir.</li>
          )}
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
              maliyetDegistir({ firmalar: [...y.firmalar, { tedarikciId: eklenecek, belgeAlindi: false, fiyatlar: {} }], onaylandi: false });
              setEklenecek("");
            }}
          >
            Firma ekle
          </button>
        </div>
        <YeniFirmaFormu
          b={b}
          kimlik="fi-yeni"
          onEklendi={(id) =>
            dosyaDegistir((x) => ({
              ...x,
              yaklasik: { ...x.yaklasik, firmalar: [...x.yaklasik.firmalar, { tedarikciId: id, belgeAlindi: false, fiyatlar: {} }], onaylandi: false },
            }))
          }
        />
      </section>

      <section className="panel bosluksuz" aria-labelledby="teklif-giris-baslik">
        <div className="panel-ust">
          <div>
            <h2 id="teklif-giris-baslik">Gelen Fiyat Teklifleri Girişi</h2>
            <p className="soluk kucuk">Firmalardan gelen kaşeli tekliflerdeki birim fiyatları KDV hariç olarak girin.</p>
          </div>
          <span className="soluk kucuk">
            {fiyatliFirmaSayisi} / {y.firmalar.length} firma fiyat verdi
          </span>
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
                </tr>
              </thead>
              <tbody>
                {kalemler.map((kalem) => (
                  <tr key={kalem.id}>
                    <td className="kalin">{kalem.ad || "Adsız kalem"}</td>
                    <td className="sag">
                      {miktarYazisi(kalem.miktar)} {kalem.birim}
                    </td>
                    {y.firmalar.map((fi) => {
                      const metin = metinler[hucre(fi.tedarikciId, kalem.id)] ?? "";
                      const gecersiz = metin.trim() !== "" && tutarCoz(metin) === null;
                      return (
                        <td key={fi.tedarikciId} className="sag">
                          <input
                            className={`girdi mono fiyat-girdi ${gecersiz ? "fiyat-gecersiz" : ""}`}
                            inputMode="decimal"
                            placeholder="—"
                            value={metin}
                            aria-invalid={gecersiz}
                            aria-label={`${kalem.ad}, ${firmaAdi(fi.tedarikciId)} birim fiyatı`}
                            onChange={(e) => fiyatGir(fi, kalem.id, e.target.value)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="bant bant-bilgi">
        Fiyat teklifleri girildikten sonra <strong>4. Yaklaşık Maliyet Cetveli</strong> basamağında ortalamalar ve en düşük fiyatlar hesaplanıp cetvel resmi olarak onaylanacaktır.
      </div>

      {onizlemeFirma !== false && (
        <BelgeOnizleme
          baslik={`Fiyat isteme yazısı · ${alim.id}`}
          sayfalar={fiyatIstemeSayfalari(belge, onizlemeFirma ? tedarikciler.find((t) => t.id === onizlemeFirma) ?? null : null)}
          kapat={() => setOnizlemeFirma(false)}
        />
      )}
    </>
  );
}
