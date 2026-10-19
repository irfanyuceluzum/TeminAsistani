// Veritabanı yedekleme ve geri yükleme komutları.
// Tüm iç yollar app_config_dir()'den türetilir; kullanıcı yolu yalnız kaynak/hedef dosyadır.

use serde::Serialize;
use std::ffi::OsString;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::Manager;

const SQLITE_BASLIK: &[u8; 16] = b"SQLite format 3\0";
const ONEK_OTOMATIK: &str = "otomatik-";
const ONEK_GERI_YUKLEME: &str = "geri-yukleme-oncesi-";
const ONEK_GECICI: &str = ".gecici-";

#[derive(Serialize)]
pub struct YedekDizini {
    pub dizin: String,
    pub gecici: String,
    pub son_otomatik: Option<String>,
}

// ---------- Ortak yardımcılar ----------

fn ayar_dizini(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Uygulama veri klasörü bulunamadı: {e}"))
}

fn canli_db(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(ayar_dizini(app)?.join("temin.db"))
}

fn yedekler_dizini(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    Ok(ayar_dizini(app)?.join("yedekler"))
}

// Yola ek ekler (ör. "-wal", ".tmp"); uzantıyı değiştirmez.
fn ekle(yol: &Path, ek: &str) -> PathBuf {
    let mut s: OsString = yol.as_os_str().to_owned();
    s.push(ek);
    PathBuf::from(s)
}

fn onek_gecerli_mi(onek: &str) -> bool {
    onek == ONEK_OTOMATIK || onek == ONEK_GERI_YUKLEME
}

// `yol`, doğrudan `dizin` içinde ve adı `onek` ile başlıyorsa true.
fn dizin_icinde_onekli_mi(dizin: &Path, yol: &Path, onek: &str) -> bool {
    if yol.parent() != Some(dizin) {
        return false;
    }
    match yol.file_name().and_then(|a| a.to_str()) {
        Some(ad) => ad.starts_with(onek),
        None => false,
    }
}

fn dolu_mu(yol: &Path) -> bool {
    fs::metadata(yol).map(|m| m.len() > 0).unwrap_or(false)
}

fn baslik_dogrula(yol: &Path) -> Result<(), String> {
    let meta = fs::metadata(yol).map_err(|_| "Yedek dosyası bulunamadı.".to_string())?;
    if !meta.is_file() || meta.len() == 0 {
        return Err("Yedek dosyası boş ya da geçersiz.".to_string());
    }
    let mut dosya = fs::File::open(yol).map_err(|e| format!("Yedek dosyası açılamadı: {e}"))?;
    let mut baslik = [0u8; 16];
    dosya
        .read_exact(&mut baslik)
        .map_err(|_| "Dosya bir SQLite veritabanı değil.".to_string())?;
    if &baslik != SQLITE_BASLIK {
        return Err("Dosya bir SQLite veritabanı değil.".to_string());
    }
    if dolu_mu(&ekle(yol, "-wal")) {
        return Err("Yedeğin yanında kaydedilmemiş değişiklik dosyası (-wal) var; yedeği uygulamanın Yedek al düğmesiyle alın.".to_string());
    }
    if dolu_mu(&ekle(yol, "-journal")) {
        return Err("Yedeğin yanında kaydedilmemiş değişiklik dosyası (-journal) var; yedeği uygulamanın Yedek al düğmesiyle alın.".to_string());
    }
    Ok(())
}

// Kopyalar ve diske yazılmasını bekler.
fn kopyala_senkron(kaynak: &Path, hedef: &Path) -> Result<(), String> {
    fs::copy(kaynak, hedef).map_err(|e| format!("Dosya kopyalanamadı: {e}"))?;
    let dosya = fs::OpenOptions::new()
        .write(true)
        .open(hedef)
        .map_err(|e| format!("Kopya açılamadı: {e}"))?;
    dosya
        .sync_all()
        .map_err(|e| format!("Kopya diske yazılamadı: {e}"))
}

