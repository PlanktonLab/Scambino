// Function to find the target and inject our button.
function injectCustomButton() {
  // **THIS IS THE ONLY LINE THAT CHANGED**
  // Use a stable attribute selector to find the "Print all" button.
  const printAllButton = document.querySelector('button[aria-label="全部列印"]');
  const customButtonId = 'scambino-send-html-btn';

  // Check if the target button exists AND our button hasn't been added yet.
  if (printAllButton && !document.getElementById(customButtonId)) {
    
    const customButton = document.createElement('button');
    customButton.id = customButtonId;
    customButton.innerText = '傳送 HTML';
    // Apply some styles directly for better integration
    customButton.style.marginLeft = '8px';

    customButton.addEventListener('click', () => {
      console.log("按鈕被點擊，準備獲取 HTML 並傳送訊息。");
      customButton.textContent = '正在傳送...';
      customButton.disabled = true;

      const fullHtml = document.documentElement.outerHTML;
      const currentUrl = window.location.href;

      // Send a message to the background script with the page's HTML.
      chrome.runtime.sendMessage({
        action: "sendHtml",
        html: fullHtml,
        url: currentUrl
      }, (response) => {
        // This callback runs after the background script responds.
        console.log(response.status);
        alert('HTML 已成功傳送！'); // Simple feedback for the user.
        
        // Restore button state
        customButton.textContent = '傳送 HTML';
        customButton.disabled = false;
      });
    });

    // Find the parent of the "Print all" button to insert our button.
    const buttonContainer = printAllButton.parentElement;
    if (buttonContainer) {
        // Insert our button right after the "Print all" button.
        buttonContainer.insertBefore(customButton, printAllButton.nextSibling);
        console.log('自訂按鈕已成功注入到「全部列印」旁邊！');
    }
  }
}

// Set up a MutationObserver to watch for changes in the DOM.
const observer = new MutationObserver(() => {
  injectCustomButton();
});

// Start observing the entire document body for changes.
observer.observe(document.body, {
  childList: true, // Watch for added/removed nodes
  subtree: true    // Watch descendants of the target
});

// Also run it once on script load, in case the element is already there.
injectCustomButton();