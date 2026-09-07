# ClariNavi — Vercel Deployment Verification

本包為**唯一正式版**。前端只載入：

- `/app.css`
- `/app.js`

沒有歷史版號 CSS / JS 疊加。

## Vercel 架構
- `/` → `/index.html`，由 Vercel 靜態 CDN 提供。
- `/app.css`、`/app.js`、Manifest、Avatar 與圖示 → 靜態 CDN。
- `/api/*` → `api/index.js` Node.js Function。
- `api/index.js` 依路由 lazy-load `lib/api-handlers/*.js`。
- `server.js` 只供本機 / Railway，不參與 Vercel 首頁載入。

## 本次功能驗收
- ETF 專區存在：清單、搜尋、6 種排行、7 種分類。
- 台股 Top 100：股價 / 漲幅 / 跌幅 / 成交量 / 成交額，合併 / 上市 / 上櫃。
- 排行頁只在頁面可見時每 15 秒刷新。
- ETF 專區只在頁面可見時載入 / 更新。
- 首頁 ETF / 台股排行採 IntersectionObserver 延遲載入，只顯示前 8 名。
- 加權指數卡支援線圖；資料可得時顯示當日價量。
- 個股台股分時：價格線、均價線、成交量柱、分時高低、量比與五檔力道。
- Treemap 熱力圖：面積依成交金額占比，紅漲綠跌。
- 五日板塊：Slider / BAR、日期按鈕、播放 / 停止、前後日、逐日量價流動。
- 三大法人歷史成本：外資 / 投信 / 自營商，顯示實際最早與最新資料日。
- 目標價、本益比河流、供應鏈、投組配置與匿名 Top 10 保留。

## 靜態 / 語法檢查
- `package.json` / `vercel.json` / `manifest.webmanifest`：JSON 可解析。
- `app.js` / `server.js` / `api/index.js`：Node syntax PASS。
- API handlers：29 / 29 syntax PASS。
- HTML ID：247 個，重複 0。
- CSS 大括號：2848 / 2848。
- 首頁只引用 1 個 CSS：`/app.css`。
- 首頁只引用 1 個 JS：`/app.js`。

## API / 模擬測試
- 本機 `/`、`/app.css`、`/app.js`、`/manifest.webmanifest`、`/api/health`：HTTP 200。
- `/api/market-rankings`：HTTP 200；外部來源不可達時回安全空資料，不讓首頁崩潰。
- `/api/etf-market`：HTTP 200；外部來源不可達時回安全空資料。
- Market rankings mock：PASS（TWSE + TPEx + MIS 合併、ETF 排除、排序與盤中價格覆蓋）。
- ETF market mock：PASS（主動式分類、排序、MIS 價格覆蓋）。

## 傳輸大小（Brotli quality 11 估算）
- `index.html`：9.1 KB
- `app.css`：41.6 KB
- `app.js`：104.3 KB
- `manifest.webmanifest`：0.2 KB

## 資料使用提醒
TWSE OpenAPI / 政府資料開放平台授權資料應清楚註明來源。TWSE MIS 是官方基本市況服務，但若要對外公開傳輸 / 加值真正即時或延遲交易資訊，應另確認 TWSE 資訊使用契約與授權範圍。本版因此將 MIS 呈現標為「最佳努力近即時」，不宣稱為券商授權逐筆行情。

## 外部資料測試限制
目前執行環境無法穩定連到 TWSE / TPEx 等外部端點，因此不把「真實市場即時回傳」冒充成已驗證。程式路由、錯誤降級與 mock 計算已通過；實際 Vercel 部署後仍應以你的 Production URL 做一次盤中資料驗收。

## 部署
Vercel Root Directory 必須直接看到：

```text
index.html
app.css
app.js
vercel.json
package.json
api/
lib/
```

Framework Preset 使用 `Other` / 無框架；Build Command 與 Output Directory 留空。

## 首頁輔助工具延遲載入
- 主導覽未放置 portfolio / calendar / ipo / institutional / alerts / news / kol。
- 首頁 `#serviceDock` 提供 8 個輔助功能圖示。
- 對應資料請求由 `showScreen()` / 各服務 loader 在點擊後才執行。
- 手機 `工具` 只定位至首頁工具列，不另外建立重型功能選單。
