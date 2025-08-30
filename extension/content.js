// Function to find the target and inject our button.
function injectCustomButton() {
  // Use a stable attribute selector to find the "Print all" button.
  const printAllButton = document.querySelector('button[aria-label="全部列印"]');
  const customButtonId = 'scambino-send-html-btn';

  // Check if the target button exists AND our button hasn't been added yet.
  if (printAllButton && !document.getElementById(customButtonId)) {
    
    const customButton = document.createElement('button');
    customButton.id = customButtonId;
    
    // --- MODIFICATION START ---
    // Set a title for accessibility (shows on hover).
    customButton.title = '傳送內文 (包含真實連結)'; 
    // Set the background image using the extension's URL.
    customButton.style.backgroundImage = `url(${chrome.runtime.getURL('images/scambino48.png')})`;
    // --- MODIFICATION END ---

    customButton.addEventListener('click', () => {
      console.log("按鈕被點擊，準備獲取包含真實連結的純文字內容。");
      customButton.disabled = true;

      const mainContent = document.querySelector('div[role="main"]');
      let emailText;

      if (mainContent) {
        // Clone the element to avoid modifying the actual page content.
        const contentClone = mainContent.cloneNode(true);
        const links = contentClone.querySelectorAll('a');
        
        links.forEach(link => {
          const linkText = link.innerText.trim();
          const linkHref = link.href;
          if (linkText && linkHref) {
            link.innerText = `${linkText} (${linkHref})`;
          }
        });
        
        emailText = contentClone.innerText;
      } else {
        emailText = '錯誤：找不到指定的信件內容 (div[role="main"])。';
      }
      
      const currentUrl = window.location.href;

      // Send a message to the background script.
      chrome.runtime.sendMessage({
        action: "sendHtml",
        html: emailText,
        url: currentUrl
      }, (response) => {
        console.log(response.status);
        alert('信件內容 (含真實連結) 已成功傳送！');
        
        // Restore button state
        customButton.disabled = false;
      });
    });

    const buttonContainer = printAllButton.parentElement;
    if (buttonContainer) {
        buttonContainer.insertBefore(customButton, printAllButton.nextSibling);
    }
  }
}

// Set up a MutationObserver to watch for changes in the DOM.
const observer = new MutationObserver(() => {
  injectCustomButton();
});

// Start observing the entire document body for changes.
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Also run it once on script load.
injectCustomButton();