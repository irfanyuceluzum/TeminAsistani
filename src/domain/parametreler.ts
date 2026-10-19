import type { Ayarlar, LimitDonemi } from "./tipler";

function gunEkle(tarih: string, gun: number): string {
  const d = new Date(tarih + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + gun);
  return d.toISOString().slice(0, 10);
}

function yilEkle(tarih: string, yil: number): string {
  return String(Number(tarih.slice(0, 4)) + yil) + tarih.slice(4);
}

// Son dönemin ertesi gününden başlayan bir yıllık dönem; hiç dönem yoksa içinde bulunulan dönem.
export function onerilenDonem(mevcut: LimitDonemi[], bugun: string): { baslangic: string; bitis: string } {
  const sirali = [...mevcut].sort((a, b) => a.bitis.localeCompare(b.bitis));
  const son = sirali[sirali.length - 1];
  let baslangic: string;
  if (son) {
    baslangic = gunEkle(son.bitis, 1);
  } else {
    const yil = Number(bugun.slice(0, 4));
    baslangic = bugun.slice(5) >= "02-01" ? `${yil}-02-01` : `${yil - 1}-02-01`;
  }
  return { baslangic, bitis: gunEkle(yilEkle(baslangic, 1), -1) };
}

export function limitDonemiHatalari(yeni: LimitDonemi, mevcut: LimitDonemi[]): string[] {
  const h: string[] = [];
  const tarihGecerli = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(Date.parse(t));
  if (!tarihGecerli(yeni.baslangic) || !tarihGecerli(yeni.bitis)) {
    h.push("Başlangıç ve bitiş tarihlerini girin.");
  } else if (yeni.baslangic > yeni.bitis) {
    h.push("Bitiş tarihi başlangıçtan önce olamaz.");
  } else {
    const cakisan = mevcut.find((d) => yeni.baslangic <= d.bitis && d.baslangic <= yeni.bitis);
    if (cakisan) h.push(`Bu tarihler ${cakisan.baslangic} – ${cakisan.bitis} dönemiyle çakışıyor.`);
  }
  if (!(yeni.buyuksehir > 0) || !(yeni.diger > 0)) h.push("İki limiti de sıfırdan büyük girin.");
  if (!yeni.dayanak.trim()) h.push("Dayanak tebliği yazın.");
  return h;
}

// Bütçe tertibi: "kurumsal · fonksiyonel · finansman · ekonomik"; boş parçalar atlanır, hiçbiri yoksa "—".
export function butceTertibi(ayarlar: Ayarlar, ekonomikKod: string): string {
  const b = ayarlar.butce;
  const parcalar = [b?.kurumsal, b?.fonksiyonel, b?.finansman, ekonomikKod].map((p) => (p ?? "").trim()).filter((p) => p !== "");
  return parcalar.length > 0 ? parcalar.join(" · ") : "—";
}

export function ayarHatalari(a: Ayarlar): string[] {
  const h: string[] = [];
  const p = a.bolme.pencereGun;
  if (!Number.isInteger(p) || p < 1 || p > 366) h.push("Bölme kontrolünün süresi 1 ile 366 gün arasında olmalı.");
  if (!a.bolme.ayniKalem && !a.bolme.ayniEkonomikKod && !a.bolme.ayniTedarikci) h.push("Bölme kontrolü için en az bir benzerlik ölçütü seçin.");
  const oranlar: [string, number][] = [
    ["Makbuz", a.damga.makbuzOrani],
    ["Sözleşme", a.damga.sozlesmeOrani],
    ["Karar pulu", a.damga.kararOrani],
  ];
  for (const [ad, oran] of oranlar) {
    if (!Number.isInteger(oran) || oran < 0 || oran > 100_000) h.push(`${ad} oranı binde 0 ile 1.000 arasında olmalı.`);
  }
  for (const [yil, odenek] of Object.entries(a.odenekler)) {
    if (!Number.isInteger(odenek) || odenek < 0) h.push(`${yil} ödeneği geçerli bir tutar olmalı.`);
  }
  const butce: [string, string | undefined, RegExp, string][] = [
    ["Kurumsal kod", a.butce?.kurumsal, /^\d{2}(\.\d{2}){3}$/, "18.01.31.00"],
    ["Fonksiyonel kod", a.butce?.fonksiyonel, /^\d{2}(\.\d){2}\.\d{2}$/, "09.1.2.00"],
    ["Finansman tipi", a.butce?.finansman, /^\d$/, "1"],
  ];
  for (const [ad, deger, desen, ornek] of butce) {
    if (deger && deger.trim() !== "" && !desen.test(deger.trim())) h.push(`${ad} ${ornek} biçiminde yazılmalı.`);
  }
  return h;
}
