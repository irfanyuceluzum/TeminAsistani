import type { ReactNode } from "react";
import { SARTLAR, type DosyaBasamaklari, type MaliyetSonucu } from "../../domain/basamaklar";
import { kisi } from "../../domain/personel";
import type { PiyasaKalemi } from "../../domain/piyasa";
import { bentBilgisi } from "../../domain/sihirbaz";
import type { Alim, Ayarlar, Tedarikci } from "../../domain/tipler";
import { tlKurus, uzunTarih } from "../bicim";
import { IdareBasligi } from "../IdareBasligi";
import { IhtiyacTablosu, miktarYazisi } from "../IhtiyacListesi";

// Basamak belgelerinin A4 sayfaları. Her işlev BelgeOnizleme'ye verilecek sayfa dizisini döndürür.

export interface BelgeBilgisi {
  alim: Alim;
  ayarlar: Ayarlar;
  dosya: DosyaBasamaklari;
  kalemler: PiyasaKalemi[];
}

function imzaci(ayarlar: Ayarlar, id: string | null | undefined): { ad: string; unvan: string } {
  const p = kisi(ayarlar.personel ?? [], id ?? null);
  return p ? { ad: p.ad, unvan: p.unvan } : { ad: "…", unvan: "" };
}

// Resmî yazışmada imza adı: "Ayşe DEMİR"
function imzaAdi(ad: string): string {
  const parcalar = ad.trim().split(/\s+/);
  if (parcalar.length < 2) return ad;
  const soyad = parcalar.pop()!;
  return `${parcalar.join(" ")} ${soyad.toLocaleUpperCase("tr-TR")}`;
}

function tarihYazisi(t: string): string {
  return t ? uzunTarih(t) : "…/…/……";
}

export function SartlarListesi({ dosya }: { dosya: DosyaBasamaklari }) {
  return (
    <>
      <p className="kalin">İdari ve teknik şartlar</p>
      <ol className="sart-listesi">
        {SARTLAR.map((s) => (
          <li key={s.kod}>
            {s.ad}: {dosya.sartlar[s.kod].trim() || "Yoktur."}
          </li>
        ))}
      </ol>
    </>
  );
}

function EkIhtiyacListesi({ b, imzalayan }: { b: BelgeBilgisi; imzalayan: { ad: string; unvan: string; gorev: string } }) {
  return (
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <p className="belge-baslik">İHTİYAÇ LİSTESİ</p>
      <div className="belge-satir">
        <span>İşin adı: {b.alim.konu}</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} />
      <SartlarListesi dosya={b.dosya} />
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(imzalayan.ad)}</span>
          <span>{imzalayan.unvan}</span>
          <span>{imzalayan.gorev}</span>
        </div>
      </div>
    </>
  );
}

export function ihtiyacOnayiSayfalari(b: BelgeBilgisi): ReactNode[] {
  const o = b.dosya.ihtiyacOnayi;
  const g = b.ayarlar.gorevler;
  const arz = imzaci(b.ayarlar, g?.gerceklestirme);
  const olur = imzaci(b.ayarlar, g?.harcamaYetkilisi);
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir">
        <span>Sayı: {o.sayi || "…"}</span>
        <span>{tarihYazisi(o.tarih)}</span>
      </div>
      <p>Konu: İhtiyaç onayı</p>
      <p className="belge-baslik">MÜDÜRLÜK MAKAMINA</p>
      {o.gerekce.trim() && <p className="girintili">{o.gerekce.trim()}</p>}
      <p className="girintili">
        Bu nedenle ekli listede cinsi ve miktarı belirtilen {b.kalemler.length} kalem ihtiyacın ("{b.alim.konu}") 4734 sayılı Kamu İhale Kanununun 22 nci
        maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi uyarınca doğrudan temin usulüyle
        {b.alim.ekonomikKod ? `, ${b.alim.ekonomikKod} tertibindeki ödenekten karşılanmak üzere` : ""} satın alınmasını olurlarınıza arz ederim.
      </p>
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(arz.ad)}</span>
          <span>{arz.unvan}</span>
          <span>Gerçekleştirme Görevlisi</span>
        </div>
      </div>
      <div className="belge-onay">
        <span className="kalin">OLUR</span>
        <span>{tarihYazisi(o.tarih)}</span>
        <span className="imza-bosluk" />
        <span>{imzaAdi(olur.ad)}</span>
        <span>{olur.unvan}</span>
        <span>Harcama Yetkilisi</span>
      </div>
      <p className="kucuk">EK: İhtiyaç listesi (1 sayfa)</p>
    </>,
    <EkIhtiyacListesi b={b} imzalayan={{ ...arz, gorev: "Gerçekleştirme Görevlisi" }} />,
  ];
}

