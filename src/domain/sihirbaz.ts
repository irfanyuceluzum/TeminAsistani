import { benzerAlimlar, ddLimitKontrolu, yuzdeOnDurumu } from "./kurallar";
import type { Alim, Ayarlar, Bent, LimitDonemi } from "./tipler";

export interface BentBilgisi {
  kod: Bent;
  harf: string;
  ad: string;
  ozet: string;
  belgeler: string[];
  kikBildirimi: boolean;
}

export const BENTLER: BentBilgisi[] = [
  {
    kod: "22/a",
    harf: "a",
    ad: "Tek kişi karşılayabilir",
    ozet: "İhtiyacı yalnızca bir gerçek veya tüzel kişi karşılayabiliyor.",
    belgeler: ["Tek kaynak tespit raporu (gerekçeli)", "Doğrudan temin onay belgesi", "Firmadan fiyat teklifi"],
    kikBildirimi: true,
  },
  {
    kod: "22/b",
    harf: "b",
    ad: "Özel hak sahibi",
    ozet: "Yalnızca bir kişinin ihtiyaçla ilgili özel bir hakkı var.",
    belgeler: ["Özel hak belgesi (patent, lisans, münhasır yetki)", "Doğrudan temin onay belgesi", "Firmadan fiyat teklifi"],
    kikBildirimi: true,
  },
  {
    kod: "22/c",
    harf: "c",
    ad: "Uyum ve standardizasyon",
    ozet: "Mevcut mal veya sistemle uyum için asıl yükleniciden alım.",
    belgeler: ["Asıl sözleşmenin bilgileri", "Uyum zorunluluğu gerekçesi", "Doğrudan temin onay belgesi"],
    kikBildirimi: true,
  },
  {
    kod: "22/d",
    harf: "d",
    ad: "Parasal limit altı",
    ozet: "Limiti aşmayan ihtiyaçlar ile temsil ve ağırlama alımları.",
    belgeler: [
      "Doğrudan temin onay belgesi",
      "Piyasa fiyat araştırması tutanağı ve teklifler",
      "Sipariş yazısı veya sözleşme",
      "Muayene ve kabul tutanağı, fatura",
    ],
    kikBildirimi: false,
  },
  {
    kod: "22/e",
    harf: "e",
    ad: "Taşınmaz alımı veya kiralama",
    ozet: "İdarenin ihtiyacı olan taşınmazın alımı ya da kiralanması.",
    belgeler: ["Değerleme veya emsal kira raporu", "Doğrudan temin onay belgesi", "Kira sözleşmesi taslağı"],
    kikBildirimi: true,
  },
];

export function bentBilgisi(kod: Bent): BentBilgisi {
  return BENTLER.find((b) => b.kod === kod)!;
}

export type KontrolDurumu = "tamam" | "uyari" | "engel" | "yapilacak";

export interface Kontrol {
  durum: KontrolDurumu;
  baslik: string;
  detay: string;
}

export interface Aday {
  onayTarihi: string;
  tutar: number;
  ekonomikKod: string;
  kalemKodu: string;
}

function tl(kurus: number): string {
  return "₺" + Math.round(kurus / 100).toLocaleString("tr-TR");
}

function yuzde(oran: number): string {
  return "%" + (oran * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Seçilen bende göre canlı kontroller. "engel" olan bir kontrol varken onay belgesine geçilmez.
export function dayanakKontrolleri(
  aday: Aday,
  bent: Bent,
  alimlar: Alim[],
  ayarlar: Ayarlar,
  donemler: LimitDonemi[],
): Kontrol[] {
  const sonuc: Kontrol[] = [];
  if (bent === "22/d") {
    const limit = ddLimitKontrolu(aday.tutar, aday.onayTarihi, ayarlar.konum, donemler);
    if (limit.durum === "donem-yok") {
      sonuc.push({ durum: "engel", baslik: "Limit dönemi tanımlı değil", detay: "Bu tarih için 22/d limitini Parametreler'e ekleyin." });
    } else if (limit.durum === "asiyor") {
      sonuc.push({
        durum: "engel",
        baslik: "22/d limiti aşılıyor",
        detay: `${tl(aday.tutar)}, limit ${tl(limit.limit)}'nin üzerinde. Bu alım 22/d ile yapılamaz.`,
      });
    } else {
      sonuc.push({ durum: "tamam", baslik: "22/d limiti içinde", detay: `${tl(aday.tutar)}, limit ${tl(limit.limit)}'nin altında.` });
    }

    const yil = Number(aday.onayTarihi.slice(0, 4));
    const odenek = ayarlar.odenekler[yil];
    if (!odenek) {
      sonuc.push({ durum: "uyari", baslik: `${yil} ödeneği girilmemiş`, detay: "%10 sınırı hesaplanamıyor. Ödeneği Parametreler'e girin." });
    } else {
      const d = yuzdeOnDurumu(alimlar, yil, odenek, aday.tutar);
      sonuc.push(
        d.asiyor
          ? { durum: "uyari", baslik: "%10 sınırı aşılıyor", detay: `Bu alımla ${yuzde(d.sonrakiOran)} olur. Kurum'un uygun görüşü gerekir.` }
          : { durum: "tamam", baslik: "Yıllık %10 sınırı", detay: `${yuzde(d.oran)} → ${yuzde(d.sonrakiOran)}` },
      );
    }

    const taslak: Alim = {
      id: "",
      onayTarihi: aday.onayTarihi,
      konu: "",
      bent,
      tutar: aday.tutar,
      ekonomikKod: aday.ekonomikKod,
      kalemKodu: aday.kalemKodu,
      tedarikciId: null,
      asama: "dayanak",
      sonIslem: aday.onayTarihi,
    };
    const benzer = benzerAlimlar(taslak, alimlar, ayarlar.bolme);
    if (benzer.length > 0) {
      const toplam = benzer.reduce((t, a) => t + a.tutar, 0);
      sonuc.push({
        durum: "uyari",
        baslik: `${benzer.length} benzer alım var`,
        detay: `Son ${ayarlar.bolme.pencereGun} günde ${benzer.map((a) => a.id).join(", ")} (toplam ${tl(toplam)}). Bölme sayılmaması için gerekçe ekleyin.`,
      });
    }
  } else {
    const bilgi = bentBilgisi(bent);
    sonuc.push({ durum: "yapilacak", baslik: "Dayanak belgesi", detay: `${bilgi.belgeler[0]} dosyaya eklenmeli.` });
  }
  if (bentBilgisi(bent).kikBildirimi) {
    sonuc.push({ durum: "yapilacak", baslik: "KİK bildirimi", detay: "Alım sonrası Kurum'a bildirilecekler listesine eklenecek." });
  }
  return sonuc;
}

export function engelVarMi(kontroller: Kontrol[]): boolean {
  return kontroller.some((k) => k.durum === "engel");
}

export function yeniDosyaNo(alimlar: Alim[], yil: number): string {
  const onek = `DT-${yil}-`;
  const enBuyuk = alimlar
    .filter((a) => a.id.startsWith(onek))
    .reduce((m, a) => Math.max(m, Number(a.id.slice(onek.length)) || 0), 0);
  return onek + String(enBuyuk + 1).padStart(3, "0");
}

// "38.500,00", "38500", "₺ 38.500" → kuruş. Geçersiz girişte null.
export function tutarCoz(metin: string): number | null {
  const temiz = metin.replace(/[₺\s]/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(temiz)) return null;
  return Math.round(Number(temiz) * 100);
}
