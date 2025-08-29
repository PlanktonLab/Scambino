// scambino.js － 純前端版（僅 JS）
// 需求：頁面需已存在以下元素與圖片：
// #chat #sendBtn #clearBtn #userInput
// #settingsBtn #settingsModal #modalBackdrop #closeSettings
// #apiKey #model #startBtn #status #systemPrompt
// 並備妥 img/user.png、img/bot.png、img/step.png

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

// 以 fetch 載入 prompt.txt（與 HTML 同資料夾）
let DEFAULT_SYSTEM_PROMPT = "";
try {
  const res = await fetch("prompt.txt", { cache: "no-store" });
  DEFAULT_SYSTEM_PROMPT = (await res.text()).trim();
} catch (e) {
  console.warn("載入 prompt.txt 失敗，將使用空字串：", e);
  DEFAULT_SYSTEM_PROMPT = "";
}

// ===== DOM =====
const chatEl = document.getElementById("chat");
const sendBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const userInputEl = document.getElementById("userInput");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeSettings = document.getElementById("closeSettings");

const apiKeyEl = document.getElementById("apiKey");
const modelEl = document.getElementById("model");
const startBtn = document.getElementById("startBtn");
const statusEl = document.getElementById("status");
const systemPromptTextarea = document.getElementById("systemPrompt");

// 初始化 system prompt 到面板（可編輯）
systemPromptTextarea.value = DEFAULT_SYSTEM_PROMPT;

// ===== 狀態 =====
let genAI = null, model = null, chat = null;
let history = [];

// 僅此更動：控制「每輪回覆只顯示一次 bot 圖」
let _botIconShownThisTurn = false;
function resetBotIconOnce() { _botIconShownThisTurn = false; }
function botImgOnceTag() {
  if (_botIconShownThisTurn) {
    return '<img src="img/bot.png" alt="bot" class="bot" style="visibility:hidden;">';
  } else {
    _botIconShownThisTurn = true;
    return '<img src="img/bot.png" alt="bot" class="bot">';
  }
}

// ===== 順序呈現與動畫（最小侵入） =====
function ensureAnimStyles() {
  if (document.getElementById("scambino-anim-css")) return;
  const css = `
  @keyframes bubbleIn { 0% { opacity: 0; transform: translateY(8px) scale(.98); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
  .bubble-anim { animation: bubbleIn 260ms ease-out both; will-change: transform, opacity; }
  `;
  const style = document.createElement("style");
  style.id = "scambino-anim-css";
  style.textContent = css;
  document.head.appendChild(style);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== 設定面板開關 =====
const openSettings = () => {
  settingsModal.classList.add("show");
  settingsModal.setAttribute("aria-hidden", "false");
};
const closeSettingsPanel = () => {
  settingsModal.classList.remove("show");
  settingsModal.setAttribute("aria-hidden", "true");
};
settingsBtn.addEventListener("click", openSettings);
closeSettings.addEventListener("click", closeSettingsPanel);
modalBackdrop.addEventListener("click", closeSettingsPanel);

function setStatus(text, ok = false) {
  statusEl.textContent = text;
  statusEl.className = ok ? "status ok" : "status";
}

// ===== Chat bubble（沿原本風格；僅調整 bot 圖出現次數＋回傳元素以便動畫）=====
function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[s]);
}
function addUserBubble(text) {
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    <div class="chatbox-spacer"></div>
    <div class="chat-box-text">${escapeHTML(text).replace(/\n/g, "<br>")}</div>
    <img src="img/user.png" alt="user" class="user">
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
  return box;
}
function addBotTextBubble(innerHTML) {
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    ${botImgOnceTag()}
    <div class="chat-box-text">${innerHTML}</div>
    <div class="chatbox-spacer"></div>
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
  return box;
}
function addStepBubble(index, text) {
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    ${botImgOnceTag()}
    <div class="steps-box">
      <div class="step-number">
        <img src="img/step.png" alt="step" class="step">
        <div class="step-number-text">${index + 1}</div>
      </div>
      <div class="steps-text">${escapeHTML(text)}</div>
    </div>
    <div class="chatbox-spacer"></div>
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
  return box;
}
function addHorizontalList(items) {
  const cards = (items || []).map((it) => `
    <div class="hcard">
      <div class="hcard-title">${escapeHTML(it.title || "")}</div>
      <div class="hcard-content">${escapeHTML(it.content || "")}</div>
    </div>
  `).join("");
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    ${botImgOnceTag()}
    <div class="hlist">${cards}</div>
    <div class="chatbox-spacer"></div>
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
  return box;
}
function addButtons(items) {
  const btns = document.createElement("div");
  btns.className = "pill-buttons";
  (items || []).forEach((it) => {
    const b = document.createElement("button");
    b.className = "btn pill";
    b.textContent = it.label || it.id || "選項";
    b.addEventListener("click", () => {
      userInputEl.value = it.value || it.label || "";
    });
    btns.appendChild(b);
  });
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    ${botImgOnceTag()}
    <div class="chat-box-text"></div>
    <div class="chatbox-spacer"></div>
  `;
  box.querySelector(".chat-box-text").appendChild(btns);
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
  return box;
}

// ===== 解析並「依序」渲染模型 JSON（加上入場動畫）=====
async function renderAssistantJSON(resp) {
  // 每輪渲染開始前重置圖示旗標 & 確保動畫樣式存在
  resetBotIconOnce();
  ensureAnimStyles();

  const tasks = [];

  if (resp?.answer?.content) {
    const html = escapeHTML(resp.answer.content).replace(/\n/g, "<br>");
    tasks.push(() => addBotTextBubble(html));
  }

  const mods = resp?.ui?.modules || [];
  mods.forEach((mod) => {
    if (!mod || !mod.type) return;
    switch (mod.type) {
      case "basic_text": {
        const html = escapeHTML(mod.text || "").replace(/\n/g, "<br>");
        tasks.push(() => addBotTextBubble(html));
        break;
      }
      case "long_block": {
        if (mod.format === "code") {
          const title = escapeHTML(mod.title || "");
          const code = escapeHTML(mod.content || "");
          const html = `<div class="code-title">${title}</div><pre class="code-block">${code}</pre>`;
          tasks.push(() => addBotTextBubble(html));
        } else {
          const title = mod.title ? `<div class=\"block-title\">${escapeHTML(mod.title)}</div>` : "";
          const content = `<div>${escapeHTML(mod.content || "").replace(/\n/g, "<br>")}</div>`;
          tasks.push(() => addBotTextBubble(title + content));
        }
        break;
      }
      case "buttons":
        tasks.push(() => addButtons(mod.items || []));
        break;
      case "steps": {
        (mod.items || []).forEach((t, i) => {
          tasks.push(() => addStepBubble(i, t));
        });
        break;
      }
      case "horizontal_list":
        tasks.push(() => addHorizontalList(mod.items || []));
        break;
      default:
        tasks.push(() => addBotTextBubble(`未支援的模組：${escapeHTML(mod.type)}`));
    }
  });

  if (Array.isArray(resp.sources) && resp.sources.length) {
    const html = `來源：${resp.sources.map((s) => `<span class="src">${escapeHTML(s)}</span>`).join(" ")}`;
    tasks.push(() => addBotTextBubble(html));
  }

  // 順序播放：每個區塊依序出現＋動畫
  for (const task of tasks) {
    const el = task();
    if (el && el.classList) {
      // 下一輪渲染前，確保滾到底
      chatEl.scrollTop = chatEl.scrollHeight;
      // 動畫 class（用 rAF 避免佈局合併問題）
      requestAnimationFrame(() => el.classList.add("bubble-anim"));
    }
    await sleep(140); // 間隔可調（ms）
  }
}

