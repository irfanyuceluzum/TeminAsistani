import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekPiyasa, ornekTedarikciler } from "../data/ornekVeri";
import { bilgiEksik, firmaGecmisi, ibanBicimle, ibanGecerli, sorguYasi, tedarikciHatalari } from "./tedarikci";

const TL = 100;

describe("firma geçmişi", () => {
  const piyasalar = ornekPiyasa.map((p) => structuredClone(p));

  it("süren araştırmadaki teklifi ve sorguyu listeler", () => {
    const g = firmaGecmisi("toros", piyasalar, ornekAlimlar);
    expect(g.teklifler).toEqual([{ alimId: "DT-2026-041", konu: "Temizlik malzemesi", tarih: "2026-10-15", toplam: 25_380 * TL, sonuc: "suruyor", fark: null }]);
    expect(g.sonSorgu).toBe("2026-10-16");
    expect(g.kazanilan).toBe(0);
  });

  it("en düşüğe göre farkı hesaplar", () => {
    const ece = firmaGecmisi("ece", piyasalar, ornekAlimlar).teklifler[0];
    expect(ece.fark).toBeCloseTo((26_040 - 25_380) / 25_380);
  });

  it("tamamlanan araştırmada kazananın sipariş toplamını sayar", () => {
    const g = firmaGecmisi("serin", piyasalar, ornekAlimlar);
    expect(g).toMatchObject({ teklifSayisi: 1, kazanilan: 1, siparisToplami: 46_900 * TL });
  });

  it("fiyat vermeyen firmanın teklifi sayılmaz ama sorgusu görünmez", () => {
    const g = firmaGecmisi("kaya", piyasalar, ornekAlimlar);
    expect(g.teklifSayisi).toBe(0);
    expect(g.sorgular).toEqual([]);
  });
});

describe("sorgu yaşı ve eksik bilgi", () => {
  it("son sorgudan bu yana geçen günü verir", () => {
    expect(sorguYasi("2026-06-12", "2026-10-16")).toBe(126);
    expect(sorguYasi(null, "2026-10-16")).toBeNull();
  });

  it("VKN ya da IBAN yoksa eksik sayar", () => {
    expect(bilgiEksik(ornekTedarikciler[0])).toBe(true);
    expect(bilgiEksik({ ...ornekTedarikciler[0], vkn: "1234567890", iban: "TR330006100519786457841326" })).toBe(false);
  });
});

describe("doğrulama", () => {
  it("IBAN denetim basamağını kontrol eder", () => {
    expect(ibanGecerli("TR33 0006 1005 1978 6457 8413 26")).toBe(true);
    expect(ibanGecerli("TR340006100519786457841326")).toBe(false);
    expect(ibanGecerli("DE89370400440532013000")).toBe(false);
    expect(ibanBicimle("tr330006100519786457841326")).toBe("TR33 0006 1005 1978 6457 8413 26");
  });

  it("boş adı, çift kaydı ve hatalı alanları bildirir", () => {
    const mevcut = [...ornekTedarikciler, { id: "x", ad: "X Ltd.", kategori: "", vkn: "1111111111" }];
    expect(tedarikciHatalari({ id: "yeni", ad: " ", kategori: "" }, mevcut)).toEqual(["Firma adını yazın."]);
    expect(tedarikciHatalari({ id: "yeni", ad: "toros aş", kategori: "" }, mevcut)).toEqual(["Bu adla kayıtlı bir firma var."]);
    const h = tedarikciHatalari({ id: "yeni", ad: "Yeni", kategori: "", vkn: "1111111111", iban: "TR00", eposta: "a@b" }, mevcut);
    expect(h).toHaveLength(3);
  });

  it("firmanın kendi kaydını çift saymaz", () => {
    expect(tedarikciHatalari(ornekTedarikciler[0], ornekTedarikciler)).toEqual([]);
  });
});
