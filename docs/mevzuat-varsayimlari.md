# Mevzuat varsayımları ve doğrulama durumu

Son kontrol: 19.10.2026. Bu liste, kural motorunun dayandığı mevzuat varsayımlarını, kaynağını ve doğrulama durumunu tutar. Yıllık değişen tutarlar koda yazılmaz, Parametreler'den girilir.

## Kapsam

- Uygulama yalnız 4734 sayılı Kanun md. 22/d (parasal limit içi doğrudan temin) içindir. 22/a–c ve 22/e–i bentleri kapsam dışıdır (ürün kararı, 19.10.2026).
- Veritabanındaki eski 22/d dışı kayıtlar silinmez, uygulamada gösterilmez: `src/domain/gorunurluk.ts` `gorunurAlimlar`, `src/ui/useVeri.ts`.
- Dosya numarası, gizli kayıtlar dahil bütün kayıtlardan üretilir (`sihirbaz.ts` `yeniDosyaNo`).
- Mevzuat dayanağı öncelikle 4734 sayılı Kamu İhale Kanunu ve Doğrudan Temin Yoluyla Yapılacak Alımlara İlişkin Tebliğ'dir; ödemeye ilişkin diğer mevzuat ayrı bölümde tutulur.

Durum anlamları:

- **Doğrulandı:** birincil kaynakta (Kanun, Tebliğ, GİB tablosu) görüldü.
- **İkincil kaynak:** yalnızca meslek yayınlarında görüldü, resmi metinle teyit edilmeli.
- **Doğrulanamadı:** kaynak bulunamadı ya da kaynaklar çelişiyor; ayar olarak bırakıldı.
- **Düzeltildi:** koddaki varsayım yanlış çıktı ve bu kontrolde düzeltildi.

## Özet tablo

### 1. 4734 sayılı Kamu İhale Kanunu ve Doğrudan Temin Tebliği

