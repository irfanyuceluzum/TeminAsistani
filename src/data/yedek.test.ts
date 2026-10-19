import { describe, expect, it } from "vitest";
import { elleYedekAdi, gocSatirlariniCevir, gocUyumu, oncesiYedekAdi, otomatikYedekAdi, sqliteYolu } from "./yedek";

describe("yedek adları", () => {
  it("otomatik ve elle yedek adı üretir", () => {
    expect(otomatikYedekAdi("2026-03-05")).toBe("otomatik-2026-03-05.db");
    expect(elleYedekAdi("2026-03-05")).toBe("TeminAsistani-yedek-2026-03-05.db");
  });

  it("geri yükleme öncesi adı yerel saatle ve sıfır dolgulu", () => {
    expect(oncesiYedekAdi(new Date(2026, 2, 5, 9, 4, 7))).toBe("geri-yukleme-oncesi-2026-03-05-090407.db");
  });

  it("geri yükleme öncesi adları ada göre sıralanınca kronolojik", () => {
    const zamanlar = [new Date(2026, 11, 31, 23, 59, 59), new Date(2026, 0, 2, 3, 4, 5), new Date(2026, 0, 2, 13, 4, 5), new Date(2025, 5, 1, 0, 0, 0)];
    const sirali = zamanlar.map(oncesiYedekAdi).sort();
    expect(sirali).toEqual([...zamanlar].sort((a, b) => a.getTime() - b.getTime()).map(oncesiYedekAdi));
  });
});

describe("sqliteYolu", () => {
  it("%, ? ve # karakterlerini kodlar ve salt-okunur ekler", () => {
    expect(sqliteYolu("/a/b%c?d#e.db")).toBe("sqlite:/a/b%25c%3Fd%23e.db?mode=ro");
  });

  it("boşluk, Türkçe harf ve ters bölüye dokunmaz", () => {
    expect(sqliteYolu("C:\\Kullanıcı Adı\\Şişli\\yedek.db")).toBe("sqlite:C:\\Kullanıcı Adı\\Şişli\\yedek.db?mode=ro");
  });
});

describe("gocUyumu", () => {
  const canli = [
    { version: 1, checksum: "aa" },
    { version: 2, checksum: "bb" },
    { version: 3, checksum: "cc" },
  ];

  it("boş yedeği reddeder", () => {
    expect(gocUyumu([], canli)).toEqual({ uygun: false, neden: "Yedekte şema bilgisi yok; bu dosya Temin Asistanı yedeği değil." });
  });

  it("daha yeni sürümlü yedeği reddeder", () => {
    expect(gocUyumu([...canli, { version: 4, checksum: "dd" }], canli)).toEqual({
      uygun: false,
      neden: "Yedek, uygulamanın daha yeni bir sürümüyle alınmış.",
    });
  });

  it("ortak sürümde checksum farkını reddeder", () => {
    expect(gocUyumu([{ version: 1, checksum: "aa" }, { version: 2, checksum: "xx" }], canli)).toEqual({
      uygun: false,
      neden: "Yedeğin şema geçmişi bu sürümle uyuşmuyor (göç 2).",
    });
  });

  it("aynı veya daha eski şemayı kabul eder", () => {
    expect(gocUyumu(canli, canli)).toEqual({ uygun: true });
    expect(gocUyumu(canli.slice(0, 2), canli)).toEqual({ uygun: true });
  });
});

describe("gocSatirlariniCevir", () => {
  it("BLOB sayı dizisini hex string yapar", () => {
    expect(gocSatirlariniCevir([{ version: 1, checksum: [0, 15, 255] }])).toEqual([{ version: 1, checksum: "000fff" }]);
  });
});
