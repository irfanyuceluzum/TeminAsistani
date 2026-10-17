-- Basamaklı alım dosyasına özgü bilgiler tek belge olarak (JSON) tutulur:
-- şartlar, lüzum onayı, fiyat isteme yazısı ve yaklaşık maliyet cetveli.

CREATE TABLE dosya_basamaklari (
  alim_id TEXT PRIMARY KEY REFERENCES alimlar(id),
  belge TEXT NOT NULL,
  guncelleme TEXT NOT NULL
);
