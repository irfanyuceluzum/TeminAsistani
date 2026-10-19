import { describe, expect, it } from "vitest";
import { ornekAlimlar, ornekPiyasa, ornekTedarikciler } from "../data/ornekVeri";
import { bilgiEksik, firmaGecmisi, ibanBicimle, ibanGecerli, sorguYasi, sorguYenilenmeli, tedarikciHatalari, teklifFirmaKontrolleri, yeniTedarikci } from "./tedarikci";
import type { Tedarikci } from "./tipler";

const TL = 100;

describe("sorguYenilenmeli", () => {
  it("sorgu yoksa yenilenmeli", () => expect(sorguYenilenmeli(null)).toBe(true));
  it("eşikte yenilenmez, eşiği aşınca yenilenir", () => {
    expect(sorguYenilenmeli(0)).toBe(false);
    expect(sorguYenilenmeli(90)).toBe(false);
    expect(sorguYenilenmeli(91)).toBe(true);
  });
});

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
    // Kaya Ticaret DT-2026-037'de fiyat verdi (örnek dosya eklendi); bu durum yalnız fiyatsız kaldığı DT-2026-041 araştırmasıyla sınanır
    const g = firmaGecmisi("kaya", piyasalar.filter((p) => p.alimId === "DT-2026-041"), ornekAlimlar);
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
    const kaya = ornekTedarikciler.find((t) => t.id === "kaya")!;
    expect(bilgiEksik(kaya)).toBe(true);
    expect(bilgiEksik({ ...kaya, iban: "TR330006100519786457841326" })).toBe(false);
    expect(bilgiEksik({ ...kaya, iban: "TR330006100519786457841326", vkn: "" })).toBe(true);
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

describe("yeni tedarikçi", () => {
  it("ad ve kategoriyi kırpar, adından kimlik türetir", () => {
    expect(yeniTedarikci("  Çağrı Kırtasiye  ", " Kırtasiye ", [])).toEqual({ id: "cagri-kirtasiye", ad: "Çağrı Kırtasiye", kategori: "Kırtasiye" });
  });

  it("boş ad için hata verir", () => {
    expect(() => yeniTedarikci("   ", "x", [])).toThrow("Firma adını yazın.");
  });

  it("aynı adı Türkçe büyük/küçük harf duyarsız reddeder", () => {
    const mevcut = [{ id: "isik", ad: "Işık Ticaret", kategori: "" }];
    expect(() => yeniTedarikci("IŞIK TİCARET", "", mevcut)).toThrow("Bu adla kayıtlı bir firma var.");
  });

  it("kimlik mevcut kimliklerle çakışmaz", () => {
    const mevcut = [{ id: "ege", ad: "Ege Ltd", kategori: "" }];
    expect(yeniTedarikci("Ege", "", mevcut).id).toBe("ege-2");
  });
});

describe("teklif aşamasında firma bilgisi kontrolü", () => {
  const tam: Tedarikci = { ...ornekTedarikciler.find((t) => t.id === "toros")! };

  it("örnek firmaların IBAN'ları geçerli, Kaya Ticaret'inki eksik", () => {
    for (const t of ornekTedarikciler.filter((x) => x.iban)) expect(ibanGecerli(t.iban!)).toBe(true);
    expect(ornekTedarikciler.find((t) => t.id === "kaya")!.iban).toBeUndefined();
  });

  it("bütün firmalar tamsa tek 'tamam' satırı döner", () => {
    expect(teklifFirmaKontrolleri(["toros", "ece"], ornekTedarikciler)).toEqual([expect.objectContaining({ durum: "tamam", baslik: "Firma bilgileri tam" })]);
  });

  it("VKN, vergi dairesi ve adres eksikse tek uyarıda sayar", () => {
    const eksik = { ...tam, id: "x", ad: "X Ltd.", vkn: "", vergiDairesi: " ", adres: undefined };
    const k = teklifFirmaKontrolleri(["x"], [eksik]);
    expect(k).toEqual([expect.objectContaining({ durum: "uyari", baslik: "X Ltd.: VKN, vergi dairesi, adres eksik" })]);
  });

  it("hatalı biçimli VKN'yi eksik sayar", () => {
    const k = teklifFirmaKontrolleri(["x"], [{ ...tam, id: "x", ad: "X Ltd.", vkn: "12345" }]);
    expect(k[0]).toMatchObject({ durum: "uyari", baslik: "X Ltd.: VKN (10 ya da 11 hane olmalı) eksik" });
  });

  it("IBAN eksikliği yalnız 'yapılacak' düzeyindedir; tamam satırı çıkmaz", () => {
    const k = teklifFirmaKontrolleri(["toros", "kaya"], ornekTedarikciler);
    expect(k).toEqual([expect.objectContaining({ durum: "yapilacak", baslik: "Kaya Ticaret: IBAN girilmemiş" })]);
    const gecersiz = teklifFirmaKontrolleri(["x"], [{ ...tam, id: "x", ad: "X Ltd.", iban: "TR00 0000" }]);
    expect(gecersiz[0]).toMatchObject({ durum: "yapilacak", baslik: "X Ltd.: IBAN geçersiz" });
  });

  it("rehberde olmayan firmayı bildirir, boş listede satır üretmez", () => {
    expect(teklifFirmaKontrolleri(["silinmis"], ornekTedarikciler)[0]).toMatchObject({ durum: "uyari", baslik: "Firma kaydı bulunamadı" });
    expect(teklifFirmaKontrolleri([], ornekTedarikciler)).toEqual([]);
  });
});
