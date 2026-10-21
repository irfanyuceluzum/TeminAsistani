import { describe, expect, it } from "vitest";
import { basamaklariTamamla } from "./basamaklar";
import { dosyaKopyasi, gecmisKalemAra, gecmisKalemBul, gecmisKalemler, kopyalanabilirAlimlar } from "./gecmis";
import { bosArastirma, type PiyasaArastirmasi, type PiyasaKalemi } from "./piyasa";
import type { Alim, Asama } from "./tipler";

function alim(id: string, onayTarihi: string, asama: Asama = "tamamlandi"): Alim {
  return { id, onayTarihi, konu: `${id} konusu`, bent: "22/d", tutar: 100000, ekonomikKod: "03.2.1.01", kalemKodu: "KRT", tedarikciId: null, asama, sonIslem: onayTarihi };
}

function kalem(ad: string, miktar = 1, birim = "adet", ozellik = ""): PiyasaKalemi {
  return { id: ad, ad, miktar, birim, ozellik };
}

function piyasa(alimId: string, kalemler: PiyasaKalemi[]): PiyasaArastirmasi {
  return { ...bosArastirma(alimId), kalemler };
}

describe("gecmisKalemler", () => {
  const alimlar = [alim("A", "2025-03-01"), alim("B", "2026-02-01"), alim("C", "2026-05-01", "iptal"), alim("D", "2026-06-01", "piyasa")];
  const piyasalar = [
    piyasa("A", [kalem("A4 kâğıt", 10, "top", "80 g"), kalem("Toner", 2)]),
    piyasa("B", [kalem("  a4   KÂĞIT ", 20, "koli", "80 g/m²"), kalem("A4 kâğıt", 5)]),
    piyasa("C", [kalem("Zımba", 3)]),
    piyasa("D", [kalem("Kalem", 50), kalem("")]),
  ];

  it("aynı kalemi bir kez, en son alındığı hâliyle verir ve kaç dosyada geçtiğini sayar", () => {
    const l = gecmisKalemler(piyasalar, alimlar);
    const kagit = gecmisKalemBul(l, "A4 KÂĞIT")!;
    expect(kagit).toMatchObject({ ad: "a4 KÂĞIT", miktar: 20, birim: "koli", ozellik: "80 g/m²", alimId: "B", kez: 2 });
    expect(l.map((g) => g.ad)).toEqual(["Kalem", "a4 KÂĞIT", "Toner"]);
  });

  it("iptal edilen dosyayı, boş adı ve hariç tutulan dosyayı almaz", () => {
    const l = gecmisKalemler(piyasalar, alimlar, "D");
    expect(gecmisKalemBul(l, "Zımba")).toBeUndefined();
    expect(gecmisKalemBul(l, "Kalem")).toBeUndefined();
    expect(gecmisKalemBul(l, "")).toBeUndefined();
  });

  it("ad, özellik ya da birimde arar", () => {
    const l = gecmisKalemler(piyasalar, alimlar);
    expect(gecmisKalemAra(l, "koli").map((g) => g.alimId)).toEqual(["B"]);
    expect(gecmisKalemAra(l, "TON").map((g) => g.ad)).toEqual(["Toner"]);
    expect(gecmisKalemAra(l, " ")).toHaveLength(3);
  });
});

describe("kopyalanabilirAlimlar", () => {
  it("yalnız kabul edilmiş ve kapanmış dosyaları en yenisi başta verir", () => {
    const l = kopyalanabilirAlimlar([alim("A", "2026-01-01"), alim("B", "2026-03-01", "odeme"), alim("C", "2026-04-01", "piyasa"), alim("D", "2026-02-01", "iptal")]);
    expect(l.map((a) => a.id)).toEqual(["B", "A"]);
  });
});

describe("dosyaKopyasi", () => {
  it("konu, kodlar, şartlar ve kalemleri taşır; boş kalemi atar", () => {
    const d = basamaklariTamamla({ alimId: "A", talepEden: "Okul aile birliği", teslimYeri: "Depo", nitelik: "Yıllık kâğıt" }, "2025-03-01");
    d.sartlar.teslimSuresi = "10 gün";
    const k = dosyaKopyasi({ ...alim("A", "2025-03-01"), sureliIs: true }, piyasa("A", [kalem(" Toner ", 2, " adet ", " siyah "), kalem(" ")]), d);
    expect(k).toMatchObject({ kaynakId: "A", konu: "A konusu", tutar: 100000, kalemKodu: "KRT", talepEden: "Okul aile birliği", teslimYeri: "Depo", nitelik: "Yıllık kâğıt", sureliIs: true });
    expect(k.sartlar?.teslimSuresi).toBe("10 gün");
    expect(k.kalemler).toEqual([{ ad: "Toner", ozellik: "siyah", miktar: 2, birim: "adet" }]);
  });

  it("basamak ve piyasa kaydı yoksa boş değerlerle döner", () => {
    const k = dosyaKopyasi(alim("A", "2025-03-01"), null, null);
    expect(k).toMatchObject({ nitelik: "", talepEden: "", teslimYeri: "", sartlar: null, kalemler: [], sureliIs: false });
  });
});