// ===== 啟動連線（於設定面板） =====
startBtn.addEventListener("click", async () => {
  try {
    const key = apiKeyEl.value.trim();
    if (!key) { alert("請先貼上 API Key"); return; }
    const gen = new GoogleGenerativeAI(key);
    const mdl = gen.getGenerativeModel({
      model: modelEl.value,
      systemInstruction: systemPromptTextarea.value.trim() || DEFAULT_SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" }
    });
    genAI = gen; model = mdl;
    chat = model.startChat({ history, generationConfig: { responseMimeType: "application/json" } });
    setStatus("已連線", true);
    closeSettingsPanel();
  } catch (e) {
    console.error(e);
    setStatus("連線失敗", false);
  }
});

// ===== 送出訊息（不綁 Enter；僅按鈕送出） =====
async function sendMessage() {
  const text = userInputEl.value.trim();
  if (!text) return;
  userInputEl.value = "";
  addUserBubble(text);
  try {
    if (!chat) {
      resetBotIconOnce();
      const el = addBotTextBubble("尚未連線，請先打開右上齒輪完成設定並啟動。");
      requestAnimationFrame(() => el.classList.add("bubble-anim"));
      return;
    }
    const resp = await chat.sendMessage(text);
    const out = await resp.response.text(); // 期望 JSON
    let json;
    try { json = JSON.parse(out); }
    catch {
      resetBotIconOnce();
      const el1 = addBotTextBubble("（模型未輸出合法 JSON，原文如下）");
      requestAnimationFrame(() => el1.classList.add("bubble-anim"));
      const el2 = addBotTextBubble(`<pre class=\"code-block\">${escapeHTML(out)}</pre>`);
      requestAnimationFrame(() => el2.classList.add("bubble-anim"));
      return;
    }
    if (!json || typeof json !== "object" || !("answer" in json)) {
      resetBotIconOnce();
      const el1 = addBotTextBubble('Schema 檢查未通過（缺少 "answer"）。原始內容：');
      requestAnimationFrame(() => el1.classList.add("bubble-anim"));
      const el2 = addBotTextBubble(`<pre class=\"code-block\">${escapeHTML(JSON.stringify(json, null, 2))}</pre>`);
      requestAnimationFrame(() => el2.classList.add("bubble-anim"));
      return;
    }
    await renderAssistantJSON(json);
  } catch (e) {
    resetBotIconOnce();
    const el = addBotTextBubble("請求失敗：" + escapeHTML(String(e)));
    requestAnimationFrame(() => el.classList.add("bubble-anim"));
  }
}
sendBtn.addEventListener("click", sendMessage);

// 清空
clearBtn.addEventListener("click", () => { chatEl.innerHTML = ""; history = []; });

// 防止 Enter 送出（不綁任何 keydown 事件即可；若要硬阻擋，解除以下註解）
// userInputEl.addEventListener("keydown", (ev) => {
//   if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); }
// });