// hedef + ".tmp"'ye kopyalar, sonra üzerine yazarak yeniden adlandırır.
// Hata olursa tmp silinir; var olan hedefe dokunulmaz.
fn atomik_kopya(kaynak: &Path, hedef: &Path) -> Result<(), String> {
    let tmp = ekle(hedef, ".tmp");
    let sonuc = kopyala_senkron(kaynak, &tmp).and_then(|_| {
        fs::rename(&tmp, hedef).map_err(|e| format!("Dosya yerine konamadı: {e}"))
    });
    if sonuc.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    sonuc
}

// Dizindeki `onek...db` dosya adlarını ada göre (eskiden yeniye) sıralı döner.
fn onekli_db_adlari(dizin: &Path, onek: &str) -> Result<Vec<String>, String> {
    let okuyucu = match fs::read_dir(dizin) {
        Ok(o) => o,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("Yedek klasörü okunamadı: {e}")),
    };
    let mut adlar = Vec::new();
    for girdi in okuyucu.flatten() {
        let tur = match girdi.file_type() {
            Ok(t) => t,
            Err(_) => continue,
        };
        if !tur.is_file() {
            continue;
        }
        if let Some(ad) = girdi.file_name().to_str() {
            if ad.starts_with(onek) && ad.ends_with(".db") {
                adlar.push(ad.to_string());
            }
        }
    }
    adlar.sort();
    Ok(adlar)
}

fn budama(dizin: &Path, onek: &str, sakla: usize) -> Result<usize, String> {
    let adlar = onekli_db_adlari(dizin, onek)?;
    if adlar.len() <= sakla {
        return Ok(0);
    }
    let silinecek = adlar.len() - sakla;
    let mut silinen = 0;
    for ad in adlar.iter().take(silinecek) {
        if fs::remove_file(dizin.join(ad)).is_ok() {
            silinen += 1;
        }
    }
    Ok(silinen)
}

// "otomatik-YYYY-AA-GG.db" adlarından en yeni tarih.
fn son_otomatik_tarih(dizin: &Path) -> Result<Option<String>, String> {
    let adlar = onekli_db_adlari(dizin, ONEK_OTOMATIK)?;
    let tarih_mi = |t: &str| {
        let b = t.as_bytes();
        b.len() == 10
            && b.iter()
                .enumerate()
                .all(|(i, c)| if i == 4 || i == 7 { *c == b'-' } else { c.is_ascii_digit() })
    };
    Ok(adlar
        .iter()
        .filter_map(|ad| ad.strip_prefix(ONEK_OTOMATIK)?.strip_suffix(".db"))
        .filter(|t| tarih_mi(t))
        .max()
        .map(|t| t.to_string()))
}

// 5'teki (a) ve (b) ile (c): hiçbir şeye yazmaz.
fn on_denetim(app: &tauri::AppHandle, kaynak: &Path, oncesi: &Path) -> Result<(), String> {
    let dizin = yedekler_dizini(app)?;
    if !dizin_icinde_onekli_mi(&dizin, oncesi, ONEK_GERI_YUKLEME) || !dolu_mu(oncesi) {
        return Err("Geri yükleme öncesi yedek bulunamadı ya da boş; işlem yapılmadı.".to_string());
    }
    baslik_dogrula(kaynak)?;
    journal_denetle(app)
}

fn journal_denetle(app: &tauri::AppHandle) -> Result<(), String> {
    if dolu_mu(&ekle(&canli_db(app)?, "-journal")) {
        return Err("Veritabanında yarım kalmış bir işlem var; geri yükleme yapılamaz.".to_string());
    }
    Ok(())
}

// (c)–(f): geçici kopya, yan dosyaları silme, yeniden adlandırma.
fn uygula(app: &tauri::AppHandle, kaynak: &Path) -> Result<(), String> {
    journal_denetle(app)?;
    let canli = canli_db(app)?;
    let yeni = ekle(&canli, ".yeni");
    let sonuc = (|| {
        kopyala_senkron(kaynak, &yeni)?;
        for ek in ["-journal", "-wal", "-shm"] {
            let yan = ekle(&canli, ek);
            if yan.exists() {
                fs::remove_file(&yan).map_err(|e| format!("Yan dosya silinemedi: {e}"))?;
            }
        }
        fs::rename(&yeni, &canli).map_err(|e| format!("Veritabanı yerine konamadı: {e}"))
    })();
    if sonuc.is_err() {
        let _ = fs::remove_file(&yeni);
    }
    sonuc
}

