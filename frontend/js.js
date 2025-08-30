

import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

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

// ===== 設定面板：本地模型選項（自動注入 UI，不需要改 HTML） =====
const LOCAL_MODEL_VALUE = "local-http";
let localUrlInput = null; // 之後指向 #localUrl
function ensureLocalOptionAndField() {
  // 1) 在 #model select 內加入「本地（HTTP）」並預設選取
  if (![...modelEl.options].some(o => o.value === LOCAL_MODEL_VALUE)) {
    const opt = document.createElement("option");
    opt.value = LOCAL_MODEL_VALUE;
    opt.textContent = "本地（HTTP 端點）";
    modelEl.insertBefore(opt, modelEl.firstChild);
  }
  modelEl.value = LOCAL_MODEL_VALUE; // 預設選擇本地

  // 2) 在設定面板動態加入本地端點輸入框
  const body = settingsModal.querySelector(".modal-body") || settingsModal;
  if (!document.getElementById("localUrl")) {
    const wrap = document.createElement("label");
    wrap.id = "localUrlWrap";
    wrap.innerHTML = `本地模型 URL
      <input id="localUrl" type="text" placeholder="http://localhost:11434/v1/chat/completions 或 /api/chat" />`;
    body.insertBefore(wrap, body.querySelector("details") || body.lastChild);
  }
  localUrlInput = document.getElementById("localUrl");
  // 給一個常見預設（可自行改）
  if (!localUrlInput.value) localUrlInput.value = "http://localhost:11434/v1/chat/completions";

  updateProviderUI();
}
function updateProviderUI() {
  const isLocal = modelEl.value === LOCAL_MODEL_VALUE;
  const wrap = document.getElementById("localUrlWrap");
  if (wrap) wrap.style.display = isLocal ? "block" : "none";
  // 本地模式通常不需要 API Key
  apiKeyEl.disabled = isLocal;
  apiKeyEl.placeholder = isLocal ? "不需要 API Key" : "Google AI Studio API Key（僅測試用）";
}
modelEl.addEventListener("change", updateProviderUI);

// 初始化插入本地選項
ensureLocalOptionAndField();

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

// ===== 本地端點 Chat Adapter（支援兩種常見協定） =====
function makeLocalChatAdapter(baseUrl, systemInstruction) {
  const msgs = []; // {role, content}
  function toResponseText(text) {
    return { response: { text: async () => text } };
  }
  async function callOpenAICompat(userText) {
    // OpenAI/LM Studio/Oobabooga 兼容：/v1/chat/completions
    const body = {
      model: "local",
      messages: [
        ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        ...msgs,
        { role: "user", content: userText }
      ],
      stream: false,
      temperature: 0.7
    };
    const r = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json().catch(() => null);
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (typeof content !== "string") {
      // 若回傳非預期，退而取原始文本
      const raw = await r.text();
      return toResponseText(raw);
    }
    return toResponseText(content);
  }
  async function callGeneric(userText) {
    // 泛型：自定義 /api/chat，回傳純文字（即模型 JSON 字串）
    const body = { system: systemInstruction || "", prompt: userText, history: msgs };
    const r = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const text = await r.text();
    return toResponseText(text);
  }
  return {
    async sendMessage(text) {
      msgs.push({ role: "user", content: text });
      const useOpenAI = /\/v1\/chat\/completions/i.test(baseUrl);
      const out = await (useOpenAI ? callOpenAICompat(text) : callGeneric(text));
      return out;
    }
  };
}

// ===== 解析並「依序」渲染模型 JSON（加上入場動畫） =====
async function renderAssistantJSON(resp) {
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

  for (const task of tasks) {
    const el = task();
    if (el && el.classList) {
      chatEl.scrollTop = chatEl.scrollHeight;
      requestAnimationFrame(() => el.classList.add("bubble-anim"));
    }
    await sleep(140);
  }
}

// ===== 啟動連線（於設定面板） =====
startBtn.addEventListener("click", async () => {
  try {
    const key = apiKeyEl.value.trim();
    const sys = systemPromptTextarea.value.trim() || DEFAULT_SYSTEM_PROMPT;
    const isLocal = modelEl.value === LOCAL_MODEL_VALUE;

    if (isLocal) {
      const url = (localUrlInput && localUrlInput.value.trim()) || "";
      if (!url) { alert("請輸入本地模型 URL"); return; }
      genAI = null; model = null;
      chat = makeLocalChatAdapter(url, sys);
      setStatus("已連線（本地）", true);
      closeSettingsPanel();
      return;
    }

    if (!key) { alert("請先貼上 API Key"); return; }
    const gen = new GoogleGenerativeAI(key);
    const mdl = gen.getGenerativeModel({
      model: modelEl.value,
      systemInstruction: sys,
      generationConfig: { responseMimeType: "application/json" }
    });
    genAI = gen; model = mdl;
    chat = model.startChat({ history, generationConfig: { responseMimeType: "application/json" } });
    setStatus("已連線（Gemini）", true);
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
    const out = await resp.response.text(); // 期望 JSON（本地或雲端皆需回傳 JSON 字串）
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
    // if (!json || typeof json !== "object" || !("answer" in json)) {
    //   resetBotIconOnce();
    //   const el1 = addBotTextBubble('Schema 檢查未通過（缺少 "answer"）。原始內容：');
    //   requestAnimationFrame(() => el1.classList.add("bubble-anim"));
    //   const el2 = addBotTextBubble(`<pre class=\"code-block\">${escapeHTML(JSON.stringify(json, null, 2))}</pre>`);
    //   requestAnimationFrame(() => el2.classList.add("bubble-anim"));
    //   return;
    // }
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
