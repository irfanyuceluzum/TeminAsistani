// Excel/LibreOffice yapıştırması ya da CSV dosyasından ihtiyaç listesi kalemi çıkarır.
// Saf işlevler; kalem kimliği üretmez (arayüz yeniKalem() ile verir).

export interface AktarilanKalem {
  ad: string;
  ozellik: string;
  miktar: number;
  birim: string;
}

export interface AktarimSonucu {
  kalemler: AktarilanKalem[];
  uyarilar: string[];
  basliktan: boolean;
}

const EN_FAZLA_KALEM = 500;

interface KaynakSatir {
  hucreler: string[];
  satir: number; // kaynak metindeki 1 tabanlı satır numarası (kaydın başladığı satır)
}

function ayiriciBul(metin: string): string | null {
  if (metin.indexOf("\t") >= 0) return "\t";
  const ilk = metin.split("\n").find((s) => s.trim() !== "");
  if (ilk === undefined) return null;
  let noktaliVirgul = 0;
  let virgul = 0;
  for (const c of ilk) {
    if (c === ";") noktaliVirgul++;
    else if (c === ",") virgul++;
  }
  if (noktaliVirgul > 0 && noktaliVirgul >= virgul) return ";";
  if (virgul > 0) return ",";
  return null;
}

function satirliAyir(metin: string): KaynakSatir[] {
  const temiz = metin.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const ayirici = ayiriciBul(temiz);
  const sonuc: KaynakSatir[] = [];

  let hucre = "";
  let satir: string[] = [];
  let tirnakta = false;
  let satirNo = 1;
  let kayitSatiri = 1;

  const hucreyiBitir = () => {
    satir.push(hucre.trim());
    hucre = "";
  };
  const satiriBitir = () => {
    hucreyiBitir();
    if (satir.some((h) => h !== "")) sonuc.push({ hucreler: satir, satir: kayitSatiri });
    satir = [];
  };

  for (let i = 0; i < temiz.length; i++) {
    const c = temiz[i];
    if (tirnakta) {
      if (c === '"') {
        if (temiz[i + 1] === '"') {
          hucre += '"';
          i++;
        } else {
          tirnakta = false;
        }
      } else {
        if (c === "\n") satirNo++;
        hucre += c;
      }
      continue;
    }
    if (c === '"' && hucre.trim() === "") {
      tirnakta = true;
      hucre = "";
    } else if (ayirici !== null && c === ayirici) {
      hucreyiBitir();
    } else if (c === "\n") {
      satiriBitir();
      satirNo++;
      kayitSatiri = satirNo;
    } else {
      hucre += c;
    }
  }
  if (hucre !== "" || satir.length > 0) satiriBitir();
  return sonuc;
}

// Metni satır ve hücrelere ayırır; ayırıcıyı kendisi seçer.
export function tabloyuAyir(metin: string): string[][] {
  return satirliAyir(metin).map((s) => s.hucreler);
}

// "1.250,5", "12,5", "2.5", "10 adet", "2,5 kg" gibi hücreleri okur.
export function miktarOku(metin: string): { miktar: number | null; birim: string | null } {
  const bos = { miktar: null, birim: null };
  const m = /^([+-]?\d[\d.,]*)\s*(.*)$/s.exec(metin.trim());
  if (!m) return bos;
  const sayiMetni = m[1].replace(/[.,]+$/, "");
  const nokta = sayiMetni.indexOf(".") >= 0;
  const virgul = sayiMetni.indexOf(",") >= 0;
  let duz: string;
  if (nokta && virgul) {
    const ondalik = Math.max(sayiMetni.lastIndexOf("."), sayiMetni.lastIndexOf(","));
    const tam = sayiMetni.slice(0, ondalik).replace(/[.,]/g, "");
    duz = `${tam}.${sayiMetni.slice(ondalik + 1).replace(/[.,]/g, "")}`;
  } else if (virgul) {
    const parcalar = sayiMetni.split(",");
    duz = parcalar.length > 2 ? parcalar.join("") : sayiMetni.replace(",", ".");
  } else if (nokta) {
    if (/^[+-]?\d{1,3}(\.\d{3})+$/.test(sayiMetni)) duz = sayiMetni.replace(/\./g, "");
    else if (sayiMetni.split(".").length > 2) return bos;
    else duz = sayiMetni;
  } else {
    duz = sayiMetni;
  }
  const sayi = Number(duz);
  if (!Number.isFinite(sayi) || sayi <= 0) return bos;
  const birimEslesmesi = /^[\p{L}][\p{L}\p{N}./²³]*/u.exec(m[2]);
  return { miktar: sayi, birim: birimEslesmesi ? birimEslesmesi[0] : null };
}