| # | Konu | Koddaki kural | Kaynak | Durum | Kod yeri |
|---|------|---------------|--------|-------|----------|
| 1 | 22/d parasal limitleri | 01.02.2026–31.01.2027: büyükşehir ₺1.021.827, diğer ₺340.391; limit onay tarihine göre seçilir | 4734 md. 22/d ve md. 67; 2026/1 Kamu İhale Tebliği, RG 22.01.2026 | Doğrulandı | `kurallar.ts` `ddLimitKontrolu`, `ornekVeri.ts` |
| 2 | Limit dönemi | 1 Şubat'ta başlar | 4734 md. 67 | Doğrulandı | `parametreler.ts` `onerilenDonem` |
| 3 | Doğrudan temin bentleri | Kapsam: yalnız 22/d; diğer bentler kapsam dışı (ürün kararı, 19.10.2026) | 4734 md. 22/1 | Ürün kararı | `sihirbaz.ts` `BENTLER` (yalnız 22/d), `gorunurluk.ts` |
| 4 | Kısımlara bölme yasağı | Bölme riski uyarısı | 4734 **md. 5** | Düzeltildi: atıf "Madde 12" idi | `AnaPanel.tsx`, `kurallar.ts` `bolmeRiskleri` |
| 5 | %10 ödenek sınırı | 22/d yıllık toplamı ödeneğin %10'unu aşamaz | 4734 md. 62/ı: 21 ve 22. maddelerdeki parasal limitli harcamaların toplamı; aşmak için Kamu İhale Kurulu'nun uygun görüşü | Doğrulandı | `kurallar.ts` `yuzdeOnDurumu` |
| 6 | KİK bildirimi | **Tüm** doğrudan temin alımları; son gün, alım ayını izleyen ayın 10'u | Doğrudan Temin Tebliği m.4/9 | Düzeltildi: 22/d bildirimden hariç tutuluyordu | `raporlar.ts` `kikBildirimleri`, `dosya.ts` `evrakListesi` |
| 7 | KİK bildirimi süresi | Bildirim tarihi sipariş ayını izleyen ayın 10'unu geçerse uyarı | Doğrudan Temin Tebliği m.4/9 | Doğrulandı (#6 ile aynı kaynak) | `basamaklar.ts` `tarihSirasiKontrolleri`, `raporlar.ts` `kikSonGunu` |
| 8 | EKAP kaydı | Kayıt numarası onay belgesinde ya da dosyada girilir; girilmeden onaydan siparişe geçilmez, ödeme eki listesinde aranır | Tebliğ m.5/1 | Doğrulandı, uygulandı | `dosya.ts` `evrakListesi` |
| 9 | Yasaklılık kontrolü | Yalnızca 22/d'de zorunlu; seçilen firmanın sorgu tarihi girilmeden tutanak onaylanmaz; evrak listesi tutanağın onayından değil sorgu tarihinden hesaplanır | Doğrudan Temin Tebliği m.4/8 (RG 11.07.2023 değişikliği metnine göre yalnız 22/d) | Doğrulandı | `piyasa.ts` `yasaklilikEksikleri`, `dosya.ts` `evrakDurumlari`, 7. basamak (`PiyasaTutanagi.tsx`) |
| 10 | Yaklaşık maliyet | Onay belgesinde isteğe bağlı | Tebliğ m.4/4 (yapım işlerinde zorunlu) | Doğrulandı | 4. basamak (`YaklasikMaliyet.tsx`, `basamaklar.ts` `yaklasikHesapla`) |
| 11 | Sözleşme zorunluluğu | Süreye yayılan işte sözleşme zorunlu (Tebliğ m.4/5): dayanak kontrolünde hatırlatılır, evrak adı "Sözleşme" olur, ödeme ekranı sözleşmeyi varsayılan yapar ve yoksa uyarır | Tebliğ m.4/5 | Doğrulandı, uygulandı | `sihirbaz.ts` `sozlesmeZorunlu` |
| 12 | Onay belgesinde ödenek ve tertip | Onay belgesi ödenek ve tertibi gösterir | Doğrudan Temin Tebliği m.3/1-g tanımı | Doğrulandı | `basamaklar.ts` `onayBelgesiKontrolleri` |
| 13 | Görev çakışması (muayene) | Piyasa görevlisi muayene komisyonundaysa uyarı; harcama yetkilisi/gerçekleştirme görevlisi komisyondaysa engel | Görev ayrılığı ilkesi; harcama yetkilisi/gerçekleştirme görevlisinin komisyonda yer alamayacağına dair doğrudan temin özelinde açık hüküm bu turda doğrulanmadı | Doğrulanamadı (uygulama kuralı) | `muayene.ts` `dosyaKomisyonuKontrolleri`, `personel.ts` `gorevKontrolleri` |
| 14 | Yetkililer piyasa araştırmasında | Harcama yetkilisi ve gerçekleştirme görevlisi piyasa araştırmasında yer alırsa engel | Kodda "5018 ve 4734 gereği" deniyor; açık hüküm bulunamadı | Doğrulanamadı | `PiyasaTutanagi.tsx`, `personel.ts` |
| 15 | Yasaklılık sorgusunun eskimesi | 90 günden eski sorgu uyarılır | Mevzuat değil, uygulama tercihi. Tebliğ m.4/8 kontrolü her 22/d alımında ister | Uygulama kuralı | `tedarikci.ts` `SORGU_ESKIME_GUNU` |
| 16 | Belge tarih sırası | İhtiyaç onayından KİK bildirimine 11 çiftlik zincir; ihlal uyarıdır, engel değil | Uygulama kuralı | Uygulama kuralı | `basamaklar.ts` `tarihSirasiKontrolleri` |
| 17 | Dosyanın kapanışı | Evrak listesi eksiksiz değilse dosya tamamlandı yapılmaz; ödeme kaydedilir, dosya ödeme aşamasında kalır | Uygulama kuralı (denetim dosyası bütünlüğü) | Uygulama kuralı | `dosya.ts` `kapanisEksikleri`, `OdemeBasamagi.tsx` |

### 2. Ödemeye ilişkin diğer mevzuat

