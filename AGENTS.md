# AGENTS.md

給在這個 repo 工作的 AI agent 與人類開發者的工作守則。

## 專案是什麼

「人生資產負債表」靜態網頁：使用者填入收入、資產、負債，網頁算出淨值、人生淨值（含未來收入）、壓力測試與建議。產品行為的唯一依據是 `docs/spec.md`。

## 指令

```bash
npm test          # 執行所有測試（Node 內建 test runner，零依賴）
npm run serve     # 在 http://localhost:8000 預覽
```

改完任何東西都要跑 `npm test`，全部通過才算完成。CI 失敗時不會部署。

## 結構

```
index.html            頁面骨架（只能引用本地檔案）
src/calc.js           純計算：資產負債、壓力測試、借錢試算
src/advice.js         建議規則：RULES 陣列、健康分數
src/format.js         數字格式化（萬／億、百分比）
src/examples.js       範例資料（同時被評測使用）
src/app.js            唯一可以碰 DOM 與 localStorage 的檔案
docs/spec.md          規格：觀念來源、計算定義、規則表
tests/                單元測試、評測、不變量
tests/fixtures/personas.js  評測集
```

## 不變量（測試會檢查）

1. `calc.js`、`advice.js`、`format.js`、`examples.js` 不得使用 `document`、`window`、`localStorage`、`fetch`。
2. `src/` 不得發出任何網路請求；`index.html` 不得載入外部資源。使用者財務資料不能離開瀏覽器。
3. 每條規則的 `id` 唯一，`sources` 只能是 `general` 或 `mm:ss` 時間戳。
4. 每條規則都要出現在 `docs/spec.md` 的規則表中。
5. 每條規則至少被一個 persona 的 `mustInclude` 覆蓋。
6. 建議文字不得出現 `undefined` 或 `NaN`。

## 新增或修改一條建議規則

1. 在 `docs/spec.md` 第 3 節加一列：id、嚴重度、觸發條件、來源。
2. 在 `src/advice.js` 的 `RULES` 加入規則，`sources` 與 spec 一致。
3. 在 `tests/fixtures/personas.js` 新增或調整 persona，讓規則被 `mustInclude` 覆蓋；若有容易誤觸發的情境，也寫進其他 persona 的 `mustExclude`。
4. 跑 `npm test`。

## 修改計算公式

1. 先改 `docs/spec.md` 第 2 節的定義。
2. 在 `tests/calc.test.js` 加入能驗算的案例（優先用節目中的數字，例如年金現值 ≈ 117.4 萬）。
3. 再改 `src/calc.js`。

## 寫作慣例

- 介面文字使用繁體中文（台灣用語），金額以「萬／億」顯示。
- 建議文字要具體、可行動，並引用節目觀念；不要給出保證報酬或明確買賣標的。
- 節目沒說的數字（DSR 門檻、折現率等）標為 `general`，並寫在 spec 第 5 節。
- 不加入任何 npm 依賴或建置步驟，除非有非常充分的理由。
