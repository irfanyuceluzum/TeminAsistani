# Temin Asistanı

4734 sayılı Kamu İhale Kanunu'nun 22. maddesi kapsamındaki doğrudan temin alımlarını kolaylaştıran masaüstü uygulaması. Windows ve Pardus hedeflenir; Tauri 2, React ve SQLite ile yazılmıştır.

Ekran tasarımları: https://claude.ai/artifact/NtBFMgiRJvVysBomV8xhSH

## Yapı

- `src/domain/`: kural motoru. 22/d limiti, %10 ödenek sınırı, kısımlara bölme ve damga vergisi hesapları. Arayüzden ve veritabanından bağımsızdır, testleri yanındadır.
- `src/data/`: veri katmanı. Masaüstünde SQLite, tarayıcı önizlemesinde örnek verilerle bellekte çalışır.
- `src/ui/`: arayüz. Şimdilik ana panel ve parametreler ekranı hazır.
- `src-tauri/`: masaüstü kabuğu ve veritabanı şeması (`migrations/`).

Tutarlar kuruş cinsinden tam sayı, tarihler `YYYY-AA-GG` metni olarak tutulur. Yıllık limitler, oranlar ve kurallar koda gömülmez; Parametreler'den okunur.

## Çalıştırma

```bash
npm install
npm test          # kural motoru testleri
npm run dev       # tarayıcıda önizleme, örnek verilerle
npm run tauri dev # masaüstü uygulaması (Rust gerekir)
```

Masaüstü sürümü için Rust ve Tauri ön koşulları kurulu olmalıdır: https://tauri.app/start/prerequisites/

## Mevzuat notu

Limitler, oranlar ve bazı kurallar (KİK bildirimi, tevkifat, karar pulu, sürekli işlerde sözleşme) güncel mevzuattan doğrulanmalıdır. Örnek veriler `src/data/ornekVeri.ts` dosyasındadır ve gerçek kullanıma geçmeden kaldırılmalıdır.
