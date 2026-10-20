import { degerlendir, yasaklilikEksikleri, type PiyasaArastirmasi } from "./piyasa";
import { sozlesmeZorunlu } from "./sihirbaz";
import type { Alim, Asama } from "./tipler";

export interface Olay {
  id?: number;
  alimId: string;
  // ISO tarih-saat
  zaman: string;
  kim: string;
  tur: string;
  aciklama: string;
}

export interface EvrakKaydi {
  tamam: boolean;
  tarih: string;
  not: string;
}

export interface EvrakTanimi {
  kod: string;
  ad: string;
  asama: Asama;
  // Sistemden gelen evrak elle işaretlenmez; durumu kayıtlardan çıkarılır.
  sistemden: boolean;
  // Kapanış için gerekli mi; değilse eksikliği dosyanın kapanmasını engellemez.
  zorunlu: boolean;
  // Evrak bu uygulamada değil, başka bir sistemde düzenlenir (EKAP kaydındaki `sistemden` anlamından ayrıdır).
  // Dış sistem evrakının yalnız sayı/tarihi dizin için isteğe bağlı elle girilir.
  disSistem?: "TKYS" | "MYS" | "EKAP";
}

export interface EvrakDurumu extends EvrakTanimi {
  tamam: boolean;
  not: string;
  tarih: string | null;
}

// Uygulama yalnız 22/d içindir; aşama sırası tektir.
export function asamaSirasi(): Asama[] {
  return ["ihtiyac", "dayanak", "onay", "piyasa", "siparis", "muayene", "odeme", "tamamlandi"];
}

// Süreç çizelgesinin aşama tarihleri; basamaklı dosyanın evrak tarihlerinden türetilir (YYYY-AA-GG).
export function asamaTarihleri(alim: Alim, evraklar: Record<string, EvrakKaydi>): Partial<Record<Asama, string>> {
  const gun = (kod: string): string | undefined => {
    const t = evraklar[kod]?.tarih;
    return t ? t.slice(0, 10) : undefined;
  };
  const sira = asamaSirasi();
  const aday: Partial<Record<Asama, string | undefined>> = {
    ihtiyac: gun("ihtiyac-yazisi") ?? alim.onayTarihi,
    dayanak: alim.onayTarihi,
    onay: gun("onay-belgesi"),
    piyasa: gun("piyasa-tutanagi"),
    siparis: gun("siparis-yazisi"),
    muayene: gun("muayene-tutanagi"),
    // Ödeme emri MYS'de düzenlenir ve tarihi isteğe bağlıdır; girilmemişse ödeme aşaması muayene tutanağı günüyle başlamış sayılır.
    odeme: gun("odeme-emri") ?? gun("muayene-tutanagi"),
  };
  if (alim.asama === "tamamlandi") {
    // Kapanış günü, kontrol ekranında "Dosyayı kapat" ile yazılan `dosya-kapanisi` evrakının tarihidir.
    // Bu kayıt yoksa (eski dosyalar) ödeme emri ve KİK bildirimi tarihlerinin en geç olanı alınır.
    const kapanis = [gun("odeme-emri"), gun("kik-bildirimi")].filter((t): t is string => !!t);
    aday.tamamlandi = gun("dosya-kapanisi") ?? (kapanis.length ? kapanis.reduce((a, b) => (b > a ? b : a)) : undefined);
  }
  const sonuc: Partial<Record<Asama, string>> = {};
  for (const a of sira) {
    const t = aday[a];
    if (t) sonuc[a] = t;
  }
  return sonuc;
}

