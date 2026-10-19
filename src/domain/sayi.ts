// Türkçe ve İngilizce yazımlı sayıyı okur: "1.250,5", "1,250.5", "12,5", "2.5", "38500".
// Yalnız sayı kabul eder (işaret ve birim yok); okunamazsa null.

export function turkceSayi(metin: string): number | null {
  const m = metin.trim();
  if (!/^[\d.,]+$/.test(m)) return null;
  let duz: string;
  const nokta = m.indexOf(".") >= 0;
  const virgul = m.indexOf(",") >= 0;
  if (nokta && virgul) {
    // Sondaki ayırıcı ondalıktır, diğeri binliktir.
    const ondalikAyirici = m.lastIndexOf(".") > m.lastIndexOf(",") ? "." : ",";
    const binlikAyirici = ondalikAyirici === "." ? "," : ".";
    const son = m.lastIndexOf(ondalikAyirici);
    const tam = m.slice(0, son);
    const kesir = m.slice(son + 1);
    const binlikDeseni = binlikAyirici === "." ? /^\d{1,3}(\.\d{3})+$/ : /^\d{1,3}(,\d{3})+$/;
    if (!binlikDeseni.test(tam) || !/^\d+$/.test(kesir)) return null;
    duz = `${tam.split(binlikAyirici).join("")}.${kesir}`;
  } else if (virgul) {
    if (!/^\d+,\d+$/.test(m)) return null;
    duz = m.replace(",", ".");
  } else if (nokta) {
    if (/^\d{1,3}(\.\d{3})+$/.test(m)) duz = m.split(".").join("");
    else if (/^\d+\.\d+$/.test(m)) duz = m;
    else return null;
  } else {
    duz = m;
  }
  const sayi = Number(duz);
  return Number.isFinite(sayi) ? sayi : null;
}
