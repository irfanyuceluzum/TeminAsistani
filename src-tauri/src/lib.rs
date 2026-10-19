mod yedek;

use tauri_plugin_sql::{Migration, MigrationKind};

fn gocler() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "ilk_sema",
            sql: include_str!("../migrations/0001_ilk_sema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "piyasa_arastirmasi",
            sql: include_str!("../migrations/0002_piyasa_arastirmasi.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "denetim_izi_ve_evrak",
            sql: include_str!("../migrations/0003_denetim_izi_ve_evrak.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "muayene",
            sql: include_str!("../migrations/0004_muayene.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "odeme",
            sql: include_str!("../migrations/0005_odeme.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "tedarikci_bilgileri",
            sql: include_str!("../migrations/0006_tedarikci_bilgileri.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "tum_bentler_ekap_sureli_is",
            sql: include_str!("../migrations/0007_tum_bentler_ekap_sureli_is.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "dosya_basamaklari",
            sql: include_str!("../migrations/0008_dosya_basamaklari.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:temin.db", gocler())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            yedek::yedek_dizini_hazirla,
            yedek::eski_yedekleri_sil,
            yedek::yedegi_yerlestir,
            yedek::yedek_dogrula,
            yedek::geri_yukleme_on_denetim,
            yedek::yedekten_don,
            yedek::son_yedege_don,
        ])
        .run(tauri::generate_context!())
        .expect("Temin Asistanı başlatılamadı");
}
