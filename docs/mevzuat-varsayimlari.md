# Mevzuat varsayımları ve doğrulama durumu

Son kontrol: 17.10.2026. Bu liste, kural motorunun dayandığı mevzuat varsayımlarını, kaynağını ve doğrulama durumunu tutar. Yıllık değişen tutarlar koda yazılmaz, Parametreler'den girilir.

Durum anlamları:

- **Doğrulandı:** birincil kaynakta (Kanun, Tebliğ, GİB tablosu) görüldü.
- **İkincil kaynak:** yalnızca meslek yayınlarında görüldü, resmi metinle teyit edilmeli.
- **Doğrulanamadı:** kaynak bulunamadı ya da kaynaklar çelişiyor; ayar olarak bırakıldı.
- **Düzeltildi:** koddaki varsayım yanlış çıktı ve bu kontrolde düzeltildi.

## Özet tablo

| # | Konu | Koddaki kural | Kaynak | Durum | Kod yeri |
|---|------|---------------|--------|-------|----------|
| 1 | 22/d parasal limitleri | 01.02.2026–31.01.2027: büyükşehir ₺1.021.827, diğer ₺340.391; limit onay tarihine göre seçilir | 4734 md. 67; 2026/1 Kamu İhale Tebliği, RG 22.01.2026 | Doğrulandı | `kurallar.ts` `ddLimitKontrolu`, `ornekVeri.ts` |
| 2 | Limit dönemi | 1 Şubat'ta başlar | 4734 md. 67 | Doğrulandı | `parametreler.ts` `onerilenDonem` |
| 3 | Doğrudan temin bentleri | Kodda 22/a, b, c, d, e var | 4734 md. 22/1: a'dan i'ye on bent | Kısmen. f, g, h, ı, i eksik | `sihirbaz.ts` `BENTLER` |
| 4 | Kısımlara bölme yasağı | Bölme riski uyarısı | 4734 **md. 5** | Düzeltildi: atıf "Madde 12" idi | `AnaPanel.tsx`, `kurallar.ts` |
| 5 | %10 ödenek sınırı | 22/d yıllık toplamı ödeneğin %10'unu aşamaz | 4734 md. 62/ı: 21 ve 22. maddelerdeki parasal limitli harcamaların toplamı; aşmak için Kamu İhale Kurulu'nun uygun görüşü | Doğrulandı | `kurallar.ts` `yuzdeOnDurumu` |
| 6 | KİK bildirimi | **Tüm** doğrudan temin alımları; son gün, alım ayını izleyen ayın 10'u | Doğrudan Temin Tebliği m.4/9 | Düzeltildi: 22/d bildirimden hariç tutuluyordu | `raporlar.ts` `kikBildirimleri`, `dosya.ts` |
| 7 | EKAP kaydı | Yok | Tebliğ m.5/1: alım EKAP'a kaydedilir, doğrudan temin kayıt numarası alınır | Açık iş | — |
| 8 | Yasaklılık kontrolü | Yalnızca 22/d'de zorunlu, piyasa araştırmasında kazanan için engel | Tebliğ m.4/8 | Doğrulandı | `piyasa.ts` `piyasaKontrolleri` |
| 9 | Yaklaşık maliyet | Onay belgesinde isteğe bağlı | Tebliğ m.4/4 (yapım işlerinde zorunlu) | Doğrulandı | `YeniAlim.tsx` |
| 10 | Sözleşme zorunluluğu | 22/c'de sözleşme yoksa ödeme ekranında uyarı | Tebliğ m.4/5: 22/c ve teslimi belli süre gerektiren alımlar | Kısmen. Süreye yayılan işler için uyarı yok | `odeme.ts` `odemeKontrolleri` |
| 11 | KDV tevkifat oranları | Bakım onarım 7/10, temizlik 9/10, yemek 5/10, işgücü 9/10 | KDV GUT I/C-2.1.3.2.3, .10, .4, .5 (Seri No: 35 değişikliği, 2021) | İkincil kaynak | `odeme.ts` `TEVKIFAT_TURLERI` |
| 12 | Tevkifat sınırı | KDV dahil bedel sınırı aşarsa tevkifat; varsayılan ₺12.000 (2026) | Fatura düzenleme sınırı; 2025'te ₺9.900 | İkincil kaynak | `odeme.ts` `odemeHesabi`, Parametreler |
| 13 | Sözleşme damga vergisi | Binde 9,48, yalnızca sözleşme varsa | 488 sayılı Kanun, 1 sayılı tablo I | Doğrulandı | `kurallar.ts` `damgaVergisi` |
| 14 | Makbuz damga vergisi | Binde 9,48, her ödemede, KDV hariç bedele | 1 sayılı tablo IV: resmi dairelerin mal ve hizmet alımı ödemelerinde verilen makbuzlar | Doğrulandı (GİB tablosu, Ekim 2025) | `kurallar.ts` `damgaVergisi` |
| 15 | Karar pulu | Binde 5,69; uygulanıp uygulanmayacağı ayar (varsayılan: uygulanmaz) | Oran 1 sayılı tablo II'de var. Doğrudan teminde uygulanması tartışmalı: Sayıştay 5. Daire (2008) gerekmediği görüşünde, bazı yazarlar onay belgesinin karar sayılacağı görüşünde | Doğrulanamadı | Parametreler |
| 16 | Vergi borcu sorgusu | Eşik yok; "Gerekmiyor" elle seçilir | 6183 md. 22/A; bir tebliğde ₺5.000 eşiği geçiyor ama güncelliği belirsiz | Doğrulanamadı | `odeme.ts` |
| 17 | SGK borç sorgusu | Eşik yok; "Gerekmiyor" elle seçilir | 5510 md. 90; 2026 eşiği bulunamadı | Doğrulanamadı | `odeme.ts` |
| 18 | Yasaklılık sorgusunun eskimesi | 90 günden eski sorgu uyarılır | Mevzuat değil, uygulama tercihi. Tebliğ m.4/8 kontrolü her 22/d alımında ister | Uygulama kuralı | `tedarikci.ts` `SORGU_ESKIME_GUNU` |

