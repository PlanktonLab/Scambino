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

// ===== Chat bubble（沿你的風格）=====
function escapeHTML(str) {
  return String(str ?? "").replace(/[&<>"']/g, (s) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[s]));
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
}
function addBotTextBubble(innerHTML) {
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    <img src="img/bot.png" alt="bot" class="bot">
    <div class="chat-box-text">${innerHTML}</div>
    <div class="chatbox-spacer"></div>
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
}
function addStepBubble(index, text) {
  const box = document.createElement("div");
  box.className = "chat-box";
  box.innerHTML = `
    <img src="img/bot.png" alt="bot" class="bot" style="visibility:hidden;">
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
    <img src="img/bot.png" alt="bot" class="bot">
    <div class="hlist">${cards}</div>
    <div class="chatbox-spacer"></div>
  `;
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
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
    <img src="img/bot.png" alt="bot" class="bot">
    <div class="chat-box-text"></div>
    <div class="chatbox-spacer"></div>
  `;
  box.querySelector(".chat-box-text").appendChild(btns);
  chatEl.appendChild(box);
  chatEl.scrollTop = chatEl.scrollHeight;
}

// ===== 解析並渲染模型 JSON =====
function renderAssistantJSON(resp) {
  if (resp?.answer?.content) {
    addBotTextBubble(escapeHTML(resp.answer.content).replace(/\n/g, "<br>"));
  }
  const mods = resp?.ui?.modules || [];
  mods.forEach((mod) => {
    if (!mod || !mod.type) return;
    switch (mod.type) {
      case "basic_text":
        addBotTextBubble(escapeHTML(mod.text || "").replace(/\n/g, "<br>"));
        break;
      case "long_block":
        if (mod.format === "code") {
          addBotTextBubble(
            `<div class="code-title">${escapeHTML(mod.title || "")}</div><pre class="code-block">${escapeHTML(mod.content || "")}</pre>`
          );
        } else {
          const html =
            (mod.title ? `<div class="block-title">${escapeHTML(mod.title)}</div>` : "") +
            `<div>${escapeHTML(mod.content || "").replace(/\n/g, "<br>")}</div>`;
          addBotTextBubble(html);
        }
        break;
      case "buttons":
        addButtons(mod.items || []);
        break;
      case "steps":
        (mod.items || []).forEach((t, i) => addStepBubble(i, t));
        break;
      case "horizontal_list":
        addHorizontalList(mod.items || []);
        break;
      default:
        addBotTextBubble(`未支援的模組：${escapeHTML(mod.type)}`);
    }
  });
  if (Array.isArray(resp.warnings) && resp.warnings.length) {
    // addBotTextBubble(`注意：${escapeHTML(resp.warnings.join("；"))}`);
  }
  if (Array.isArray(resp.sources) && resp.sources.length) {
    addBotTextBubble(
      `來源：${resp.sources.map((s) => `<span class="src">${escapeHTML(s)}</span>`).join(" ")}`
    );
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
      addBotTextBubble("尚未連線，請先打開右上齒輪完成設定並啟動。");
      return;
    }
    const resp = await chat.sendMessage(text);
    const out = await resp.response.text(); // 期望 JSON
    let json;
    try { json = JSON.parse(out); }
    catch {
      addBotTextBubble("（模型未輸出合法 JSON，原文如下）");
      addBotTextBubble(`<pre class="code-block">${escapeHTML(out)}</pre>`);
      return;
    }
    if (!json || typeof json !== "object" || !("answer" in json)) {
      addBotTextBubble('Schema 檢查未通過（缺少 "answer"）。原始內容：');
      addBotTextBubble(`<pre class="code-block">${escapeHTML(JSON.stringify(json, null, 2))}</pre>`);
      return;
    }
    renderAssistantJSON(json);
  } catch (e) {
    addBotTextBubble("請求失敗：" + escapeHTML(String(e)));
  }
}
sendBtn.addEventListener("click", sendMessage);

// 清空
clearBtn.addEventListener("click", () => { chatEl.innerHTML = ""; history = []; });

// 防止 Enter 送出（不綁任何 keydown 事件即可；若要硬阻擋，解除以下註解）
// userInputEl.addEventListener("keydown", (ev) => {
//   if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); }
// });
