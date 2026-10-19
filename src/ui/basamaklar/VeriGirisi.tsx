import { useState } from "react";
import { SARTLAR, veriKontrolleri, type SartKodu } from "../../domain/basamaklar";
import { bentBilgisi, tutarCoz } from "../../domain/sihirbaz";
import { tlKurus, uzunTarih } from "../bicim";
import { IhtiyacListesiDuzenleyici } from "../IhtiyacListesi";
import { KontrolSatiri } from "../KontrolSatiri";
import type { BasamakBaglami } from "../sayfalar/DosyaCalismaAlani";

function odenekYazisi(kurus: number): string {
  return kurus ? (kurus / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
}

export function VeriGirisi({ b }: { b: BasamakBaglami }) {
  const { alim, piyasa, dosya, dosyaDegistir } = b;
  const [odenekMetni, setOdenekMetni] = useState(odenekYazisi(dosya.odenek));
  const odenekGecersiz = odenekMetni.trim() !== "" && tutarCoz(odenekMetni) === null;
  const kontroller = veriKontrolleri(piyasa.kalemler, dosya, alim);

  const sartDegistir = (kod: SartKodu, deger: string) => dosyaDegistir((d) => ({ ...d, sartlar: { ...d.sartlar, [kod]: deger } }));

  return (
    <>
      <section className="panel" aria-labelledby="bilgi-baslik">
        <div>
          <h2 id="bilgi-baslik">Alım bilgileri</h2>
          <p className="soluk kucuk">Bir kez girilir; ihtiyaç onayından ödeme emrine kadar bütün belgelere dolar.</p>
        </div>
        <dl className="ozet-listesi">
          <div>
            <dt>İşin adı</dt>
            <dd>{alim.konu}</dd>
          </div>
          <div>
            <dt>Dayanak</dt>
            <dd>
              <span className="mono">{alim.bent}</span> · {bentBilgisi(alim.bent).ad}
            </dd>
          </div>
          <div>
            <dt>Ekonomik kod</dt>
            <dd className="mono">{alim.ekonomikKod}</dd>
          </div>
          <div>
            <dt>Dosya açılışı</dt>
            <dd>{uzunTarih(alim.onayTarihi)}</dd>
          </div>
        </dl>
        <div className="form-izgara">
          <div className="alan">
            <label htmlFor="talep-eden">İhtiyacı bildiren birim</label>
            <input id="talep-eden" value={dosya.talepEden} onChange={(e) => dosyaDegistir((d) => ({ ...d, talepEden: e.target.value }))} placeholder="Okul aile birliği" />
          </div>
          <div className="alan">
            <label htmlFor="teslim-yeri">Teslim yeri</label>
            <input id="teslim-yeri" value={dosya.teslimYeri} onChange={(e) => dosyaDegistir((d) => ({ ...d, teslimYeri: e.target.value }))} placeholder="Okul deposu" />
          </div>
          <div className="alan">
            <label htmlFor="odenek">Kullanılabilir ödenek (₺)</label>
            <input
              id="odenek"
              className="mono"
              inputMode="decimal"
              value={odenekMetni}
              aria-invalid={odenekGecersiz}
              aria-describedby="odenek-not"
              onChange={(e) => {
                setOdenekMetni(e.target.value);
                const k = e.target.value.trim() === "" ? 0 : tutarCoz(e.target.value);
                if (k !== null) dosyaDegistir((d) => ({ ...d, odenek: k }));
              }}
            />
            <span id="odenek-not" className={`kucuk ${odenekGecersiz ? "hata-yazi" : "soluk"}`}>
              {odenekGecersiz ? "Tutarı 85.000,00 biçiminde yazın." : dosya.odenek ? `${tlKurus(dosya.odenek)} · ${alim.ekonomikKod} tertibi` : "Bütçe tertibindeki kalan ödenek"}
            </span>
          </div>
        </div>
        <div className="form-izgara genis-alanlar">
          <div className="alan">
            <label htmlFor="nitelik">İşin niteliği, türü ve miktarı</label>
            <textarea id="nitelik" rows={2} value={dosya.nitelik} onChange={(e) => dosyaDegistir((d) => ({ ...d, nitelik: e.target.value }))} placeholder="Boşsa ihtiyaç listesinden yazılır" />
          </div>
          <div className="alan">
            <label htmlFor="bolme">Bölme yasağı açıklaması (4734 md. 5)</label>
            <textarea id="bolme" rows={2} value={dosya.bolmeGerekcesi} onChange={(e) => dosyaDegistir((d) => ({ ...d, bolmeGerekcesi: e.target.value }))} placeholder="60 gün içinde benzer alım varsa neden ayrı yapıldığını yazın" />
          </div>
        </div>
        <label className="onay-kutusu onay-zemin">
          <input
            type="checkbox"
            checked={!!alim.sureliIs}
            onChange={(e) =>
              void b.alimDegistir(
                { sureliIs: e.target.checked },
                e.target.checked ? "Süreye yayılan iş olarak işaretlendi, sözleşme zorunlu" : "Süreye yayılan iş işareti kaldırıldı",
              )
            }
          />
          <span>
            Teslimi veya yapımı belli bir süreye yayılıyor
            <span className="soluk kucuk"> · işaretlenirse 8. basamak sözleşme olur (Tebliğ m.4/5)</span>
          </span>
        </label>
      </section>

      <section className="panel" aria-labelledby="ihtiyac-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="ihtiyac-baslik">İhtiyaç listesi</h2>
            <p className="soluk kucuk">Fiyat isteme yazısının, yaklaşık maliyet cetvelinin ve tutanakların ekidir. Fiyat burada girilmez.</p>
          </div>
          <span className="soluk kucuk">{piyasa.kalemler.length} kalem</span>
        </div>
        {piyasa.tamamlandi && (
          <div className="bant bant-bilgi">Piyasa araştırması tamamlandığı için liste kilitli. Değiştirmek için araştırmayı yeniden açın.</div>
        )}
        <IhtiyacListesiDuzenleyici kalemler={piyasa.kalemler} degistir={b.kalemleriDegistir} kilitli={piyasa.tamamlandi} />
      </section>

      <section className="panel" aria-labelledby="sart-baslik">
        <div className="panel-baslik-satiri">
          <div>
            <h2 id="sart-baslik">İdari ve teknik şartlar</h2>
            <p className="soluk kucuk">Fiyat isteme yazısında ve ihtiyaç listesinde yer alır. Boş bırakılan madde belgeye "Yoktur" olarak yazılır.</p>
          </div>
          <button
            type="button"
            className="dugme kucuk-dugme"
            onClick={() =>
              dosyaDegistir((d) => ({ ...d, sartlar: Object.fromEntries(SARTLAR.map((s) => [s.kod, d.sartlar[s.kod].trim() || s.ornek])) as typeof d.sartlar }))
            }
          >
            Boşları örnekle doldur
          </button>
        </div>
        <div className="form-izgara genis-alanlar">
          {SARTLAR.map((s, i) => (
            <div key={s.kod} className="alan">
              <label htmlFor={`sart-${s.kod}`}>
                {i + 1}. {s.ad}
              </label>
              <textarea id={`sart-${s.kod}`} rows={2} value={dosya.sartlar[s.kod]} placeholder={s.ornek} onChange={(e) => sartDegistir(s.kod, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      <section className="panel" aria-labelledby="kontrol-baslik" aria-live="polite">
        <h2 id="kontrol-baslik">Kontroller</h2>
        {kontroller.map((k) => (
          <KontrolSatiri key={k.baslik} k={k} />
        ))}
      </section>
    </>
  );
}
