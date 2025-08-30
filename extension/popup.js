document.getElementById('sendHtmlBtn').addEventListener('click', async () => {
  const sendButton = document.getElementById('sendHtmlBtn');
  sendButton.textContent = '正在抓取...';
  sendButton.disabled = true;

  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab) {
    let scriptToExecute;

    // --- MODIFICATION START ---
    // Check if the current tab is on Gmail.
    if (tab.url.includes("mail.google.com")) {
      // Logic for Gmail: Get mail content and expand links.
      scriptToExecute = () => {
        const mainContent = document.querySelector('div[role="main"]');
        if (!mainContent) {
          return '錯誤：找不到指定的信件內容 (div[role="main"])。';
        }
        const contentClone = mainContent.cloneNode(true);
        const links = contentClone.querySelectorAll('a');
        links.forEach(link => {
          const linkText = link.innerText.trim();
          const linkHref = link.href;
          if (linkText && linkHref) {
            link.innerText = `${linkText} (${linkHref})`;
          }
        });
        return contentClone.innerText;
      };
    } else {
      // Logic for all other websites: Get the entire page's plain text.
      scriptToExecute = () => {
        return document.body.innerText;
      };
    }
    // --- MODIFICATION END ---

    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scriptToExecute, // Execute the function based on the URL check
    }, (injectionResults) => {
      if (chrome.runtime.lastError) {
        alert(`錯誤: ${chrome.runtime.lastError.message}`);
        sendButton.textContent = '傳送內容';
        sendButton.disabled = false;
        return;
      }

      if (injectionResults && injectionResults[0] && injectionResults[0].result) {
        const textContent = injectionResults[0].result;
        console.log("成功獲取頁面純文字內容，準備傳送。");
        sendButton.textContent = '正在傳送...';
        
        sendHtmlToApi(textContent, tab.url, () => {
          sendButton.textContent = '傳送內容';
          sendButton.disabled = false;
        });
      } else {
         alert("無法抓取此頁面的內容。");
         sendButton.textContent = '傳送內容';
         sendButton.disabled = false;
      }
    });
  } else {
    alert("找不到活動分頁。");
    sendButton.textContent = '傳送內容';
    sendButton.disabled = false;
  }
});