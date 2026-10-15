const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.js",
  use: {
    baseURL: "http://127.0.0.1:8000",
    browserName: "chromium",
  },
  webServer: {
    command: "python3 -m http.server 8000 --bind 127.0.0.1 --directory ../pages",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: !process.env.CI,
  },
});