function sadelestir(s: string): string {
  return s
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u")
    .replace(/â/g, "a")
    .replace(/î/g, "i")
    .replace(/û/g, "u");
}

function bosluklariTekle(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

type Rol = "yok" | "sira" | "miktar" | "birim" | "ozellik" | "ad";

function basligiSinifla(baslik: string): Rol | null {
  const norm = sadelestir(baslik).replace(/[^a-z0-9]+/g, " ").trim();
  if (norm === "") return null;
  const kelimeler = norm.split(" ");
  if (/fiyat|tutar|bedel|kdv/.test(norm)) return "yok";
  if (kelimeler.indexOf("sira") >= 0 || kelimeler.indexOf("no") >= 0 || norm === "sn") return "sira";
  if (
    norm.indexOf("miktar") >= 0 ||
    norm.indexOf("adet sayisi") >= 0 ||
    kelimeler.indexOf("sayi") >= 0 ||
    norm === "adet"
  )
    return "miktar";
  if (norm.indexOf("birim") >= 0) return "birim";
  // Ad anahtar sözcüğü özellik sözcüğüyle birlikte geçerse ad sayılır ("Malzeme Adı ve Özellikleri")
  const adOncelikli = kelimeler.some(
    (k) => k === "adi" || k === "cins" || k === "cinsi" || /^(malzeme|hizmet|kalem|urun)/.test(k),
  );
  if (!adOncelikli && /ozellik|teknik|aciklama|sartname|nitelik/.test(norm)) return "ozellik";
  const adKelimeleri = ["ad", "adi", "is", "cins", "cinsi"];
  if (
    kelimeler.some(
      (k) => adKelimeleri.indexOf(k) >= 0 || /^(malzeme|hizmet|kalem|urun)/.test(k),
    )
  )
    return "ad";
  return null;
}

interface Sutunlar {
  ad: number;
  ozellik: number;
  miktar: number;
  birim: number;
}

function basliktanSutunlar(baslik: string[]): Sutunlar | null {
  const s: Sutunlar = { ad: -1, ozellik: -1, miktar: -1, birim: -1 };
  baslik.forEach((h, i) => {
    const rol = basligiSinifla(h);
    if (rol === null || rol === "yok" || rol === "sira") return;
    if (s[rol] < 0) s[rol] = i;
  });
  return s.ad >= 0 ? s : null;
}

function sayisalMi(deger: string): boolean {
  return miktarOku(deger).miktar !== null;
}

function sutunTahmin(satirlar: string[][]): Sutunlar {
  const sutunSayisi = satirlar.reduce((en, s) => Math.max(en, s.length), 0);
  const hucre = (s: string[], i: number) => (i < s.length ? s[i] : "");
  const tumSutunlar: number[] = [];
  for (let i = 0; i < sutunSayisi; i++) tumSutunlar.push(i);

  const siraMi = (i: number) => {
    if (!satirlar.every((s, k) => hucre(s, i) === String(k + 1))) return false;
    if (satirlar.length >= 2) return true;
    return tumSutunlar.some((j) => j !== i && satirlar.every((s) => sayisalMi(hucre(s, j))));
  };
  let sira = -1;
  if (sutunSayisi >= 2) {
    const aday = tumSutunlar.find(siraMi);
    if (aday !== undefined) sira = aday;
  }
  const kalan = tumSutunlar.filter((i) => i !== sira);

  const sayisalSutun = (i: number) => {
    const sayisal = satirlar.filter((s) => sayisalMi(hucre(s, i))).length;
    return sayisal * 2 > satirlar.length;
  };

  const miktar = kalan.find(sayisalSutun);
  if (miktar === undefined) {
    return { ad: kalan[0] ?? 0, ozellik: kalan.length > 1 ? kalan[1] : -1, miktar: -1, birim: -1 };
  }
  let birim = -1;
  const sag = miktar + 1;
  if (sag < sutunSayisi && sag !== sira && !sayisalSutun(sag)) birim = sag;

  let metinSutunlari = kalan.filter((i) => i < miktar && !sayisalSutun(i));
  if (metinSutunlari.length === 0) {
    metinSutunlari = kalan.filter((i) => i !== miktar && i !== birim && !sayisalSutun(i));
  }
  return {
    ad: metinSutunlari.length > 0 ? metinSutunlari[0] : -1,
    ozellik: metinSutunlari.length > 1 ? metinSutunlari[1] : -1,
    miktar,
    birim,
  };
}

export function ihtiyacMetniniAyikla(metin: string): AktarimSonucu {
  const bosSonuc: AktarimSonucu = { kalemler: [], uyarilar: [], basliktan: false };
  if (metin.trim() === "") return bosSonuc;
  const satirlar = satirliAyir(metin);
  if (satirlar.length === 0) return bosSonuc;

  // Satırda sayı veren hücre varsa o satır veridir, başlık değildir
  const ilkSatirVeri = satirlar[0].hucreler.some(sayisalMi);
  let sutunlar = ilkSatirVeri ? null : basliktanSutunlar(satirlar[0].hucreler);
  const basliktan = sutunlar !== null;
  const veri = basliktan ? satirlar.slice(1) : satirlar;
  if (sutunlar === null) sutunlar = sutunTahmin(veri.map((s) => s.hucreler));

  const kalemler: AktarilanKalem[] = [];
  const uyarilar: string[] = [];
  const al = (hucreler: string[], i: number) =>
    i >= 0 && i < hucreler.length ? bosluklariTekle(hucreler[i]) : "";

  for (const { hucreler, satir } of veri) {
    const ad = al(hucreler, sutunlar.ad);
    if (ad === "") {
      uyarilar.push(`${satir}. satır: malzeme adı yok, atlandı.`);
      continue;
    }
    const adSade = sadelestir(ad);
    if (adSade === "toplam" || adSade === "genel toplam" || adSade === "ara toplam") {
      uyarilar.push(`${satir}. satır: toplam satırı atlandı.`);
      continue;
    }
    if (kalemler.length >= EN_FAZLA_KALEM) {
      uyarilar.push("500 kalemden fazlası alınmadı.");
      break;
    }

    let miktar = 1;
    let miktarBirimi: string | null = null;
    if (sutunlar.miktar >= 0) {
      const okunan = miktarOku(al(hucreler, sutunlar.miktar));
      if (okunan.miktar === null) {
        miktar = 0;
        uyarilar.push(`${satir}. satır: miktar okunamadı, 0 yazıldı.`);
      } else {
        miktar = okunan.miktar;
        miktarBirimi = okunan.birim;
      }
    }
    const birim = al(hucreler, sutunlar.birim) || miktarBirimi || "adet";
    kalemler.push({ ad, ozellik: al(hucreler, sutunlar.ozellik), miktar, birim });
  }
  return { kalemler, uyarilar, basliktan };
}

// CSV/metin dosyası baytlarını çözer: önce UTF-8, olmazsa Excel'in Türkçe Windows kodlaması.
export function metniCoz(bayt: Uint8Array): string {
  let metin: string;
  try {
    metin = new TextDecoder("utf-8", { fatal: true }).decode(bayt);
  } catch {
    metin = new TextDecoder("windows-1254").decode(bayt);
  }
  return metin.replace(/^﻿/, "");
}
