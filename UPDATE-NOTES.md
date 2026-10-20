# 更新記錄

來源：`dice-cup-duel-hk(2).zip`（2026-10-20）

本次將新版封存檔中的 10 個檔案更新至公開儲存庫。相較更新前，`app.js`、`index.html`、`style.css` 有變更；其餘 7 個遊戲資源檔內容一致。保留了遠端主分支原有的近期遊戲更新，並以此封存檔指定的三個介面／程式檔案作為最新版本。

## 網頁分享準備

- 新增 `favicon.svg`：深綠底金色骰盅圖示。
- 新增 `share-card.png`：1200×630 社群分享預覽圖。
- `index.html` 加入 Open Graph、X/Twitter 預覽描述與 canonical URL。
- 新增 `.github/workflows/pages.yml`：主分支更新時自動部署 GitHub Pages。
- Pages 站點仍需在儲存庫 Settings → Pages 將建置來源設為 GitHub Actions；目前授權無法變更此設定。
