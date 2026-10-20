import { basamaklar, tarihSirasiKontrolleri, type BasamakGirdisi } from "./basamaklar";
import { evrakDurumlari, kapanisEksikleri } from "./dosya";
import { degerlendir } from "./piyasa";
import { kikSonGunu } from "./raporlar";
import { sozlesmeZorunlu, type Kontrol } from "./sihirbaz";
import { gunYaz } from "./tarih";

// 12. basamak "Kontrol ve kapanış": dosyanın kapanıp kapanamayacağını ve dizinini saf işlevlerle hesaplar.

export interface KapanisGirdisi extends BasamakGirdisi {
  // Bugünün tarihi, YYYY-AA-GG
  bugun: string;
}

export interface KontrolOzeti {
  // Kapanışı engelleyenler: tamamlanmamış 1–11. basamaklar ve zorunlu evrak eksikleri
  engeller: Kontrol[];
  // Kapanışı engellemeyen uyarılar, işaretler ve yapılabilecekler
  uyarilar: Kontrol[];
  hazir: boolean;
}

const bos = (s: string | undefined | null) => !s || !s.trim();

export function kontrolOzeti(g: KapanisGirdisi): KontrolOzeti {
  const engeller: Kontrol[] = [];
  for (const b of basamaklar(g)) {
    if (b.no > 11 || b.durum === "tamam" || b.durum === "gerekmiyor") continue;
    engeller.push({ durum: "engel", baslik: `${b.no}. basamak tamamlanmadı: ${b.ad}`, detay: b.not });
  }
  for (const ad of kapanisEksikleri(g.alim, g.evraklar, g.piyasa)) {
    engeller.push({ durum: "engel", baslik: `Eksik evrak: ${ad}`, detay: "Zorunlu evrak tamamlanmadan dosya kapatılamaz." });
  }

  const uyarilar: Kontrol[] = [...tarihSirasiKontrolleri(g)];

  // Doğrudan Temin Tebliği m.4/9: bildirim kapanışı engellemez; işaretlenmediyse son gün hatırlatılır.
  const kik = g.evraklar["kik-bildirimi"];
  if (kik?.tamam) {
    uyarilar.push({ durum: "tamam", baslik: "KİK bildirimi yapıldı", detay: kik.tarih ? `Bildirim tarihi ${gunYaz(kik.tarih.slice(0, 10))}.` : "Bildirim işaretlendi." });
  } else {
    const sonGun = kikSonGunu(g.alim, g.evraklar);
    const sonGunYazi = /^\d{4}-\d{2}-\d{2}$/.test(sonGun) ? gunYaz(sonGun) : sonGun;
    if (g.bugun > sonGun) {
      uyarilar.push({ durum: "uyari", baslik: "KİK bildirimi gecikti", detay: `Son gün ${sonGunYazi} idi; bildirim hâlâ işaretlenmedi (Doğrudan Temin Tebliği m.4/9).` });
    } else {
      uyarilar.push({ durum: "yapilacak", baslik: `KİK bildirimi ${sonGunYazi} tarihine kadar yapılmalı`, detay: "Alımın yapıldığı ayı izleyen ayın 10'una kadar (Doğrudan Temin Tebliği m.4/9)." });
    }
  }

  const dizinIcin = (kod: string, ad: string, sistem: string, belge: string) => {
    const k = g.evraklar[kod];
    if (bos(k?.not) || !k?.tarih) {
      uyarilar.push({ durum: "yapilacak", baslik: `${ad} sayı ve tarihi girilmedi`, detay: `${sistem}'de düzenlenen ${belge} sayı ve tarihini dizin için girebilirsiniz.` });
    }
  };
  dizinIcin("tasinir-fisi", "Taşınır işlem fişi", "TKYS", "taşınır işlem fişinin");
  dizinIcin("odeme-emri", "Ödeme emri belgesi", "MYS", "ödeme emri belgesinin");

  return { engeller, uyarilar, hazir: engeller.length === 0 };
}

export interface DizinSatiri {
  sira: number;
  ad: string;
  // YYYY-AA-GG
  tarih: string | null;
  sayi: string | null;
  not: string;
}

