import { ddLimitKontrolu } from "./kurallar";
import type { Kontrol } from "./sihirbaz";
import type { Alim, Ayarlar, LimitDonemi, Tedarikci } from "./tipler";

export interface PiyasaKalemi {
  id: string;
  ad: string;
  miktar: number;
  birim: string;
  // Teknik özellik ya da açıklama; teklif cetveline yazılır
  ozellik?: string;
}

// Firmalara gönderilen fiyat teklifi isteme yazısı. Ekinde ihtiyaç listesinden üretilen boş teklif cetveli bulunur.
export interface TeklifYazisi {
  sayi: string;
  tarih: string;
  sonTeklifTarihi: string;
  teslimYeri: string;
  teslimSuresi: string;
  aciklama: string;
}

export interface FirmaTeklifi {
  tedarikciId: string;
  teklifTarihi: string | null;
  // Yasaklılık EKAP'ta sorgulanır; burada yalnızca sorgunun yapıldığı tarih tutulur.
  yasaklilikSorgusu: string | null;
  // Kalem kimliğine göre KDV hariç birim fiyat, kuruş
  fiyatlar: Record<string, number | null>;
  // Firmanın kaşeli ve imzalı teklif belgesi idareye ulaştı mı; fiyatlar bu belgeden girilir.
  belgeAlindi?: boolean;
}

export type Degerlendirme = "toplam" | "kalem";

export interface PiyasaArastirmasi {
  alimId: string;
  kalemler: PiyasaKalemi[];
  teklifler: FirmaTeklifi[];
  degerlendirme: Degerlendirme;
  gorevliler: string;
  tamamlandi: boolean;
  yazi?: TeklifYazisi;
}

export interface Atama {
  kalemId: string;
  tedarikciId: string;
  birimFiyat: number;
  tutar: number;
}

export interface Sonuc {
  mod: Degerlendirme;
  atamalar: Atama[];
  toplam: number;
  kazananlar: string[];
  esitlikler: string[];
}

export function bosYazi(tarih: string): TeklifYazisi {
  return { sayi: "", tarih, sonTeklifTarihi: "", teslimYeri: "", teslimSuresi: "", aciklama: "" };
}

// Teklif isteme yazısı gönderilebilir mi: ihtiyaç listesi eksiksiz ve son teklif tarihi belirli olmalı.
export function yaziEksikleri(p: PiyasaArastirmasi): string[] {
  const e: string[] = [];
  if (p.kalemler.length === 0) e.push("İhtiyaç listesinde kalem yok.");
  const eksikKalem = p.kalemler.filter((k) => !k.ad.trim() || !(k.miktar > 0));
  if (eksikKalem.length) e.push(`${eksikKalem.length} kalemin adı ya da miktarı eksik.`);
  if (!p.yazi?.tarih) e.push("Yazı tarihi girilmedi.");
  if (!p.yazi?.sonTeklifTarihi) e.push("Son teklif tarihi girilmedi.");
  else if (p.yazi.tarih && p.yazi.sonTeklifTarihi < p.yazi.tarih) e.push("Son teklif tarihi yazı tarihinden önce olamaz.");
  return e;
}

export function bosArastirma(alimId: string): PiyasaArastirmasi {
  return { alimId, kalemler: [], teklifler: [], degerlendirme: "toplam", gorevliler: "", tamamlandi: false };
}

export function kalemTutari(k: PiyasaKalemi, birimFiyat: number): number {
  return Math.round(k.miktar * birimFiyat);
}

function fiyat(t: FirmaTeklifi, kalemId: string): number | null {
  const f = t.fiyatlar[kalemId];
  return f === undefined ? null : f;
}

// Bir kalemine bile fiyat vermeyen firmanın toplamı yoktur, toplam bazlı değerlendirmeye girmez.
export function firmaToplami(p: PiyasaArastirmasi, tedarikciId: string): number | null {
  const t = p.teklifler.find((x) => x.tedarikciId === tedarikciId);
  if (!t || p.kalemler.length === 0) return null;
  let toplam = 0;
  for (const k of p.kalemler) {
    const f = fiyat(t, k.id);
    if (f === null) return null;
    toplam += kalemTutari(k, f);
  }
  return toplam;
}

export function teklifVerenler(p: PiyasaArastirmasi): FirmaTeklifi[] {
  return p.teklifler.filter((t) => p.kalemler.some((k) => fiyat(t, k.id) !== null));
}

function toplamBazli(p: PiyasaArastirmasi): Sonuc | null {
  const adaylar = p.teklifler
    .map((t) => ({ id: t.tedarikciId, toplam: firmaToplami(p, t.tedarikciId) }))
    .filter((x): x is { id: string; toplam: number } => x.toplam !== null);
  if (adaylar.length === 0) return null;
  const enDusuk = Math.min(...adaylar.map((a) => a.toplam));
  const esitler = adaylar.filter((a) => a.toplam === enDusuk);
  const kazanan = esitler[0].id;
  const t = p.teklifler.find((x) => x.tedarikciId === kazanan)!;
  return {
    mod: "toplam",
    atamalar: p.kalemler.map((k) => {
      const f = fiyat(t, k.id)!;
      return { kalemId: k.id, tedarikciId: kazanan, birimFiyat: f, tutar: kalemTutari(k, f) };
    }),
    toplam: enDusuk,
    kazananlar: [kazanan],
    esitlikler: esitler.length > 1 ? ["En düşük toplam teklif birden fazla firmada eşit"] : [],
  };
}