export function evrakListesi(alim: Alim): EvrakTanimi[] {
  const e = (kod: string, ad: string, asama: Asama, sistemden = false, zorunlu = true, disSistem?: EvrakTanimi["disSistem"]): EvrakTanimi => ({
    kod,
    ad,
    asama,
    sistemden,
    zorunlu,
    ...(disSistem ? { disSistem } : {}),
  });
  const liste: EvrakTanimi[] = [
    e("ihtiyac-yazisi", "İhtiyaç talep yazısı", "ihtiyac"),
    e("onay-belgesi", "Doğrudan temin onay belgesi, imzalı", "onay"),
    // Doğrudan Temin Tebliği m.5/1: alım EKAP'a kaydedilir; numara dosya bilgilerinden girilir.
    e("ekap-kaydi", "EKAP doğrudan temin kaydı", "onay", true),
  ];
  liste.push(
    e("piyasa-tutanagi", "Piyasa fiyat araştırması tutanağı ve teklifler", "piyasa", true),
    e("yasaklilik", "Yasaklılık sorgusu çıktıları", "piyasa", true),
    e("siparis-yazisi", sozlesmeZorunlu(alim) ? "Sözleşme" : "Sipariş yazısı veya sözleşme", "siparis"),
    e("fatura", "Fatura", "muayene"),
    e("muayene-tutanagi", "Muayene ve kabul tutanağı", "muayene"),
    // Taşınır işlem fişi TKYS'de, ödeme emri MYS'de düzenlenir; burada yalnız dizin için kaydı tutulur, zorunlu değildir.
    e("tasinir-fisi", "Taşınır işlem fişi", "odeme", false, false, "TKYS"),
    e("odeme-emri", "Ödeme emri belgesi", "odeme", false, false, "MYS"),
  );
  // Doğrudan Temin Tebliği m.4/9: bildirim bentten bağımsızdır; süresi geçse de kapanışı engellemez (uyarı olarak gösterilir).
  liste.push(e("kik-bildirimi", "KİK bildirimi", "odeme", false, false));
  return liste;
}

export function evrakDurumlari(alim: Alim, kayitlar: Record<string, EvrakKaydi>, piyasa: PiyasaArastirmasi | null): EvrakDurumu[] {
  return evrakListesi(alim).map((t) => {
    if (t.kod === "ekap-kaydi") {
      const no = alim.ekapKayitNo?.trim();
      return { ...t, tamam: !!no, not: no ? `No ${no}` : "Kayıt numarası dosya bilgilerinden girilir", tarih: null };
    }
    if (t.kod === "yasaklilik") {
      // Tutanağın onaylanmış olması yetmez: seçilen her firmanın sorgu tarihi girilmiş olmalı.
      const kazananVar = !!piyasa && (degerlendir(piyasa)?.kazananlar.length ?? 0) > 0;
      const eksik = piyasa ? yasaklilikEksikleri(piyasa) : [];
      const tamam = kazananVar && eksik.length === 0;
      return { ...t, tamam, not: tamam ? "Seçilen firmaların sorgu tarihi girildi" : "7. basamakta seçilen firmanın EKAP sorgu tarihini girin", tarih: null };
    }
    if (t.sistemden) {
      const tamam = piyasa?.tamamlandi ?? false;
      return { ...t, tamam, not: tamam ? "Piyasa araştırması ekranından" : "Piyasa araştırması tamamlanınca gelir", tarih: null };
    }
    const k = kayitlar[t.kod];
    return { ...t, tamam: k?.tamam ?? false, not: k?.not ?? "", tarih: k?.tarih ?? null };
  });
}

// Dosya "tamamlandı" yapılmadan önce eksiksiz olması gereken (zorunlu) evraklar; eksiklerin adlarını döndürür.
export function kapanisEksikleri(alim: Alim, kayitlar: Record<string, EvrakKaydi>, piyasa: PiyasaArastirmasi | null): string[] {
  return evrakDurumlari(alim, kayitlar, piyasa)
    .filter((e) => e.zorunlu && !e.tamam)
    .map((e) => e.ad);
}

export interface IlerlemeDurumu {
  sonraki: Asama | null;
  eksikler: string[];
  // Bu aşamalar elle ilerletilmez, kendi ekranlarında tamamlanır.
  ekran: "piyasa" | "muayene" | "kontrol" | null;
}

export function asamaIlerlemesi(alim: Alim, evraklar: EvrakDurumu[]): IlerlemeDurumu {
  const sira = asamaSirasi();
  const i = sira.indexOf(alim.asama);
  if (alim.asama === "iptal" || i === -1 || i === sira.length - 1) return { sonraki: null, eksikler: [], ekran: null };
  const sonraki = sira[i + 1];
  if (sonraki === "piyasa" || alim.asama === "piyasa") return { sonraki, eksikler: [], ekran: "piyasa" };
  if (alim.asama === "muayene") return { sonraki, eksikler: [], ekran: "muayene" };
  // Bu aşamaya ve öncesine ait zorunlu evraklar tamamlanmadan ileri gidilmez.
  const eksikler = evraklar.filter((e) => e.zorunlu && !e.tamam && sira.indexOf(e.asama) <= i).map((e) => e.ad);
  // "odeme" aşaması ödemenin MYS'de yapıldığı aşamadır; tamamlandıya geçiş kontrol ekranında (12. basamak) yapılır.
  if (alim.asama === "odeme") return { sonraki, eksikler, ekran: "kontrol" };
  return { sonraki, eksikler, ekran: null };
}