// Hata olursa stderr'e yazar; her durumda uygulamayı yeniden başlatır.
fn uygula_ve_baslat(app: &tauri::AppHandle, kaynak: &Path) -> ! {
    if let Err(hata) = uygula(app, kaynak) {
        eprintln!("Geri yükleme başarısız: {hata}");
    }
    app.restart()
}

// ---------- Komutlar ----------

#[tauri::command]
pub fn yedek_dizini_hazirla(app: tauri::AppHandle) -> Result<YedekDizini, String> {
    let dizin = yedekler_dizini(&app)?;
    fs::create_dir_all(&dizin).map_err(|e| format!("Yedek klasörü oluşturulamadı: {e}"))?;
    let ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let gecici = dizin.join(format!("{ONEK_GECICI}{ms}.db"));
    if gecici.exists() {
        let _ = fs::remove_file(&gecici);
    }
    Ok(YedekDizini {
        dizin: dizin.to_string_lossy().into_owned(),
        gecici: gecici.to_string_lossy().into_owned(),
        son_otomatik: son_otomatik_tarih(&dizin)?,
    })
}

#[tauri::command]
pub fn eski_yedekleri_sil(app: tauri::AppHandle, onek: String, sakla: usize) -> Result<usize, String> {
    if !onek_gecerli_mi(&onek) {
        return Err("Geçersiz yedek öneki.".to_string());
    }
    budama(&yedekler_dizini(&app)?, &onek, sakla)
}

#[tauri::command]
pub fn yedegi_yerlestir(app: tauri::AppHandle, gecici: String, hedef: String) -> Result<(), String> {
    let dizin = yedekler_dizini(&app)?;
    let gecici = PathBuf::from(gecici);
    if !dizin_icinde_onekli_mi(&dizin, &gecici, ONEK_GECICI) {
        return Err("Geçersiz geçici yedek yolu.".to_string());
    }
    atomik_kopya(&gecici, Path::new(&hedef))?;
    let _ = fs::remove_file(&gecici);
    Ok(())
}

#[tauri::command]
pub fn yedek_dogrula(yol: String) -> Result<(), String> {
    baslik_dogrula(Path::new(&yol))
}

#[tauri::command]
pub fn geri_yukleme_on_denetim(app: tauri::AppHandle, kaynak: String, oncesi: String) -> Result<(), String> {
    on_denetim(&app, Path::new(&kaynak), Path::new(&oncesi))
}

#[tauri::command]
pub fn yedekten_don(app: tauri::AppHandle, kaynak: String, oncesi: String) -> Result<(), String> {
    let kaynak = PathBuf::from(kaynak);
    // (a)–(c) başarısızsa da uygulama yeniden başlatılır (JS bağlantıyı kapatmıştır).
    if let Err(hata) = on_denetim(&app, &kaynak, Path::new(&oncesi)) {
        eprintln!("Geri yükleme başarısız: {hata}");
        app.restart();
    }
    uygula_ve_baslat(&app, &kaynak)
}

#[tauri::command]
pub fn son_yedege_don(app: tauri::AppHandle) -> Result<(), String> {
    let dizin = yedekler_dizini(&app)?;
    let adlar = onekli_db_adlari(&dizin, ONEK_GERI_YUKLEME)?;
    let en_yeni = adlar
        .last()
        .ok_or_else(|| "Geri yükleme öncesi yedek bulunamadı.".to_string())?;
    let kaynak = dizin.join(en_yeni);
    baslik_dogrula(&kaynak)?;
    journal_denetle(&app)?;
    uygula_ve_baslat(&app, &kaynak)
}

#[cfg(test)]
mod testler {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    static SAYAC: AtomicU32 = AtomicU32::new(0);

