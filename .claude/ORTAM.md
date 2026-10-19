# Proje profili — Temin Asistanı

4734 md. 22 doğrudan temin masaüstü programı. Tauri 2 + React 19 + SQLite,
hedef Windows ve Pardus. Arayüz, yorumlar ve kimlikler Türkçe.

## Harita
- `src/domain/` — saf TypeScript iş kuralları ve testleri (`*.test.ts`, vitest). Tutarlar kuruş tamsayı, tarihler `YYYY-AA-GG`.
- `src/domain/basamaklar.ts` — 13 basamaklı alım dosyası: durumlar, evrak formu, yaklaşık maliyet, makam başlığı.
- `src/domain/dosya.ts` — evrak listesi, kapanış eksikleri; `odeme.ts` KDV/tevkifat/damga; `piyasa.ts` değerlendirme ve yasaklılık; `muayene.ts`, `personel.ts`, `kurallar.ts`, `sihirbaz.ts`, `raporlar.ts`.
- `src/data/` — `Depo` arayüzü: `bellekDepo` (tarayıcı, örnek veri) ve `sqliteDepo` (masaüstü); `ornekVeri.ts` örnekler.
- `src/ui/sayfalar/` — sayfalar; `DosyaCalismaAlani.tsx` basamaklı çalışma alanı ve `BasamakBaglami`.
- `src/ui/basamaklar/` — 13 basamağın sayfaları ve `belgeler.tsx` (A4 belge şablonları).
- `src-tauri/migrations/` — SQLite göçleri, `src-tauri/src/lib.rs` içinde kayıtlı.
- `docs/mevzuat-varsayimlari.md` — mevzuat varsayımları ve kaynakları.

## Büyük dosyalar (baştan okunmaz; Grep + offset/limit)
- `src/ui/basamaklar/belgeler.tsx` (~60 KB)
- `package-lock.json`, `src-tauri/Cargo.lock`, `src-tauri/gen/schemas/*`

## Bakılmayacak dizinler
- `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/icons/`

## Yazma yasakları (implementer hiçbir durumda yazmaz)
- `node_modules/`, `dist/`, `src-tauri/target/`, `src-tauri/gen/` — üretilen dosyalar
- `src-tauri/migrations/000[1-8]_*.sql` — uygulanmış göçler değişmez; yeni göç yeni dosyadır
- `.env*`, anahtar ve sertifika dosyaları
- `~/Library/Application Support/com.teminasistani.app/` — kullanıcının gerçek veritabanı ve yedekleri
- `.claude/` — orkestra profili

## Canlı sisteme giden komutlar (hiçbir ajan çalıştırmaz)
- `npm run tauri build` ve dağıtım/imzalama komutları
- `git push`, `git commit` — commit kullanıcı isteyince ana oturumda yapılır

## Biçimlendirme (yalnız yeni dosyalarda)
- Biçimlendirici tanımlı değil; çevredeki kodun düzenine uy (2 boşluk, çift tırnak, noktalı virgül).

## Kod kuralları (implementer)
- Kural ve hesap `src/domain/`'de yazılır ve test edilir; arayüz aynı hesabı kopyalamaz, alan işlevini çağırır.
- Basamaklar depoya doğrudan yazmaz; `BasamakBaglami` üzerinden (`dosyaDegistir`, `piyasaDegistir`, `evrakDegistir`, `alimDegistir`) yazar.
- Belge tarihi kullanıcının girdiği `YYYY-AA-GG`'dir; `new Date().toISOString()` kaydedilmez, bugün için `bugun()` (src/ui/bicim.ts).
- TypeScript hedefi ES2020: `.at()` gibi ES2022 yöntemleri kullanılmaz; kullanılmayan değişken/içe aktarma derlemeyi bozar.
- Kullanıcıya görünen metin ve kod yorumları Türkçe; gerçek kişi/kurum verisi örnek veriye yazılmaz.
- Yeni alan kaydı alanı eklenirse `basamaklariTamamla` ve `ornekVeri.ts` güncellenir.
- npm/node için komutların başında: `export NVM_DIR="$HOME/.nvm"; . "$NVM_DIR/nvm.sh";` cargo için `. "$HOME/.cargo/env";`

## Korunacak davranışlar
- Kapanış: evrak listesi eksiksiz değilse dosya "tamamlandı" olmaz (`kapanisEksikleri`).
- 22/d'de seçilen firmanın yasaklılık sorgu tarihi olmadan tutanak onaylanmaz.
- Ödeme KDV, tevkifat, damga ve borç mahsubunu `odemeHesabi`/`oebSatirlari` ile hesaplar.
- Tutanaktan sonra yaklaşık maliyet sipariş tutarını değiştirmez.
- Basamak sayfaları kayıtlı evrakın tarih ve sayısını geri yükler.

## Risk listesi (danisman)
- Mevzuat doğruluğu: oran ve sınırlar `docs/mevzuat-varsayimlari.md` ile tutarlı olmalı.
- Veri şeması: SQLite göçleri işlem içinde ve yabancı anahtar açık çalışır; tablo yeniden kurma COMMIT'te düşer (göç 7 notu).
- Kullanıcının gerçek veritabanı: göç ve örnek veri yazımı mevcut kayıtları bozmamalı.
- Para hesapları kuruş tamsayıyla, yuvarlama tek yerde.

## Ortam kısıtları
- macOS geliştirme; Node nvm ile (v24), Rust rustup ile.
- Tarayıcı önizlemesi `http://localhost:1420` (bellekDepo, örnek veri); masaüstü `npm run tauri dev`.
