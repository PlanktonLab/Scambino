document.getElementById('sendHtmlBtn').addEventListener('click', async () => {
  const sendButton = document.getElementById('sendHtmlBtn');
  sendButton.textContent = '正在抓取...';
  sendButton.disabled = true;

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.documentElement.outerHTML,
    }, (injectionResults) => {
      if (chrome.runtime.lastError) {
        alert(`錯誤: ${chrome.runtime.lastError.message}`);
        sendButton.textContent = '傳送 HTML';
        sendButton.disabled = false;
        return;
      }

      if (injectionResults && injectionResults[0]) {
        const htmlContent = injectionResults[0].result;
        console.log("成功獲取 HTML，準備傳送。");
        sendButton.textContent = '正在傳送...';
        // 將內容和回調函式傳給 API 函式
        sendHtmlToApi(htmlContent, tab.url, () => {
          // 這個回調會在 API 呼叫完成後執行
          sendButton.textContent = '傳送 HTML';
          sendButton.disabled = false;
        });
      }
    });
  } else {
    alert("找不到活動分頁。");
    sendButton.textContent = '傳送 HTML';
    sendButton.disabled = false;
  }
});