    fn gecici_dizin() -> PathBuf {
        let n = SAYAC.fetch_add(1, Ordering::SeqCst);
        let ns = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let d = std::env::temp_dir().join(format!("temin-yedek-test-{}-{ns}-{n}", std::process::id()));
        fs::create_dir_all(&d).unwrap();
        d
    }

    fn gecerli_db(yol: &Path) {
        let mut b = SQLITE_BASLIK.to_vec();
        b.extend_from_slice(&[0u8; 100]);
        fs::write(yol, b).unwrap();
    }

    #[test]
    fn onek_kontrolu() {
        assert!(onek_gecerli_mi("otomatik-"));
        assert!(onek_gecerli_mi("geri-yukleme-oncesi-"));
        assert!(!onek_gecerli_mi(""));
        assert!(!onek_gecerli_mi("baska-"));

        let d = Path::new("/a/yedekler");
        assert!(dizin_icinde_onekli_mi(d, &d.join(".gecici-1.db"), ".gecici-"));
        assert!(!dizin_icinde_onekli_mi(d, &d.join("x.db"), ".gecici-"));
        assert!(!dizin_icinde_onekli_mi(d, Path::new("/a/.gecici-1.db"), ".gecici-"));
        assert!(!dizin_icinde_onekli_mi(d, &d.join("alt/.gecici-1.db"), ".gecici-"));
    }

    #[test]
    fn budama_en_yenileri_saklar() {
        let d = gecici_dizin();
        for g in 1..=5 {
            fs::write(d.join(format!("otomatik-2026-01-0{g}.db")), b"x").unwrap();
        }
        fs::write(d.join("baska.txt"), b"x").unwrap();
        let silinen = budama(&d, "otomatik-", 2).unwrap();
        assert_eq!(silinen, 3);
        assert!(d.join("otomatik-2026-01-05.db").exists());
        assert!(d.join("otomatik-2026-01-04.db").exists());
        assert!(!d.join("otomatik-2026-01-01.db").exists());
        assert!(d.join("baska.txt").exists());
        assert_eq!(son_otomatik_tarih(&d).unwrap(), Some("2026-01-05".to_string()));
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn baslik_dogrulama() {
        let d = gecici_dizin();
        let iyi = d.join("iyi.db");
        gecerli_db(&iyi);
        assert!(baslik_dogrula(&iyi).is_ok());

        let bos = d.join("bos.db");
        fs::write(&bos, b"").unwrap();
        assert!(baslik_dogrula(&bos).is_err());

        let yanlis = d.join("yanlis.db");
        fs::write(&yanlis, b"Bu bir SQLite dosyasi degil........").unwrap();
        assert!(baslik_dogrula(&yanlis).is_err());

        assert!(baslik_dogrula(&d.join("yok.db")).is_err());

        fs::write(ekle(&iyi, "-wal"), b"dolu").unwrap();
        assert!(baslik_dogrula(&iyi).is_err());
        fs::write(ekle(&iyi, "-wal"), b"").unwrap();
        assert!(baslik_dogrula(&iyi).is_ok());
        fs::write(ekle(&iyi, "-journal"), b"dolu").unwrap();
        assert!(baslik_dogrula(&iyi).is_err());
        let _ = fs::remove_dir_all(&d);
    }

    #[test]
    fn yerlestirme_var_olani_ezer() {
        let d = gecici_dizin();
        let kaynak = d.join("kaynak.db");
        let hedef = d.join("hedef.db");
        fs::write(&kaynak, b"yeni").unwrap();
        fs::write(&hedef, b"eski").unwrap();
        atomik_kopya(&kaynak, &hedef).unwrap();
        assert_eq!(fs::read(&hedef).unwrap(), b"yeni");
        assert!(!ekle(&hedef, ".tmp").exists());

        // Kaynak yoksa hedef bozulmaz.
        assert!(atomik_kopya(&d.join("yok.db"), &hedef).is_err());
        assert_eq!(fs::read(&hedef).unwrap(), b"yeni");
        assert!(!ekle(&hedef, ".tmp").exists());
        let _ = fs::remove_dir_all(&d);
    }
}
