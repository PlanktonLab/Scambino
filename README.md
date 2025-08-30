# Scambino - 個人防詐小助理

Scambino 是一個結合大型語言模型（LLM）、網頁前端和瀏覽器擴充功能的綜合性解決方案，旨在幫助使用者即時分析可疑資訊、辨識潛在的網路詐騙，並提供應對步驟指引。

## 專案簡介

在數位時代，詐騙手法日新月異，從假冒的電子郵件到充滿誘惑的投資訊息，無孔不入。Scambino 的目標是成為您身邊的數位保鑣，透過先進的 AI 技術，提供一個易於使用且反應迅速的防詐騙工具。

使用者可以透過兩種主要方式與 Scambino 互動：
1.  **瀏覽器擴充功能**：直接在 Gmail 介面中一鍵分析可疑郵件。
2.  **獨立聊天網頁**：貼上任何來源（如簡訊、社群媒體訊息）的文字，獲得 AI 的即時分析與引導。

## 主要功能

*   **結構化 AI 引導**：後端 AI 經過特殊設計，能以充滿同理心的客服角色，透過結構化的 UI（如步驟、按鈕）引導使用者處理緊急情況。
*   **真實連結提取**：瀏覽器擴充功能在分析郵件時，能自動提取超連結背後的真實網址，揭露偽裝的釣魚連結。
*   **多平台適用性**：除了 Gmail 擴充功能，獨立的聊天網頁讓使用者可以從任何平台複製文字進行分析。
*   **模組化架構**：專案分為前端、後端、擴充功能和分析工具，易於獨立開發、部署和維護。
*   **詐騙情境分類**：內含一個獨立的分析腳本，可使用 Gemini API 對詐騙案例進行分類和關鍵字提取，有助於建立結構化的詐騙資料庫。

## 專案架構

本專案由以下四個主要部分組成：

1.  **`frontend/` - 網頁前端**
    *   技術：HTML, CSS, JavaScript
    *   職責：提供一個與 AI 後端互動的聊天介面。使用者可以在此貼上可疑文字，並接收 AI 回傳的結構化指引。包含一個連線設定面板，用於指定後端 API 位址。

2.  **`LLM/` - AI 聊天後端**
    *   技術：Python, Flask
    *   職責：作為 AI 的大腦。它接收來自前端或擴充功能的請求，呼叫本地運行的 TAIDE 大型語言模型進行分析，並根據 `system_prompt.txt` 中定義的規則和知識庫，回傳結構化的 JSON 回應給前端。

3.  **`extension/` - 瀏覽器擴充功能**
    *   技術：JavaScript (Chrome Extension Manifest V3)
    *   職責：目前針對 `mail.google.com`。它會在 Gmail 頁面注入一個 Scambino 按鈕，使用者點擊後，會自動抓取當前郵件的文字內容（包含真實連結），並傳送給 AI 後端進行分析。

4.  **`database/` - 資料庫與分析工具**
    *   技術：Python, Google Gemini API
    *   職責：包含用於詐騙資料管理的工具。`analyzer.py` 是一個範例，它能呼叫 Gemini API，將一段詐騙描述文字進行自動分類並提取關鍵字。

## 安裝與啟動

### 1. AI 聊天後端 (`LLM/`)

後端服務是整個系統的核心，請先啟動它。

```bash
# 進入後端資料夾
cd LLM/

# (建議) 建立並啟用 Python 虛擬環境
python -m venv venv
source venv/bin/activate # macOS/Linux
# venv\Scripts\activate # Windows

# 安裝必要的套件 (請自行建立 requirements.txt)
# 範例：pip install Flask

# 根據 app.py 中的指示，設定 TAIDE 模型的路徑
# GENIE_BUNDLE_PATH = Path(r"C:\Users\...")

# 啟動 Flask 伺服器
python app.py
```
伺服器預設會在 `http://0.0.0.0:5000` 上運行。

### 2. 網頁前端 (`frontend/`)

前端是一個靜態網頁，可以直接在瀏覽器中開啟，或透過本地伺服器運行。

*   **直接開啟**：在檔案總管中找到 `frontend/index.html` 並用瀏覽器開啟。
*   **啟動後**：點擊頁面右上角的齒輪圖示，在「連線設定」中確認後端 API 位址是否正確（例如 `http://localhost:5000`），然後點擊「啟動對話」。

### 3. 瀏覽器擴充功能 (`extension/`)

1.  開啟 Chrome 瀏覽器，前往 `chrome://extensions/`。
2.  啟用右上角的「開發人員模式」。
3.  點擊「載入未封裝項目」。
4.  選擇本專案中的 `extension` 資料夾。
5.  安裝完成後，請確保 `extension/background.js` 或相關腳本中呼叫的後端 API 位址是正確的。

## 如何使用

1.  **分析 Gmail 郵件**：
    *   在 Chrome 中打開 Gmail。
    *   點開一封您覺得可疑的郵件。
    *   在郵件工具列（「列印」圖示旁）找到並點擊 Scambino 的圖示按鈕。
    *   擴充功能會將郵件內容傳送至後端，並在分析完成後給予提示。（注意：分析結果的呈現方式需進一步開發）

2.  **分析其他文字**：
    *   打開 `frontend/index.html` 網頁。
    *   將您從任何地方（如 LINE, Facebook, SMS）收到的可疑文字貼到輸入框中。
    *   點擊傳送按鈕。
    *   AI 將會分析您的文字，並在聊天視窗中提供逐步的引導和建議。

## 貢獻

歡迎對本專案提出改進建議或直接貢獻程式碼。您可以透過以下方式參與：
1.  Fork 本專案。
2.  建立您的功能分支 (`git checkout -b feature/AmazingFeature`)。
3.  提交您的變更 (`git commit -m 'Add some AmazingFeature'`)。
4.  將分支推送到遠端 (`git push origin feature/AmazingFeature`)。
5.  開啟一個 Pull Request。

## 授權條款

本專案採用 [LICENSE](LICENSE) 中定義的授權條款。
