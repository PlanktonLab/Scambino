import google.generativeai as genai
import os
import json
import pathlib

# --- Configuration ---
try:
    genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
except KeyError:
    print("請設定 GOOGLE_API_KEY 環境變數或在程式碼中直接設定。")
    exit()


def load_scam_database() -> str:
    """Loads the scam database from the same directory as the script."""
    try:
        # Get the directory where the script itself is located
        script_dir = pathlib.Path(__file__).parent.resolve()
        filepath = script_dir / "Scam.json"
        # Optional: uncomment the next line for debugging to see the path
        # print(f"正在從 {filepath} 讀取資料庫...")
        return filepath.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"錯誤：在腳本所在的目錄中找不到資料庫檔案 'Scam.json'。")
        return None

def find_example_for_scenario(scenario_text: str, scam_database: str) -> dict:
    """
    Analyzes a scenario to extract keywords and find the most relevant case study.
    """
    if not scenario_text or not scam_database:
        return None

    prompt = f"""
    你是一位頂尖的詐騙防範分析師。你的知識庫是一個包含多種詐騙手法的 JSON 資料庫。
    你的任務是分析使用者提供的「情境描述」，並完成以下三件事：

    1.  **提取關鍵字**：從「情境描述」中，識別出最能代表此情境特徵的 3-5 個關鍵詞彙 (例如：平台、藉口、手法、話術)。
    2.  **比對案例**：根據你分析的結果，從下方提供的「詐騙資料庫」中，找出與「情境描述」最相似、最相關的**一個**實際案例。
    3.  **格式化輸出**：將你的分析結果，嚴格按照指定的 JSON 格式輸出，不要包含任何額外的說明或文字。

    **指定的輸出格式:**
    {{
      "extracted_keywords": ["分析出的關鍵字1", "分析出的關鍵字2", ...],
      "most_relevant_case": {{
        "category": "從資料庫中找到的最相關案例的分類",
        "narrative": "從資料庫中找到的最相關案例的完整敘述文字"
      }}
    }}
    
    ---
    **詐騙資料庫:**
    {scam_database}
    ---
    **使用者情-境描述:**
    {scenario_text}
    ---
    **分析結果 (JSON):**
    """

    model = genai.GenerativeModel('gemini-2.5-flash')
   
    try:
        # --- 我在這裡加了第一行提示 ---
        print("\n⏳ 正在呼叫 Gemini API 並傳送資料，請稍候...")
        response = model.generate_content(prompt)
        # --- 我在這裡加了第二行提示 ---
        print("✅ API 已回應，正在處理結果...")
        
        response_text = response.text.strip().replace('```json', '').replace('```', '').strip()
        result = json.loads(response_text)
        return result
    except Exception as e:
        print(f"API 呼叫或 JSON 解析時發生錯誤: {e}")
        print(f"收到的原始回應: {response.text if 'response' in locals() else 'N/A'}")
        return None

# --- Main Execution ---
if __name__ == "__main__":
    # 1. Load the knowledge base
    scam_db_content = load_scam_database()
    
    if scam_db_content:
        # 2. Let user input multi-line text from the console.
        print("✅ 請貼上您要分析的情境文字。")
        print("   （貼上後，在新的一行直接按下 Enter 即可開始分析）")
        
        lines = []
        while True:
            try:
                line = input()
                if line == "":
                    break
                lines.append(line)
            except EOFError: # Handle Ctrl+D as end of input
                break
        input_scenario = "\n".join(lines)

        # Check if user actually entered something
        if not input_scenario.strip():
            print("⚠️ 您沒有輸入任何內容。程式結束。")
        else:
            print("\n=========== 分析開始 ===========")
            print(f"輸入情境：\n{input_scenario.strip()}\n")
            
            # 3. Call the analysis function
            analysis_result = find_example_for_scenario(input_scenario, scam_db_content)
            
            # 4. Print the result
            if analysis_result:
                print("---------- Gemini 分析結果 ----------")
                
                keywords = analysis_result.get('extracted_keywords', [])
                
                # This is the corrected f-string code
                formatted_keywords = '\n- '.join(keywords)
                print(f"【提取的關鍵字】\n- {formatted_keywords}\n")
                
                case = analysis_result.get('most_relevant_case', {})
                category = case.get('category', '未知')
                narrative = case.get('narrative', '找不到相關案例。')
                
                print(f"【最相關的實際案例】")
                print(f"  - 分類：{category}")
                print(f"  - 案例內容：\n{narrative}")
                print("====================================")