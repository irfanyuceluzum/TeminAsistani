import { benzerAlimlar, ddLimitKontrolu, yuzdeOnDurumu } from "./kurallar";
import { turkceSayi } from "./sayi";
import type { Alim, Ayarlar, Bent, LimitDonemi } from "./tipler";

export interface BentBilgisi {
  kod: Bent;
  harf: string;
  ad: string;
  ozet: string;
  belgeler: string[];
}

// Uygulama yalnız 4734 md. 22/d içindir.
export const BENTLER: BentBilgisi[] = [
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
  },
];

// Doğrudan Temin Tebliği m.4/5: teslimi ya da yapımı belli süre gerektiren işlerde sözleşme zorunludur.
export function sozlesmeZorunlu(a: { bent: Bent; sureliIs?: boolean }): boolean {
  return !!a.sureliIs;
}

// Gizli eski kayıtlar çökmesin diye her kod için 22/d bilgisi döner; uygulama yalnız 22/d içindir.
export function bentBilgisi(_kod: Bent): BentBilgisi {
  return BENTLER[0];
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
  sureliIs?: boolean;
}

function tl(kurus: number): string {
  return "₺" + Math.round(kurus / 100).toLocaleString("tr-TR");
}

function yuzde(oran: number): string {
  return "%" + (oran * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// 22/d canlı kontrolleri. "engel" olan bir kontrol varken onay belgesine geçilmez.
export function dayanakKontrolleri(
  aday: Aday,
  alimlar: Alim[],
  ayarlar: Ayarlar,
  donemler: LimitDonemi[],
): Kontrol[] {
  const sonuc: Kontrol[] = [];
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
    bent: "22/d",
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
  if (sozlesmeZorunlu({ bent: "22/d", sureliIs: aday.sureliIs })) {
    sonuc.push({ durum: "yapilacak", baslik: "Sözleşme zorunlu", detay: "Sipariş yazısı yerine sözleşme imzalanmalı (Doğrudan Temin Tebliği m.4/5)." });
  }
  // Doğrudan Temin Tebliği m.4/9: tüm doğrudan temin alımlarının sonucu, alım ayını izleyen ayın 10'una kadar Kurum'a bildirilir.
  sonuc.push({ durum: "yapilacak", baslik: "KİK bildirimi", detay: "Alım sonucu, alımın yapıldığı ayı izleyen ayın 10'una kadar EKAP'tan bildirilecek." });
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
  const temiz = metin.replace(/TL/gi, "").replace(/[₺\s]/g, "");
  const sayi = turkceSayi(temiz);
  if (sayi === null || sayi < 0) return null;
  const kurus = sayi * 100;
  if (Math.abs(kurus - Math.round(kurus)) > 1e-6) return null;
  return Math.round(kurus);
}
