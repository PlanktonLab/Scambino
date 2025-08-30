// API endpoint for the streaming generation service.
const API_URL = 'http://10.246.69.236:5000/generate-stream';

/**
 * Sends page content as a question to the local streaming API.
 * @param {string} htmlContent - The HTML content of the page.
 * @param {string} pageUrl - The URL of the page.
 */
async function processWithStreamingApi(htmlContent, pageUrl) {
  console.log(`Sending content from ${pageUrl} to streaming API: ${API_URL}`);

  // Format the page data into a single string for the 'question' field.
  const questionPayload = `
I received a suspicious email/message. Please analyze it based on the following content.
---
Page URL: ${pageUrl}
---
Page HTML Content:
${htmlContent}
---
  `;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: questionPayload,
    }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  // Handle the streaming response.
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullResponse = '';

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('Stream finished.');
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    console.log('Received chunk:', chunk); // Log each piece of data as it arrives.
    fullResponse += chunk;
    // Here, you could send each chunk back to the content script for real-time display.
  }
  
  return fullResponse;
}

// Listen for messages from content scripts.
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "sendHtml") {
    console.log("Received 'sendHtml' request for streaming API.");

    (async () => {
      try {
        const result = await processWithStreamingApi(request.html, request.url);
        console.log('API stream processing complete. Full response:', result);
        sendResponse({ success: true, data: result });
      } catch (error) {
        console.error('API call failed:', error.message);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate that sendResponse will be called asynchronously.
    return true;
  }
});