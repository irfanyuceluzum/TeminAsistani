import { defineConfig, devices } from "@playwright/test";

// Uçtan uca testler uygulamanın tarayıcı sürümünü örnek veriyle (bellekDepo) sürer; masaüstü ve SQLite kapsam dışıdır.
// `npm run tauri dev` açıksa onun 1420 sunucusu kullanılır, değilse Vite başlatılır.
export default defineConfig({
  testDir: "e2e",
  testMatch: /.*\.e2e\.ts$/,
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: "e2e/sonuclar",
  use: {
    baseURL: "http://localhost:1420",
    viewport: { width: 1440, height: 900 },
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:1420",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