export function fiyatIstemeSayfalari(b: BelgeBilgisi, firma: Tedarikci | null): ReactNode[] {
  const f = b.dosya.fiyatIsteme;
  const g = b.ayarlar.gorevler;
  const gorevli = imzaci(b.ayarlar, g?.piyasaGorevlileri[0]);
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <div className="belge-satir">
        <span>Sayı: {f.sayi || "…"}</span>
        <span>{tarihYazisi(f.tarih)}</span>
      </div>
      <p>Konu: Yaklaşık maliyet için fiyat istenmesi</p>
      <p className="kalin">{firma ? firma.ad : "Sayın Yetkili"}</p>
      <p className="girintili">
        İdaremizce 4734 sayılı Kamu İhale Kanununun 22 nci maddesinin ({bentBilgisi(b.alim.bent).harf}) bendi uyarınca doğrudan temin usulüyle alınması
        planlanan "{b.alim.konu}" işinin yaklaşık maliyetinin tespiti amacıyla, ekli listede nitelik ve miktarları belirtilen kalemlere ilişkin KDV hariç birim
        fiyatlarınızın kaşeli ve imzalı olarak en geç <span className="kalin">{tarihYazisi(f.sonTarih)}</span> tarihine kadar idaremize bildirilmesini rica ederim.
      </p>
      <p className="girintili">Bu yazı teklif isteme niteliğinde değildir; bildirilen fiyatlar yalnızca yaklaşık maliyetin hesaplanmasında kullanılır.</p>
      {b.dosya.teslimYeri && (
        <table className="belge-tablo">
          <tbody>
            <tr>
              <th scope="row">Teslim yeri</th>
              <td>{b.dosya.teslimYeri}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="belge-imzalar">
        <div />
        <div>
          <span className="imza-bosluk" />
          <span>{imzaAdi(gorevli.ad)}</span>
          <span>{gorevli.unvan}</span>
          <span>Piyasa Fiyat Araştırması Görevlisi</span>
        </div>
      </div>
      <p className="kucuk">EK: Fiyat cetveli ve şartlar (1 sayfa)</p>
    </>,
    <>
      <div className="belge-satir">
        <span className="kalin">FİYAT CETVELİ</span>
        <span>EK-1</span>
      </div>
      <div className="belge-satir">
        <span>İşin adı: {b.alim.konu}</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <IhtiyacTablosu kalemler={b.kalemler} fiyatSutunlari />
      <SartlarListesi dosya={b.dosya} />
      <div className="firma-kase">
        <div className="firma-kase-bilgi">
          <span>Firma unvanı: {firma?.ad ?? ""}</span>
          <span>Vergi dairesi ve no: {firma ? [firma.vergiDairesi, firma.vkn].filter(Boolean).join(" · ") : ""}</span>
          <span>Adres ve telefon: {firma ? [firma.adres, firma.telefon].filter(Boolean).join(" · ") : ""}</span>
          <span>Tarih: …/…/……</span>
        </div>
        <div className="firma-kase-alan">Kaşe ve imza</div>
      </div>
    </>,
  ];
}

export function yaklasikMaliyetSayfalari(b: BelgeBilgisi, sonuc: MaliyetSonucu, firmaAdi: (id: string) => string): ReactNode[] {
  const y = b.dosya.yaklasik;
  const g = b.ayarlar.gorevler;
  const gorevliler = (g?.piyasaGorevlileri ?? []).map((id) => imzaci(b.ayarlar, id));
  const olur = imzaci(b.ayarlar, g?.harcamaYetkilisi);
  const fiyat = (k: number | null) => (k === null ? "—" : tlKurus(k).slice(1));
  return [
    <>
      <IdareBasligi ayarlar={b.ayarlar} />
      <p className="belge-baslik">YAKLAŞIK MALİYET HESAP CETVELİ</p>
      <div className="belge-satir">
        <span>İşin adı: {b.alim.konu}</span>
        <span>Dosya: {b.alim.id}</span>
      </div>
      <table className="belge-tablo cetvel-tablo">
        <thead>
          <tr>
            <th scope="col">Sıra</th>
            <th scope="col">Kalem</th>
            <th scope="col">Miktar</th>
            {y.firmalar.map((f, i) => (
              <th key={f.tedarikciId} scope="col">
                {i + 1}. firma
              </th>
            ))}
            <th scope="col">{y.yontem === "ortalama" ? "Ortalama" : "En düşük"} birim fiyat</th>
            <th scope="col">Tutar</th>
          </tr>
        </thead>
        <tbody>
          {sonuc.satirlar.map((r, i) => (
            <tr key={r.kalem.id}>
              <td>{i + 1}</td>
              <td>{r.kalem.ad}</td>
              <td>
                {miktarYazisi(r.kalem.miktar)} {r.kalem.birim}
              </td>
              {r.fiyatlar.map((x, j) => (
                <td key={j} className="sag">
                  {fiyat(x)}
                </td>
              ))}
              <td className="sag">{fiyat(r.birimFiyat)}</td>
              <td className="sag">{tlKurus(r.tutar).slice(1)}</td>
            </tr>
          ))}
          <tr>
            <th scope="row" colSpan={4 + y.firmalar.length}>
              Toplam (KDV hariç)
            </th>
            <td className="sag kalin">{tlKurus(sonuc.toplam)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={4 + y.firmalar.length}>
              KDV %{y.kdvOrani}
            </th>
            <td className="sag">{tlKurus(sonuc.kdv)}</td>
          </tr>
          <tr>
            <th scope="row" colSpan={4 + y.firmalar.length}>
              Toplam (KDV dahil)
            </th>
            <td className="sag">{tlKurus(sonuc.kdvDahil)}</td>
          </tr>
        </tbody>
      </table>
      <p className="kucuk">
        Firmalar: {y.firmalar.map((f, i) => `${i + 1}. ${firmaAdi(f.tedarikciId)}`).join("; ") || "…"}. Fiyatlar KDV hariç Türk lirasıdır; firmalardan alınan kaşeli
        fiyat belgelerine dayanır.
      </p>
      <div className="belge-imzalar uc-imza">
        {(gorevliler.length ? gorevliler : [{ ad: "…", unvan: "" }]).map((p, i) => (
          <div key={i}>
            <span className="imza-bosluk" />
            <span>{imzaAdi(p.ad)}</span>
            <span>{p.unvan}</span>
            <span>Görevli</span>
          </div>
        ))}
      </div>
      <div className="belge-onay">
        <span className="kalin">ONAY</span>
        <span>…/…/……</span>
        <span className="imza-bosluk" />
        <span>{imzaAdi(olur.ad)}</span>
        <span>{olur.unvan}</span>
        <span>Harcama Yetkilisi</span>
      </div>
    </>,
  ];
}
