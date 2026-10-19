// Ortak biçimleyiciler: para, yüzde ve binde. Tutarlar kuruş tamsayıdır.

export const BOS_DEGER = "—";

const IKI_HANE = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;

// Simgesiz, her zaman 2 kuruş haneli: "1.250,50". Tablo/hücre metni için.
export function tutarMetni(kurus: number): string {
  return (kurus / 100).toLocaleString("tr-TR", IKI_HANE);
}

// Ekran tutarı: "₺1.250,50". Uyarı, kontrol ve limit mesajlarında kullanılır.
export function tlKurus(kurus: number): string {
  return "₺" + tutarMetni(kurus);
}

// Özet: tam TL'ye yuvarlı "₺1.251". Yalnız özet kartları ve grafikler içindir; domain mesajlarında kullanılmaz.
export function tl(kurus: number): string {
  return "₺" + Math.round(kurus / 100).toLocaleString("tr-TR");
}

// Resmi belge: "1.250,50 TL".
export function belgeTutari(kurus: number): string {
  return tutarMetni(kurus) + " TL";
}

// Giriş alanına yazılan değer; tutarCoz ile geri okunduğunda aynı kuruşu verir.
export function tutarGirdisi(kurus: number): string {
  return tutarMetni(kurus);
}

// null/undefined alan için tek yardımcı.
export function bosIse<T>(deger: T | null | undefined, bicim: (d: T) => string, bos: string = BOS_DEGER): string {
  return deger === null || deger === undefined ? bos : bicim(deger);
}

// Oran 0,1 için "%10,0".
export function yuzde(oran: number): string {
  return "%" + (oran * 100).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

// Yüz binde olarak tutulan oranı binde olarak 2 haneli ve simgesiz yazar: 948 → "9,48". Çağıran "binde" kelimesini yazar.
export function binde(yuzBinde: number): string {
  return (yuzBinde / 100).toLocaleString("tr-TR", IKI_HANE);
}
