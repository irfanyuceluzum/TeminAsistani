-- Firma kartı için kimlik, iletişim ve ödeme bilgileri.

ALTER TABLE tedarikciler ADD COLUMN vkn TEXT NOT NULL DEFAULT '';
ALTER TABLE tedarikciler ADD COLUMN vergi_dairesi TEXT NOT NULL DEFAULT '';
ALTER TABLE tedarikciler ADD COLUMN telefon TEXT NOT NULL DEFAULT '';
ALTER TABLE tedarikciler ADD COLUMN eposta TEXT NOT NULL DEFAULT '';
ALTER TABLE tedarikciler ADD COLUMN iban TEXT NOT NULL DEFAULT '';
ALTER TABLE tedarikciler ADD COLUMN adres TEXT NOT NULL DEFAULT '';
