import { describe, expect, it } from "vitest";
import { aktarilanlariKalemYap, doluKalemVarMi, gecmistenKalemYap, gecmistenTamamla, listeyeBirlestir, onizlemeFazlasi, onizlemeOzeti, yeniKalem } from "./IhtiyacListesi";

const dolu = (ad: string) => ({ ...yeniKalem(), ad });
const aktarilan = (ad: string) => ({ ad, ozellik: "", miktar: 2, birim: "adet" });

describe("listeyeBirlestir", () => {
  it("boş listeye yenileri koyar", () => {
    const yeni = aktarilanlariKalemYap([aktarilan("A"), aktarilan("B")]);
    expect(listeyeBirlestir([], yeni, "ekle").map((k) => k.ad)).toEqual(["A", "B"]);
  });

  it("tek boş kalem varsa onu atar", () => {
    const yeni = aktarilanlariKalemYap([aktarilan("A")]);
    const sonuc = listeyeBirlestir([yeniKalem()], yeni, "ekle");
    expect(sonuc.map((k) => k.ad)).toEqual(["A"]);
  });

  it("dolu listede sona ekler", () => {
    const mevcut = [dolu("X")];
    const yeni = aktarilanlariKalemYap([aktarilan("A")]);
    expect(listeyeBirlestir(mevcut, yeni, "ekle").map((k) => k.ad)).toEqual(["X", "A"]);
  });

  it("tek ama dolu kalemi atmaz", () => {
    const yeni = aktarilanlariKalemYap([aktarilan("A")]);
    expect(listeyeBirlestir([dolu("X")], yeni, "ekle")).toHaveLength(2);
  });

  it("değiştir modunda listeyi yenileriyle değiştirir", () => {
    const yeni = aktarilanlariKalemYap([aktarilan("A")]);
    expect(listeyeBirlestir([dolu("X"), dolu("Y")], yeni, "degistir").map((k) => k.ad)).toEqual(["A"]);
  });
});

describe("kimlik benzersizliği", () => {
  it("aynı anda üretilen kalemlerin kimlikleri çakışmaz", () => {
    const kalemler = aktarilanlariKalemYap(Array.from({ length: 500 }, (_, i) => aktarilan(`K${i}`)));
    expect(new Set(kalemler.map((k) => k.id)).size).toBe(500);
  });

  it("alanları aktarılandan taşır", () => {
    const [k] = aktarilanlariKalemYap([{ ad: "Kalem", ozellik: "mavi", miktar: 3, birim: "paket" }]);
    expect(k).toMatchObject({ ad: "Kalem", ozellik: "mavi", miktar: 3, birim: "paket" });
  });
});

describe("önizleme özeti", () => {
  it("başlık tanındıysa belirtir", () => {
    expect(onizlemeOzeti({ kalemler: [aktarilan("A")], basliktan: true })).toBe("1 kalem bulundu (başlık satırı tanındı)");
  });

  it("başlık yoksa uyarır", () => {
    expect(onizlemeOzeti({ kalemler: [], basliktan: false })).toBe("0 kalem bulundu (başlık satırı bulunamadı; sütunlar tahmin edildi — önizlemeyi kontrol edin)");
  });

  it("50 satırdan fazlası için kalan sayıyı yazar", () => {
    expect(onizlemeFazlasi(50)).toBeNull();
    expect(onizlemeFazlasi(73)).toBe("… ve 23 kalem daha");
  });
});

describe("doluKalemVarMi", () => {
  it("boşlukla dolu sayılmaz", () => {
    expect(doluKalemVarMi([{ ...yeniKalem(), ad: "  " }])).toBe(false);
    expect(doluKalemVarMi([dolu("X")])).toBe(true);
  });
});

describe("önceki alımlardan kalem", () => {
  const gecmis = [{ ad: "Toner", ozellik: "Siyah, 3000 sayfa", miktar: 4, birim: "kutu", alimId: "DT-2025-010", tarih: "2025-05-01", kez: 2 }];

  it("seçilen kalemler son miktar ve özellikle, yeni kimlikle gelir", () => {
    const [k] = gecmistenKalemYap(gecmis);
    expect(k).toMatchObject({ ad: "Toner", ozellik: "Siyah, 3000 sayfa", miktar: 4, birim: "kutu" });
    expect(k.id).toMatch(/^k/);
  });

  it("özelliği boş, adı eşleşen kaleme özellik ve birim önerir; dolu özelliğe dokunmaz", () => {
    expect(gecmistenTamamla({ ...dolu(" toner "), ozellik: "" }, gecmis)).toEqual({ ozellik: "Siyah, 3000 sayfa", birim: "kutu" });
    expect(gecmistenTamamla({ ...dolu("Toner"), ozellik: "Renkli" }, gecmis)).toBeNull();
    expect(gecmistenTamamla(dolu("Kalem"), gecmis)).toBeNull();
  });
});