// Dosyadaki bütün evrakı düzenlenme sırasıyla listeler: 1–11. basamak evrakları, ardından TKYS/MYS belgeleri ve KİK bildirimi.
// Dış sistem belgelerinin sayı ve tarihi isteğe bağlı elle girilir; girilmemişse "TKYS'de düzenlenir"/"MYS'de düzenlenir" yazılır.
export function dizinSatirlari(g: BasamakGirdisi): DizinSatiri[] {
  const { alim, piyasa, dosya, evraklar } = g;
  const durumlar = new Map(evrakDurumlari(alim, evraklar, piyasa).map((d) => [d.kod, d]));
  const gun = (t: string | undefined | null) => (t ? t.slice(0, 10) : null);
  const metin = (t: string | undefined | null) => (bos(t) ? null : t!.trim());
  const satirlar: Omit<DizinSatiri, "sira">[] = [];

  // Evrak kaydından satır; `tamam` bilinmiyorsa kaydın kendi işareti kullanılır.
  const evrakSatiri = (kod: string, ad: string, tamamMi?: boolean, dis?: "TKYS" | "MYS") => {
    const k = evraklar[kod];
    const tamam = tamamMi ?? !!k?.tamam;
    const not = tamam ? (dis ? `${dis}'de düzenlendi` : "Tamam") : dis ? `${dis}'de düzenlenir` : "Eksik";
    satirlar.push({ ad, tarih: k?.tamam ? gun(k.tarih) : null, sayi: k?.tamam ? metin(k.not) : null, not });
  };

  evrakSatiri("ihtiyac-yazisi", "İhtiyaç talep yazısı", durumlar.get("ihtiyac-yazisi")?.tamam);

  // Fiyat isteme yazısı dosya kaydında tutulur (3. basamak).
  const fi = dosya.fiyatIsteme;
  satirlar.push({ ad: "Fiyat isteme yazısı", tarih: gun(fi.tarih), sayi: metin(fi.sayi), not: fi.tarih ? "Tamam" : "Eksik" });

  const yok = dosya.yaklasik.hesaplanmayacak;
  satirlar.push({
    ad: "Yaklaşık maliyet cetveli",
    tarih: null,
    sayi: null,
    not: yok ? "Gerekmiyor · Tebliğ m.4/4" : dosya.yaklasik.onaylandi ? "Tamam" : "Eksik",
  });

  evrakSatiri("onay-belgesi", "Doğrudan temin onay belgesi", durumlar.get("onay-belgesi")?.tamam);
  evrakSatiri("fiyat-teklifi", "Teklif mektupları", !!piyasa?.teklifler.some((t) => t.belgeAlindi) || !!evraklar["fiyat-teklifi"]?.tamam);
  evrakSatiri("piyasa-tutanagi", "Piyasa fiyat araştırma tutanağı", durumlar.get("piyasa-tutanagi")?.tamam);

  // Yasaklılık sorgusu: tarih, seçilen firmaların sorgu tarihlerinin en geç olanıdır.
  const kazananlar = (piyasa && degerlendir(piyasa)?.kazananlar) || [];
  const sorgular = kazananlar
    .map((id) => piyasa!.teklifler.find((t) => t.tedarikciId === id)?.yasaklilikSorgusu)
    .filter((t): t is string => !!t)
    .map((t) => t.slice(0, 10));
  const yasakTamam = !!durumlar.get("yasaklilik")?.tamam;
  satirlar.push({
    ad: "Yasaklılık sorgusu çıktıları",
    tarih: yasakTamam && sorgular.length ? sorgular.reduce((a, b) => (b > a ? b : a)) : null,
    sayi: null,
    not: yasakTamam ? "Tamam" : "Eksik",
  });

  evrakSatiri("siparis-yazisi", sozlesmeZorunlu(alim) ? "Sözleşme" : "Sipariş yazısı veya sözleşme", durumlar.get("siparis-yazisi")?.tamam);
  evrakSatiri("muayene-talebi", "Muayene talep yazısı");
  evrakSatiri("fatura", "Fatura", durumlar.get("fatura")?.tamam);
  evrakSatiri("muayene-raporu", "Muayene raporu");
  evrakSatiri("muayene-tutanagi", "Muayene ve kabul tutanağı", durumlar.get("muayene-tutanagi")?.tamam);
  evrakSatiri("tasinir-fisi", "Taşınır işlem fişi", durumlar.get("tasinir-fisi")?.tamam, "TKYS");
  evrakSatiri("odeme-emri", "Ödeme emri belgesi", durumlar.get("odeme-emri")?.tamam, "MYS");
  evrakSatiri("kik-bildirimi", "KİK bildirimi", durumlar.get("kik-bildirimi")?.tamam);

  return satirlar.map((s, i) => ({ sira: i + 1, ...s }));
}
