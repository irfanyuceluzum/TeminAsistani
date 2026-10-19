import { describe, expect, it } from "vitest";
import { ihtiyacMetniniAyikla, metniCoz, miktarOku, tabloyuAyir } from "./ihtiyacAktar";

describe("tabloyuAyir", () => {
  it("sekmeli metni ayırır, BOM ve sondaki boş satırları atar", () => {
    const t = tabloyuAyir("﻿A\tB\r\n1\t2\r\n\r\n  \r\n");
    expect(t).toEqual([
      ["A", "B"],
      ["1", "2"],
    ]);
  });

  it("noktalı virgülü seçer", () => {
    expect(tabloyuAyir("a;b;c\n1;2,5;3")).toEqual([
      ["a", "b", "c"],
      ["1", "2,5", "3"],
    ]);
  });

  it("virgüllü CSV'de tırnaklı virgül, çok satırlı hücre ve \"\" kaçışını çözer", () => {
    const t = tabloyuAyir('Ad,Miktar\n"Boya, beyaz",2\n"Satır1\nSatır2",3\n"5"" boru",4');
    expect(t).toEqual([
      ["Ad", "Miktar"],
      ["Boya, beyaz", "2"],
      ["Satır1\nSatır2", "3"],
      ['5" boru', "4"],
    ]);
  });

  it("sekmeli metinde de tırnaklı çok satırlı hücreyi tek hücre sayar", () => {
    expect(tabloyuAyir('"a\nb"\tc\nd\te')).toEqual([
      ["a\nb", "c"],
      ["d", "e"],
    ]);
  });

  it("ayırıcı yoksa tek sütun verir", () => {
    expect(tabloyuAyir("Kalem A\n\nKalem B")).toEqual([["Kalem A"], ["Kalem B"]]);
  });
});

describe("miktarOku", () => {
  it("Türkçe ve İngilizce sayı biçimlerini okur", () => {
    expect(miktarOku("1.250,5").miktar).toBe(1250.5);
    expect(miktarOku("1,250.5").miktar).toBe(1250.5);
    expect(miktarOku("12,5").miktar).toBe(12.5);
    expect(miktarOku("1.250").miktar).toBe(1250);
    expect(miktarOku("2.5").miktar).toBe(2.5);
    expect(miktarOku("7").miktar).toBe(7);
  });

  it("sayıdan sonraki kelimeyi birim sayar", () => {
    expect(miktarOku("10 adet")).toEqual({ miktar: 10, birim: "adet" });
    expect(miktarOku("2,5 kg")).toEqual({ miktar: 2.5, birim: "kg" });
    expect(miktarOku("3")).toEqual({ miktar: 3, birim: null });
  });

  it("sayı yoksa ya da sıfır/negatifse null verir", () => {
    expect(miktarOku("")).toEqual({ miktar: null, birim: null });
    expect(miktarOku("abc")).toEqual({ miktar: null, birim: null });
    expect(miktarOku("0").miktar).toBeNull();
    expect(miktarOku("-4").miktar).toBeNull();
  });
});

