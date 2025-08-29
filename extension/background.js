// This function is moved from api.js
// It sends the HTML content to your local server.
function sendHtmlToApi(htmlContent, pageUrl) {
  const apiUrl = 'http://localhost:5500/path';
  console.log(`準備將 ${pageUrl} 的內容傳送到 ${apiUrl}`);

  fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: pageUrl,
      html: htmlContent,
      timestamp: new Date().toISOString()
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`伺服器回應錯誤: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('API 呼叫成功:', data);
    // You could potentially send a message back to the content script here
    // to show a success notification on the page.
  })
  .catch(error => {
    console.error('API 呼叫失敗:', error);
  });
}

// Listen for messages from the content script.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendHtml") {
    console.log("背景腳本收到傳送 HTML 的請求。");
    sendHtmlToApi(request.html, request.url);
    // Let the content script know the message was received.
    sendResponse({ status: "Request received by background script." });
  }
  // Return true to indicate you wish to send a response asynchronously.
  return true; 
});