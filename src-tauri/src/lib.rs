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
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:temin.db", gocler())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("Temin Asistanı başlatılamadı");
}
