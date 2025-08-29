import pandas as pd
import json

# 載入 JSON 資料
with open('databse\Scam.json', 'r', encoding='utf-8') as file:
    data = json.load(file)

# 將字典列表轉換為 pandas DataFrame
df = pd.DataFrame(data['scams'])

# 從 'case_study' 欄位中提取 'narrative' 內容
df['narrative'] = df['case_study'].apply(lambda x: x.get('narrative', ''))

# 在 'narrative' 欄位中搜尋關鍵字
keyword = input()
matching_cases = df[df['narrative'].str.contains(keyword, na=False)].copy()

# 如果找到案例，則提取相關資訊並限制在5個以內
if not matching_cases.empty:
    matching_cases = matching_cases.head(5)
    results = matching_cases[['category', 'narrative']]
    print(results.to_json(orient='records', force_ascii=False, indent=2))
else:
    print(json.dumps({"message": "沒有找到類似的案例"}, indent=2, ensure_ascii=False))