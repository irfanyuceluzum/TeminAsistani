import type { PiyasaArastirmasi } from "./piyasa";
import { bentBilgisi } from "./sihirbaz";
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

export function evrakListesi(alim: Alim): EvrakTanimi[] {
  const e = (kod: string, ad: string, asama: Asama, sistemden = false): EvrakTanimi => ({ kod, ad, asama, sistemden });
  const liste: EvrakTanimi[] = [e("ihtiyac-yazisi", "İhtiyaç talep yazısı", "ihtiyac"), e("onay-belgesi", "Doğrudan temin onay belgesi, imzalı", "onay")];
  if (alim.bent === "22/d") {
    liste.push(e("piyasa-tutanagi", "Piyasa fiyat araştırması tutanağı ve teklifler", "piyasa", true));
    liste.push(e("yasaklilik", "Yasaklılık sorgusu çıktıları", "piyasa", true));
  } else {
    liste.push(e("dayanak-belgesi", bentBilgisi(alim.bent).belgeler[0], "onay"));
    liste.push(e("fiyat-teklifi", "Firmadan fiyat teklifi", "onay"));
  }
  liste.push(
    e("siparis-yazisi", "Sipariş yazısı veya sözleşme", "siparis"),
    e("fatura", "Fatura", "muayene"),
    e("muayene-tutanagi", "Muayene ve kabul tutanağı", "muayene"),
    e("borc-sorgusu", "Vergi ve SGK borç sorgusu", "odeme"),
    e("odeme-emri", "Ödeme emri belgesi", "odeme"),
  );
  if (bentBilgisi(alim.bent).kikBildirimi) liste.push(e("kik-bildirimi", "KİK bildirimi", "odeme"));
  return liste;
}

export function evrakDurumlari(alim: Alim, kayitlar: Record<string, EvrakKaydi>, piyasa: PiyasaArastirmasi | null): EvrakDurumu[] {
  return evrakListesi(alim).map((t) => {
    if (t.sistemden) {
      const tamamlandi = piyasa?.tamamlandi ?? false;
      const sorgulu = tamamlandi && piyasa!.teklifler.length > 0;
      const tamam = t.kod === "piyasa-tutanagi" ? tamamlandi : sorgulu;
      return { ...t, tamam, not: tamam ? "Piyasa araştırması ekranından" : "Piyasa araştırması tamamlanınca gelir", tarih: null };
    }
    const k = kayitlar[t.kod];
    return { ...t, tamam: k?.tamam ?? false, not: k?.not ?? "", tarih: k?.tarih ?? null };
  });
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