| # | Konu | Koddaki kural | Kaynak | Durum | Kod yeri |
|---|------|---------------|--------|-------|----------|
| 18 | Ödenek yeterliliği | KDV dahil tutar kullanılabilir ödeneği aşarsa onay belgesi onaylanmaz | 5018 md. 20/(d) ("bütçelerinde yer alan ödeneklerin üzerinde harcama yapamaz"). 4734 md. 5'teki "ödeneği bulunmayan hiçbir iş için ihaleye çıkılamaz" hükmünün doğrudan temine uygulanması yorumdur | Doğrulandı (md. 20/d) | `basamaklar.ts` `onayBelgesiKontrolleri` |
| 19 | Vergi borcu sorgusu | KDV dahil ödeme ₺5.000'i aşarsa sorgu gerekli; eşik Parametreler'den (`vergiBorcuSorguEsigi`) | 6183 md. 22/A; Tahsilat Genel Tebliği Seri A No 1, değişik Seri A No 12 (RG 03.03.2020, 2.000→5.000) ve Seri A No 17 (RG 05.09.2024, yürürlük 01.10.2024) | İkincil kaynak (tebliğ metni açılamadı; 2025–2026'da artış bulunamadı; KDV dahil/hariç tebliğde açık değil, uygulama KDV dahil brütü esas alır) | `odeme.ts` `borcSorgusuGerekli` |
| 20 | SGK borç sorgusu | Tutar sınırı yok; her ödemede sorgu; "gerekmiyor" seçilirse uyarı | 5510 md. 90; SGK Prim ve İdari Para Cezası Borçlarının Hakedişlerden Mahsubu... Yönetmeliği (RG 29.09.2008) md. 6 parasal sınır koymuyor. Not: RG 16.10.2026'da Kamu İhale Genel Tebliği 17.3.2/17.4.1'deki 5.000→50.000 TL değişikliği (yürürlük 15.11.2026) isteklinin değerlendirilmesine ilişkindir, ödeme sorgusuna değil | İkincil kaynak (yönetmelik özetinden) | `odeme.ts` `borcSorgusuGerekli` |
| 21 | KDV tevkifat oranları | Bakım onarım 7/10, temizlik 9/10, yemek 5/10, işgücü 9/10, mal teslimi 2/10 | KDV GUT I/C-2.1.3.2.3, .10, .4, .5 (Seri No: 35 değişikliği, 2021); mal teslimi için KDV GUT I/C-2.1.3.3.7 | İkincil kaynak; mal teslimi 2/10: idarenin uygulaması, kullanıcı teyidi (19.10.2026); birincil metin açılamadı | `odeme.ts` `TEVKIFAT_TURLERI`, `odemeOlustur` |
| 22 | Tevkifat sınırı | KDV dahil bedel sınırı aşarsa tevkifat; varsayılan ₺12.000 (2026) | Fatura düzenleme sınırı; 2025'te ₺9.900 | İkincil kaynak | `odeme.ts` `odemeHesabi`, Parametreler |
| 23 | Sözleşme damga vergisi | Binde 9,48, yalnızca sözleşme varsa | 488 sayılı Kanun, 1 sayılı tablo I | Doğrulandı | `kurallar.ts` `damgaVergisi` |
| 24 | Makbuz damga vergisi | Binde 9,48, her ödemede, KDV hariç bedele | 1 sayılı tablo IV: resmi dairelerin mal ve hizmet alımı ödemelerinde verilen makbuzlar | Doğrulandı (GİB tablosu, Ekim 2025) | `kurallar.ts` `damgaVergisi` |
| 25 | Karar pulu | Binde 5,69; uygulanıp uygulanmayacağı ayar (varsayılan: uygulanmaz) | Oran 1 sayılı tablo II'de var. Doğrudan teminde uygulanması tartışmalı: Sayıştay 5. Daire (2008) gerekmediği görüşünde, bazı yazarlar onay belgesinin karar sayılacağı görüşünde | Doğrulanamadı | Parametreler |
| 26 | Bütçe tertibi | "kurumsal · fonksiyonel · finansman · ekonomik" sırası (analitik bütçe sınıflandırması) | Uygulama kuralı | Uygulama kuralı | `parametreler.ts` `butceTertibi` |

## Bu kontrolde koda yapılan düzeltmeler

1. **Bölme yasağı:** Ana paneldeki uyarı ve kod açıklaması 4734 md. 5'e atıf yapacak şekilde düzeltildi.
2. **KİK bildirimi:** Bildirim artık bentten bağımsız olarak her dosyada isteniyor. Raporlar ekranı siparişi verilmiş tüm alımları son günleriyle gösteriyor; son günü geçen bildirim "Gecikti" olarak işaretleniyor. Bunun sonucunda 22/d dosyaları da KİK bildirimi işaretlenmeden kapanmıyor.
3. **%10 sınırı:** Parametreler'deki açıklama md. 62/ı'ya göre düzeltildi. Sınırın 21 ve 22. maddelerin tamamını kapsadığı kod açıklamasına not edildi.
4. **22/c sözleşmesi:** Sözleşme işaretlenmemiş 22/c ödemelerinde uyarı gösteriliyor. (19.10.2026'da kapsam 22/d'ye daraltıldığı için kaldırıldı; bkz. madde 13.)
5. **Tevkifat sınırı:** Örnek ayarlara 2026 için ₺12.000 girildi. Bu değer, daha önce kurulmuş veritabanlarında Parametreler'den elle girilmeli.

### 19.10.2026

6. **Ödenek atfı:** Ödenek yeterliliği atfı md. 31'den 5018 md. 20/(d)'ye düzeltildi.
7. **Ödeme emrinde KDV:** Ödeme emrinde KDV'nin hesaba katılması sağlandı (`odemeHesabi`/`oebSatirlari`).
8. **Yasaklılık evrakı:** Yasaklılık evrakı tutanağın onayından değil, sorgu tarihinden hesaplanıyor.
9. **Eksik evrakla kapanma:** Evrak listesi eksikken dosyanın tamamlandı yapılması engellendi.
10. **Vergi borcu sorgusu eşiği:** Vergi borcu sorgusu eşiği (`vergiBorcuSorguEsigi`) Parametreler'den uygulanıyor.
11. **Kapsam daraltıldı:** Uygulama kapsamı yalnız 22/d'ye daraltıldı; diğer bentler seçilemiyor, eski 22/d dışı kayıtlar silinmeden gizleniyor (`gorunurluk.ts`).
12. **Bente göre rapor dökümü kaldırıldı:** Raporlardaki bente göre döküm kapsam daralması nedeniyle kaldırıldı.
13. **22/c sözleşme kuralı kaldırıldı:** Sözleşme zorunluluğu yalnız süreye yayılan işe bağlandı (`sozlesmeZorunlu`, Tebliğ m.4/5).

## Açık işler

- **Hizmet tevkifat oranları:** Oranların (7/10, 9/10, 5/10, 9/10) güncel konsolide metinle teyidi.
- **Yetkililerin görevi:** Yetkililerin piyasa araştırması/muayene komisyonunda yer alamayacağı kuralının dayanağı.
- **Vergi borcu eşiği:** Eşiğin KDV dahil/hariç uygulanışı muhasebe biriminden teyit edilmeli.
- **Resmi metinlerle teyit:** Tevkifat oranları ve sınırı GİB'in güncel KDV Genel Uygulama Tebliği metninden doğrulanmalı.
- **Karar pulu:** Muhasebe birimiyle netleştirilmeli. Gerekirse GİB'den özelge istenmeli.
- **Bende özgü kurallar:** Kapsam 22/d'ye daraltıldığı için (ürün kararı, 19.10.2026) 22/f–22/i bentlerine özgü kurallar artık planlanmıyor; bu madde kapatıldı.

### Kapatılanlar (17.10.2026)

- 22/f, g, h, ı ve i bentleri eklendi. `alimlar` tablosu yeniden kuruldu (şema göçü 7). Göç, masaüstü veritabanının bir kopyasında yabancı anahtarlar açıkken denendi. (19.10.2026'da kapsam 22/d'ye daraltıldı; bu bentler uygulamada gösterilmez.)
- EKAP doğrudan temin kayıt numarası alanı eklendi.
- Süreye yayılan işlerde sözleşme zorunluluğu uygulandı.

### Kapatılanlar (19.10.2026)

- **Mal alımlarında tevkifat:** Kamu idaresi mal alımlarında KDV GUT I/C-2.1.3.3.7 "diğer teslimler" 2/10 tevkifatı, kullanıcı teyidiyle uygulandı; birincil metin teyidi açık.

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
- Doğrudan Temin Tebliği değişikliği (RG 11.07.2023): https://resmigazete.gov.tr/eskiler/2023/07/20230711-10.htm
- SGK hakediş mahsup yönetmeliği (RG 29.09.2008): https://www.resmigazete.gov.tr/eskiler/2008/09/20080929M2-3.htm
- KDV GUT Seri No 35 (RG 16.02.2021): https://www.resmigazete.gov.tr/eskiler/2021/02/20210216-6.htm
- 5018 sayılı Kanun: https://www.mevzuat.gov.tr/anasayfa/MevzuatFihristDetayIframe?MevzuatTur=1&MevzuatNo=5018&MevzuatTertip=5
