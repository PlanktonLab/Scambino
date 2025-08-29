import google.generativeai as genai
import os
import json

# --- Configuration ---
# It's recommended to set your API key as an environment variable for security.
# For example: export GOOGLE_API_KEY="YOUR_API_KEY"
# If not set, you can paste it directly: genai.configure(api_key="YOUR_API_KEY")
try:
    genai.configure(api_key=os.environ["AIzaSyDUp1-1vyGRmY111GTbKV61FP5GBR4IEzU"])
except KeyError:
    print("請設定 GOOGLE_API_KEY 環境變數")
    exit()

# --- Prompt Engineering ---
# This prompt guides the Gemini model to perform the specific task.

# 1. Define the categories you want to classify into.
SCAM_CATEGORIES = [
    "網路購物詐騙", "假投資詐騙", "假交友(投資詐財)詐騙", "騙取金融帳戶(卡片)詐騙",
    "假買家騙賣家詐騙", "假中獎通知詐騙", "假求職詐騙", "假交友(徵婚詐財)詐騙",
    "假檢警詐騙", "假借銀行貸款詐騙", "假廣告詐騙", "盜(冒)用 LINE 帳號詐騙",
    "釣魚簡訊(惡意連結)詐騙", "色情應召詐財詐騙", "虛擬遊戲詐騙", "假冒銀行貸款",
    "猜猜我是誰詐騙", "假快遞詐騙", "假慈善機關(急難救助)詐騙", "假預付型消費詐騙"
]

# 2. Create a prompt template.
PROMPT_TEMPLATE = f"""
你是頂尖的詐騙情境分析師。你的任務是分析使用者提供的文字情境，並執行以下兩項工作：
1.  從下列預設的分類清單中，找出最符合該情境的一個分類。
2.  從情境文字中，提取出3到5個最關鍵的詞彙。

**預設分類清單:**
{', '.join(SCAM_CATEGORIES)}

請嚴格依照以下的 JSON 格式回傳分析結果，不要包含任何其他說明文字。

**輸出格式:**
{{
  "category": "在此填入最符合的分類",
  "keywords": ["關鍵字一", "關鍵字二", "關鍵字三"]
}}

---
**使用者情境:**
{{scenario_text}}
---
**分析結果:**
"""

def analyze_scenario(scenario_text: str) -> dict:
    """
    Uses the Gemini API to analyze a scam scenario.
    
    Args:
        scenario_text: The text describing the scam scenario.
        
    Returns:
        A dictionary with 'category' and 'keywords' if successful, otherwise None.
    """
    if not scenario_text:
        return None

    # Initialize the Gemini model
    model = genai.GenerativeModel('gemini-2.5-flash') # Using flash for speed and cost-efficiency
    
    # Fill the user's scenario into the prompt template
    prompt = PROMPT_TEMPLATE.format(scenario_text=scenario_text)
    
    try:
        # Call the API
        response = model.generate_content(prompt)
        
        # Clean up the response and parse it as JSON
        # The model might wrap the JSON in ```json ... ```, so we clean it.
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        
        result = json.loads(response_text)
        return result
        
    except Exception as e:
        print(f"API 呼叫或 JSON 解析時發生錯誤: {e}")
        print(f"收到的原始回應: {response.text if 'response' in locals() else 'N/A'}")
        return None

# --- Main Execution ---
if __name__ == "__main__":
    # <<<<<<<<<<<<<<<< 在這裡輸入您要分析的情境文字 >>>>>>>>>>>>>>>>
    input_scenario = """
    昨天晚上我媽接到電話，對方說是她以前的同事，換了LINE要我媽加一下。
    今天早上這個假同事就傳訊息來，說他現在做生意需要資金周轉，開口借三十萬，
    還給了一個看起來是陌生人的銀行帳戶，說下午三點半前就要匯過去。
    我媽覺得聲音聽起來怪怪的，但對方說是感冒了。
    """
    # <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

    print(f"正在分析情境：\n---\n{input_scenario.strip()}\n---\n")
    
    analysis_result = analyze_scenario(input_scenario)
    
    if analysis_result:
        print("Gemini 分析結果：")
        print(f"詐騙分類： {analysis_result.get('category', '未知')}")
        
        keywords = analysis_result.get('keywords', [])
        print(f"關鍵字： {', '.join(keywords)}")