function kalemBazli(p: PiyasaArastirmasi): Sonuc | null {
  const atamalar: Atama[] = [];
  const esitlikler: string[] = [];
  for (const k of p.kalemler) {
    const verenler = p.teklifler
      .map((t) => ({ id: t.tedarikciId, f: fiyat(t, k.id) }))
      .filter((x): x is { id: string; f: number } => x.f !== null);
    if (verenler.length === 0) return null;
    const enDusuk = Math.min(...verenler.map((v) => v.f));
    const esitler = verenler.filter((v) => v.f === enDusuk);
    if (esitler.length > 1) esitlikler.push(`${k.ad} kaleminde eşit en düşük fiyat`);
    atamalar.push({ kalemId: k.id, tedarikciId: esitler[0].id, birimFiyat: enDusuk, tutar: kalemTutari(k, enDusuk) });
  }
  if (atamalar.length === 0) return null;
  const kazananlar = [...new Set(atamalar.map((a) => a.tedarikciId))];
  return { mod: "kalem", atamalar, toplam: atamalar.reduce((s, a) => s + a.tutar, 0), kazananlar, esitlikler };
}

// Eşitlikte ilk girilen teklif seçilir ve kontrol listesinde uyarı verilir.
export function degerlendir(p: PiyasaArastirmasi): Sonuc | null {
  return p.degerlendirme === "toplam" ? toplamBazli(p) : kalemBazli(p);
}

function tl(kurus: number): string {
  return "₺" + (kurus / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 });
}

export function piyasaKontrolleri(
  p: PiyasaArastirmasi,
  sonuc: Sonuc | null,
  alim: Alim,
  ayarlar: Ayarlar,
  donemler: LimitDonemi[],
  tedarikciler: Tedarikci[],
  enAzTeklif = 3,
): Kontrol[] {
  const ad = (id: string) => tedarikciler.find((t) => t.id === id)?.ad ?? id;
  if (p.kalemler.length === 0) return [{ durum: "engel", baslik: "Kalem yok", detay: "Fiyat istenecek kalemleri ekleyin." }];

  const k: Kontrol[] = [];
  const yaziEksik = yaziEksikleri(p);
  k.push(
    yaziEksik.length
      ? { durum: "yapilacak", baslik: "Teklif isteme yazısı", detay: yaziEksik.join(" ") }
      : { durum: "tamam", baslik: "Teklif isteme yazısı", detay: `Son teklif tarihi ${p.yazi!.sonTeklifTarihi.split("-").reverse().join(".")}.` },
  );
  const verenler = teklifVerenler(p);
  if (verenler.length === 0) {
    k.push({ durum: "engel", baslik: "Teklif yok", detay: "Firmaları ekleyip fiyatlarını girin." });
  } else if (verenler.length < enAzTeklif) {
    k.push({
      durum: "uyari",
      baslik: `${verenler.length} teklif alındı`,
      detay: `Daha az teklifle ilerlerseniz nedenini tutanağa yazın.`,
    });
  } else {
    k.push({ durum: "tamam", baslik: `${verenler.length} teklif alındı`, detay: "Karşılaştırma için yeterli." });
  }

  if (!sonuc) {
    if (verenler.length > 0) {
      k.push({
        durum: "engel",
        baslik: "Eksik fiyat",
        detay:
          p.degerlendirme === "toplam"
            ? "Toplam bazlı değerlendirmede en az bir firmanın tüm kalemlere fiyat vermesi gerekir."
            : "Her kaleme en az bir firmanın fiyat vermesi gerekir.",
      });
    }
    return k;
  }

  const belgesiz = sonuc.kazananlar.filter((id) => !p.teklifler.find((t) => t.tedarikciId === id)?.belgeAlindi);
  if (belgesiz.length) {
    k.push({ durum: "engel", baslik: "Kaşeli teklif belgesi yok", detay: `${belgesiz.map(ad).join(", ")} için kaşeli ve imzalı teklif belgesinin alındığını işaretleyin.` });
  }

  const sorgusuz = sonuc.kazananlar.filter((id) => !p.teklifler.find((t) => t.tedarikciId === id)?.yasaklilikSorgusu);
  k.push(
    sorgusuz.length
      ? { durum: "engel", baslik: "Yasaklılık sorgusu eksik", detay: `${sorgusuz.map(ad).join(", ")} için EKAP sorgusunu yapıp işaretleyin.` }
      : { durum: "tamam", baslik: "Yasaklılık sorgusu", detay: "Seçilen firmaların sorgusu yapıldı." },
  );

  if (alim.bent === "22/d") {
    const limit = ddLimitKontrolu(sonuc.toplam, alim.onayTarihi, ayarlar.konum, donemler);
    if (limit.durum === "asiyor") {
      k.push({ durum: "engel", baslik: "22/d limiti aşılıyor", detay: `Sonuç ${tl(sonuc.toplam)}, limit ${tl(limit.limit)}.` });
    }
  }

  if (sonuc.toplam > alim.tutar) {
    k.push({
      durum: "uyari",
      baslik: "Onay tutarı aşılıyor",
      detay: `Sonuç ${tl(sonuc.toplam)}, onay belgesindeki tutar ${tl(alim.tutar)}. Onayı ve ödeneği gözden geçirin.`,
    });
  }

  for (const e of sonuc.esitlikler) {
    k.push({ durum: "uyari", baslik: "Eşit teklif", detay: `${e}. İlk girilen firma seçildi, tutanağa gerekçe yazın.` });
  }

  if (sonuc.kazananlar.length > 1) {
    k.push({ durum: "yapilacak", baslik: `${sonuc.kazananlar.length} ayrı sipariş`, detay: "Kalem bazlı sonuçta her firma için ayrı sipariş, kabul ve ödeme yapılır." });
  }
  return k;
}
