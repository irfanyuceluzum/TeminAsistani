import { degerlendir, yasaklilikEksikleri, type PiyasaArastirmasi } from "./piyasa";
import { bentBilgisi, sozlesmeZorunlu } from "./sihirbaz";
import type { Alim, Asama, Bent } from "./tipler";

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
}

export interface EvrakDurumu extends EvrakTanimi {
  tamam: boolean;
  not: string;
  tarih: string | null;
}

// 22/d dışındaki bentlerde piyasa araştırması yerine dayanak belgesi ve tek teklif vardır.
export function asamaSirasi(bent: Bent): Asama[] {
  const ortak: Asama[] = ["ihtiyac", "dayanak", "onay"];
  return bent === "22/d"
    ? [...ortak, "piyasa", "siparis", "muayene", "odeme", "tamamlandi"]
    : [...ortak, "siparis", "muayene", "odeme", "tamamlandi"];
}

// Süreç çizelgesinin aşama tarihleri; basamaklı dosyanın evrak tarihlerinden türetilir (YYYY-AA-GG).
export function asamaTarihleri(alim: Alim, evraklar: Record<string, EvrakKaydi>): Partial<Record<Asama, string>> {
  const gun = (kod: string): string | undefined => {
    const t = evraklar[kod]?.tarih;
    return t ? t.slice(0, 10) : undefined;
  };
  const sira = asamaSirasi(alim.bent);
  const aday: Partial<Record<Asama, string | undefined>> = {
    ihtiyac: gun("ihtiyac-yazisi") ?? alim.onayTarihi,
    dayanak: alim.onayTarihi,
    onay: gun("onay-belgesi"),
    piyasa: gun("piyasa-tutanagi"),
    siparis: gun("siparis-yazisi"),
    muayene: gun("muayene-tutanagi"),
    odeme: gun("odeme-emri"),
  };
  if (alim.asama === "tamamlandi") {
    const kapanis = [gun("odeme-emri"), gun("kik-bildirimi")].filter((t): t is string => !!t);
    if (kapanis.length) aday.tamamlandi = kapanis.reduce((a, b) => (b > a ? b : a));
  }
  const sonuc: Partial<Record<Asama, string>> = {};
  for (const a of sira) {
    const t = aday[a];
    if (t) sonuc[a] = t;
  }
  return sonuc;
}

export function evrakListesi(alim: Alim): EvrakTanimi[] {
  const e = (kod: string, ad: string, asama: Asama, sistemden = false): EvrakTanimi => ({ kod, ad, asama, sistemden });
  const liste: EvrakTanimi[] = [
    e("ihtiyac-yazisi", "İhtiyaç talep yazısı", "ihtiyac"),
    e("onay-belgesi", "Doğrudan temin onay belgesi, imzalı", "onay"),
    // Doğrudan Temin Tebliği m.5/1: alım EKAP'a kaydedilir; numara dosya bilgilerinden girilir.
    e("ekap-kaydi", "EKAP doğrudan temin kaydı", "onay", true),
  ];
  if (alim.bent === "22/d") {
    liste.push(e("piyasa-tutanagi", "Piyasa fiyat araştırması tutanağı ve teklifler", "piyasa", true));
    liste.push(e("yasaklilik", "Yasaklılık sorgusu çıktıları", "piyasa", true));
  } else {
    liste.push(e("dayanak-belgesi", bentBilgisi(alim.bent).belgeler[0], "onay"));
    liste.push(e("fiyat-teklifi", "Firmadan fiyat teklifi", "onay"));
  }
  liste.push(
    e("siparis-yazisi", sozlesmeZorunlu(alim) ? "Sözleşme" : "Sipariş yazısı veya sözleşme", "siparis"),
    e("fatura", "Fatura", "muayene"),
    e("muayene-tutanagi", "Muayene ve kabul tutanağı", "muayene"),
    e("borc-sorgusu", "Vergi ve SGK borç sorgusu", "odeme"),
    e("odeme-emri", "Ödeme emri belgesi", "odeme"),
  );
  // Doğrudan Temin Tebliği m.4/9: bildirim bentten bağımsızdır.
  liste.push(e("kik-bildirimi", "KİK bildirimi", "odeme"));
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

// Dosya "tamamlandı" yapılmadan önce eksiksiz olması gereken evraklar; eksiklerin adlarını döndürür.
export function kapanisEksikleri(alim: Alim, kayitlar: Record<string, EvrakKaydi>, piyasa: PiyasaArastirmasi | null): string[] {
  return evrakDurumlari(alim, kayitlar, piyasa)
    .filter((e) => !e.tamam)
    .map((e) => e.ad);
}

export interface IlerlemeDurumu {
  sonraki: Asama | null;
  eksikler: string[];
  // Bu aşamalar elle ilerletilmez, kendi ekranlarında tamamlanır.
  ekran: "piyasa" | "muayene" | "odeme" | null;
}

export function asamaIlerlemesi(alim: Alim, evraklar: EvrakDurumu[]): IlerlemeDurumu {
  const sira = asamaSirasi(alim.bent);
  const i = sira.indexOf(alim.asama);
  if (alim.asama === "iptal" || i === -1 || i === sira.length - 1) return { sonraki: null, eksikler: [], ekran: null };
  const sonraki = sira[i + 1];
  if (sonraki === "piyasa" || alim.asama === "piyasa") return { sonraki, eksikler: [], ekran: "piyasa" };
  if (alim.asama === "muayene") return { sonraki, eksikler: [], ekran: "muayene" };
  // Bu aşamaya ve öncesine ait evraklar tamamlanmadan ileri gidilmez.
  const eksikler = evraklar.filter((e) => !e.tamam && sira.indexOf(e.asama) <= i).map((e) => e.ad);
  // Ödeme ekranında tamamlanmamış ödemede kapatma, yalnızca kalan evraklar (KİK bildirimi gibi) için elle yapılır.
  if (alim.asama === "odeme" && eksikler.some((e) => e === "Vergi ve SGK borç sorgusu" || e === "Ödeme emri belgesi")) {
    return { sonraki, eksikler: [], ekran: "odeme" };
  }
  return { sonraki, eksikler, ekran: null };
}
