import { describe, expect, it } from "vitest";
import { BOS_DEGER, belgeTutari, binde, bosIse, tl, tlKurus, tutarGirdisi, tutarMetni, yuzde } from "./bicim";
import { tutarCoz } from "./sihirbaz";

describe("tutar biçimleri", () => {
  it("tlKurus her zaman 2 kuruş hanesi verir", () => {
    expect(tlKurus(125_050)).toBe("₺1.250,50");
    expect(tlKurus(125_000)).toBe("₺1.250,00");
    expect(tlKurus(5)).toBe("₺0,05");
    expect(tlKurus(0)).toBe("₺0,00");
    expect(tlKurus(123_456_789)).toBe("₺1.234.567,89");
  });

  it("tl tam TL'ye yuvarlar", () => {
    expect(tl(125_050)).toBe("₺1.251");
    expect(tl(125_000)).toBe("₺1.250");
    expect(tl(0)).toBe("₺0");
    expect(tl(123_456_789)).toBe("₺1.234.568");
  });

  it("tutarMetni simgesiz ve 2 haneli", () => {
    expect(tutarMetni(125_050)).toBe("1.250,50");
    expect(tutarMetni(100)).toBe("1,00");
    expect(tutarMetni(0)).toBe("0,00");
    expect(tutarMetni(123_456_789)).toBe("1.234.567,89");
  });

  it("belgeTutari TL son ekiyle yazar", () => {
    expect(belgeTutari(125_050)).toBe("1.250,50 TL");
    expect(belgeTutari(0)).toBe("0,00 TL");
    expect(belgeTutari(123_456_789)).toBe("1.234.567,89 TL");
  });

  it("negatif tutarda toLocaleString'in doğal çıktısı korunur", () => {
    expect(tutarMetni(-100)).toBe("-1,00");
    expect(tlKurus(-100)).toBe("₺-1,00");
    expect(belgeTutari(-100)).toBe("-1,00 TL");
    expect(tl(-100)).toBe("₺-1");
  });

  it("tutarGirdisi tutarCoz ile gidiş-dönüş yapar", () => {
    for (const kurus of [0, 1, 5, 100, 125_050, 3_850_000, 123_456_789, 99_999_999_99]) {
      expect(tutarCoz(tutarGirdisi(kurus))).toBe(kurus);
    }
  });
});

describe("bosIse", () => {
  it("null ve undefined için boş değeri verir", () => {
    expect(bosIse(null, tlKurus)).toBe(BOS_DEGER);
    expect(bosIse(undefined, tlKurus)).toBe("—");
    expect(bosIse(null, tlKurus, "-")).toBe("-");
  });

  it("değer varsa (0 dahil) biçimler", () => {
    expect(bosIse(125_050, tlKurus)).toBe("₺1.250,50");
    expect(bosIse(0, tutarMetni)).toBe("0,00");
  });
});

describe("yüzde ve binde", () => {
  it("yuzde 1 ondalık yazar", () => {
    expect(yuzde(0.1)).toBe("%10,0");
    expect(yuzde(0)).toBe("%0,0");
    expect(yuzde(0.1234)).toBe("%12,3");
    expect(yuzde(1.5)).toBe("%150,0");
  });

  it("binde yüz binde değeri 2 haneli ve simgesiz yazar", () => {
    expect(binde(948)).toBe("9,48");
    expect(binde(759)).toBe("7,59");
    expect(binde(1000)).toBe("10,00");
    expect(binde(0)).toBe("0,00");
  });
});
