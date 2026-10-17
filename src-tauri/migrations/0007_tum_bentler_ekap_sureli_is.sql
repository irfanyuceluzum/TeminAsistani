-- 22. maddenin tüm bentleri (a'dan i'ye), EKAP doğrudan temin kayıt numarası ve
-- "teslimi belli süre gerektiren iş" işareti (Doğrudan Temin Tebliği m.4/5, m.5/1).
--
-- Tablo yeniden kurulmaz: olaylar, evraklar ve diğer tablolar alimlar'a yabancı anahtarla bağlı,
-- göç bir işlem içinde çalıştığı için yabancı anahtar denetimi kapatılamıyor. Bunun yerine
-- SQLite belgelerindeki yöntemle yalnızca CHECK kısıtının metni değiştirilir (diskteki biçimi
-- etkilemez). RESET bu bağlantının şemayı yeniden okumasını sağlar; ardından gelen ALTER TABLE
-- şema sürümünü artırır, havuzdaki diğer bağlantılar da şemayı yeniden okur.

PRAGMA writable_schema = ON;

UPDATE sqlite_master
SET sql = replace(
  sql,
  'CHECK (bent IN (''22/a'', ''22/b'', ''22/c'', ''22/d'', ''22/e''))',
  'CHECK (bent IN (''22/a'', ''22/b'', ''22/c'', ''22/d'', ''22/e'', ''22/f'', ''22/g'', ''22/h'', ''22/ı'', ''22/i''))'
)
WHERE type = 'table' AND name = 'alimlar';

PRAGMA writable_schema = RESET;

ALTER TABLE alimlar ADD COLUMN ekap_no TEXT NOT NULL DEFAULT '';
ALTER TABLE alimlar ADD COLUMN sureli_is INTEGER NOT NULL DEFAULT 0;