## Bu kontrolde koda yapılan düzeltmeler

1. **Bölme yasağı:** Ana paneldeki uyarı ve kod açıklaması 4734 md. 5'e atıf yapacak şekilde düzeltildi.
2. **KİK bildirimi:** Bildirim artık bentten bağımsız olarak her dosyada isteniyor. Raporlar ekranı siparişi verilmiş tüm alımları son günleriyle gösteriyor; son günü geçen bildirim "Gecikti" olarak işaretleniyor. Bunun sonucunda 22/d dosyaları da KİK bildirimi işaretlenmeden kapanmıyor.
3. **%10 sınırı:** Parametreler'deki açıklama md. 62/ı'ya göre düzeltildi. Sınırın 21 ve 22. maddelerin tamamını kapsadığı kod açıklamasına not edildi.
4. **22/c sözleşmesi:** Sözleşme işaretlenmemiş 22/c ödemelerinde uyarı gösteriliyor.
5. **Tevkifat sınırı:** Örnek ayarlara 2026 için ₺12.000 girildi. Bu değer, daha önce kurulmuş veritabanlarında Parametreler'den elle girilmeli.

## Açık işler

- **Eksik bentler:** 22/f (ilaç, aşı ve tıbbi sarf), g (milletlerarası tahkim avukatlığı), h (avukatlık ve fikri mülkiyet tescili), ı (Türkiye İş Kurumu) ve i (seçim malzemeleri) eklenmeli. Veritabanındaki `bent` kısıtı değişeceği için şema göçü gerekiyor.
- **EKAP doğrudan temin kayıt numarası:** Dosyaya bir alan olarak eklenmeli ve kontrol listesine konmalı.
- **Süreye yayılan işlerde sözleşme:** Tasarımdaki iş türü listesiyle bu iş türlerine uyarı eklenmeli.
- **Borç sorgusu eşikleri:** Vergi ve SGK sorgu eşikleri resmi kaynaktan bulunup Parametreler'e eklenmeli.
- **Resmi metinlerle teyit:** Tevkifat oranları ve sınırı GİB'in güncel KDV Genel Uygulama Tebliği metninden doğrulanmalı.
- **Karar pulu:** Muhasebe birimiyle netleştirilmeli. Gerekirse GİB'den özelge istenmeli.

## Kaynaklar

- 4734 sayılı Kamu İhale Kanunu, güncel metin: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=4734&MevzuatTertip=5
- Doğrudan Temin Yöntemiyle Yapılacak Alımlara İlişkin Tebliğ, RG 11.07.2023/32245, yürürlük 01.02.2024: https://www.lexpera.com.tr/resmi-gazete/metin/dogrudan-temin-yontemiyle-yapilacak-alimlara-iliskin-teblig-32245
- 2026 parasal limitleri: https://www.alomaliye.com/2026/01/23/kik-esik-degerler-ve-parasal-limitler-ilan-ucretleri-ve-e-ihale-hizmet-bedeli/
- 488 sayılı Kanun 1 sayılı tablo (GİB, Ekim 2025): https://cdn.gib.gov.tr/api/gibportal-file/file/getFile?objectKey=MEVZUAT_TEBLIGLER%2FUNIVERSAL%2F2025%2F488_Tablo1_01102025.pdf
- Damga vergisi oranları 2026 (PwC): https://www.pwc.com.tr/tr/hizmetlerimiz/vergi/vergi-portali/pratik-bilgiler/oranlar/damga-vergisi-oran-ve-tutarlari.html
- Doğrudan teminde karar pulu tartışması: https://www.muhasebetr.com/yazarlarimiz/bulentdoger/001
- KDV kısmi tevkifat tablosu: https://legalbank.net/belge/kdv-genel-uygulama-tebligine-gore-kdv-tevkifatlarina-iliskin-tablo-/3290003/
- Tevkifat oranı değişiklikleri (2021): https://cottgroup.com/tr/mevzuat/item/kdv-kismi-tevkifat-uygulamasinda-oran-ve-kapsam-degisiklikleri-yapildi
- Tevkifat sınırı 2026: https://kobitime.com/nakliye-tevkifat-orani-ve-tevkifat-kodu-2026/
- Borcu yoktur yazısı (6183 md. 22/A): https://www.muhasebetr.com/yazarlarimiz/ibrahimcakir/002/
