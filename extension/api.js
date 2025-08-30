function sendHtmlToApi(htmlContent, pageUrl, onComplete) {
  // 我們將直接使用您之前測試用的本地伺服器位址
  const apiUrl = 'http://localhost:5500/path';

  console.log(`準備將 ${pageUrl} 的內容傳送到 ${apiUrl}`);

  fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: pageUrl,
      html: htmlContent,
      timestamp: new Date().toISOString()
    })
  })
  .then(response => {
    if (!response.ok) {
      // 如果伺服器回應錯誤，也拋出一個 error
      throw new Error(`伺服器回應錯誤: ${response.status} ${response.statusText}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('API 呼叫成功:', data);
    alert('HTML 已成功傳送！');
  })
  .catch(error => {
    console.error('API 呼叫失敗:', error);
    alert(`傳送失敗: ${error.message}`);
  })
  .finally(() => {
    // 無論成功或失敗，都呼叫 onComplete 回調函式來恢復按鈕狀態
    if (typeof onComplete === 'function') {
      onComplete();
    }
  });
}
