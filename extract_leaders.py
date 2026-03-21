import pandas as pd
import openpyxl
from collections import defaultdict

# 读取Excel文件
file_path = "技改创新申请 (1).xlsx"
df = pd.read_excel(file_path, sheet_name='技改创新申请', header=2)

# 提取关键列
leaders_data = []

for idx, row in df.iterrows():
    try:
        project_no = row.get('项目编号', '') if pd.notna(row.get('项目编号', '')) else ''
        project_name = row.get('项目名称', '') if pd.notna(row.get('项目名称', '')) else ''
        dept = row.get('申报单位', '') if pd.notna(row.get('申报单位', '')) else ''
        leader = row.get('F项目实施负责人', '') if pd.notna(row.get('F项目实施负责人', '')) else ''
        participants = row.get('F项目主要参与人员', '') if pd.notna(row.get('F项目主要参与人员', '')) else ''
        
        if project_no and project_name:
            leaders_data.append({
                '项目编号': project_no,
                '项目名称': project_name,
                '申报单位': dept,
                '项目负责人': leader,
                '项目参与人员': participants
            })
    except:
        continue

# 创建DataFrame
result_df = pd.DataFrame(leaders_data)

# 去重并按项目编号排序
result_df = result_df.drop_duplicates(subset=['项目编号'])
result_df = result_df.sort_values('项目编号')

# 保存到新的Excel文件
output_path = "项目负责人清单.xlsx"
result_df.to_excel(output_path, index=False, engine='openpyxl')

print(f"已提取 {len(result_df)} 条项目记录")
print(f"文件已保存至: {output_path}")

# 统计项目负责人出现次数
leader_count = defaultdict(int)
for leader in result_df['项目负责人']:
    if pd.notna(leader) and str(leader).strip():
        leader_count[str(leader).strip()] += 1

print("\n项目负责人统计（按负责项目数量排序）:")
for leader, count in sorted(leader_count.items(), key=lambda x: x[1], reverse=True):
    print(f"  {leader}: {count}个项目")