describe("ihtiyacMetniniAyikla", () => {
  it("sekmeli başlıklı yapıştırmayı okur, sıra ve fiyat sütunlarını yok sayar", () => {
    const metin = [
      "Sıra No\tMalzeme Adı\tTeknik Özellik\tMiktar\tBirim\tBirim Fiyat",
      "1\tA4 kağıt\t80 gr\t10\tpaket\t120,50",
      "2\tToner\tSiyah\t2\tadet\t900",
    ].join("\n");
    const s = ihtiyacMetniniAyikla(metin);
    expect(s.basliktan).toBe(true);
    expect(s.uyarilar).toEqual([]);
    expect(s.kalemler).toEqual([
      { ad: "A4 kağıt", ozellik: "80 gr", miktar: 10, birim: "paket" },
      { ad: "Toner", ozellik: "Siyah", miktar: 2, birim: "adet" },
    ]);
  });

  it("noktalı virgüllü CSV'yi okur", () => {
    const s = ihtiyacMetniniAyikla("Malzeme;Miktar;Birim\nKalem;2,5;kg");
    expect(s.basliktan).toBe(true);
    expect(s.kalemler).toEqual([{ ad: "Kalem", ozellik: "", miktar: 2.5, birim: "kg" }]);
  });

  it("virgüllü CSV'de tırnaklı virgülü ve çok satırlı hücreyi korur", () => {
    const s = ihtiyacMetniniAyikla('Ad,Açıklama,Miktar\n"Boya, beyaz","Satır1\nSatır2",3');
    expect(s.kalemler).toEqual([
      { ad: "Boya, beyaz", ozellik: "Satır1 Satır2", miktar: 3, birim: "adet" },
    ]);
  });

  it('"" kaçışını metne çevirir', () => {
    const s = ihtiyacMetniniAyikla('Ad,Miktar\n"5"" boru",4');
    expect(s.kalemler[0].ad).toBe('5" boru');
  });

  it("başlıksız dört sütunu (sıra, ad, miktar, birim) tahmin eder", () => {
    const s = ihtiyacMetniniAyikla("1;Boya;5;adet\n2;Fırça;10;kutu");
    expect(s.basliktan).toBe(false);
    expect(s.kalemler).toEqual([
      { ad: "Boya", ozellik: "", miktar: 5, birim: "adet" },
      { ad: "Fırça", ozellik: "", miktar: 10, birim: "kutu" },
    ]);
  });

  it("başlıksız tek sütunu ad sayar, miktar 1 verir", () => {
    const s = ihtiyacMetniniAyikla("Boya\nFırça");
    expect(s.basliktan).toBe(false);
    expect(s.kalemler).toEqual([
      { ad: "Boya", ozellik: "", miktar: 1, birim: "adet" },
      { ad: "Fırça", ozellik: "", miktar: 1, birim: "adet" },
    ]);
  });

  it("sayı içeren ilk satırı başlık saymaz", () => {
    const s = ihtiyacMetniniAyikla("Kalem kutusu\t10\tadet\nBoya\t2\tkutu");
    expect(s.basliktan).toBe(false);
    expect(s.kalemler).toEqual([
      { ad: "Kalem kutusu", ozellik: "", miktar: 10, birim: "adet" },
      { ad: "Boya", ozellik: "", miktar: 2, birim: "kutu" },
    ]);
  });

  it("başlıksız sayılı satırlarda Kalem A verisini alır", () => {
    const s = ihtiyacMetniniAyikla("Kalem A;5;adet\nKalem B;3;kutu");
    expect(s.basliktan).toBe(false);
    expect(s.kalemler.map((k) => k.ad)).toEqual(["Kalem A", "Kalem B"]);
  });

  it("ad ve özellik sözcüğü birlikte geçen başlığı ad sayar", () => {
    const s = ihtiyacMetniniAyikla("Malzeme Adı ve Özellikleri\tMiktar\nBoya\t2");
    expect(s.basliktan).toBe(true);
    expect(s.kalemler).toEqual([{ ad: "Boya", ozellik: "", miktar: 2, birim: "adet" }]);
  });

  it("miktar hücresindeki birimi kullanır", () => {
    const s = ihtiyacMetniniAyikla("Malzeme\tMiktar\nŞeker\t10 kg");
    expect(s.kalemler[0]).toMatchObject({ miktar: 10, birim: "kg" });
  });

  it("boş ad, toplam ve okunamayan miktar için satır numaralı uyarı verir", () => {
    const s = ihtiyacMetniniAyikla("Malzeme;Miktar\nA;3\n;4\nToplam;7\nB;abc");
    expect(s.kalemler).toEqual([
      { ad: "A", ozellik: "", miktar: 3, birim: "adet" },
      { ad: "B", ozellik: "", miktar: 0, birim: "adet" },
    ]);
    expect(s.uyarilar).toEqual([
      "3. satır: malzeme adı yok, atlandı.",
      "4. satır: toplam satırı atlandı.",
      "5. satır: miktar okunamadı, 0 yazıldı.",
    ]);
  });

  it("en fazla 500 kalem alır ve tek uyarı verir", () => {
    const metin = Array.from({ length: 501 }, (_, i) => `Boya ${i + 1}`).join("\n");
    const s = ihtiyacMetniniAyikla(metin);
    expect(s.kalemler).toHaveLength(500);
    expect(s.uyarilar).toEqual(["500 kalemden fazlası alınmadı."]);
  });

  it("boş metinde boş sonuç verir", () => {
    expect(ihtiyacMetniniAyikla("  \n ")).toEqual({ kalemler: [], uyarilar: [], basliktan: false });
  });
});

describe("metniCoz", () => {
  it("UTF-8 baytlarını çözer ve BOM'u atar", () => {
    const bayt = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode("Çamaşır suyu")]);
    expect(metniCoz(bayt)).toBe("Çamaşır suyu");
  });

  it("geçersiz UTF-8'de windows-1254 kullanır", () => {
    const bayt = new Uint8Array([0xc7, 0x61, 0x6d, 0x61, 0xfe, 0xfd, 0x72, 0x20, 0x73, 0x75, 0x79, 0x75]);
    expect(metniCoz(bayt)).toBe("Çamaşır suyu");
  });
});
