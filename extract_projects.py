import pandas as pd
import os

# 读取Excel文件
file_path = '技改创新申请 (1).xlsx'

# 读取工作表一，跳过前2行标题
df1 = pd.read_excel(file_path, sheet_name='技改创新申请', header=2)
df2 = pd.read_excel(file_path, sheet_name='技改创新在列清单')

print('=== 工作表一：技改创新申请 ===')
print(f'行数: {len(df1)}')
print(f'列数: {len(df1.columns)}')
print(f'列名: {list(df1.columns)}')
print()

print('=== 工作表二：技改创新在列清单 ===')
print(f'行数: {len(df2)}')
print(f'列数: {len(df2.columns)}')
print(f'列名: {list(df2.columns)}')
print()

# 获取清单中的项目名称
project_list = df2.iloc[:, 0].dropna().tolist()
print(f'清单中共有 {len(project_list)} 个项目')
print()

# 找到E列（项目名称）在df1中的位置
# 从文件内容看，E列是"项目名称"
project_col = '项目名称'

if project_col in df1.columns:
    print(f'找到列: {project_col}')
    
    # 检查哪些项目在清单中
    df1['在清单中'] = df1[project_col].isin(project_list)
    matched_count = df1['在清单中'].sum()
    print(f'匹配到的项目数: {matched_count}')
    
    # 提取匹配的行
    df_matched = df1[df1['在清单中'] == True].copy()
    
    # 删除辅助列
    df_matched = df_matched.drop(columns=['在清单中'])
    
    print(f'提取行数: {len(df_matched)}')
    print()
    
    # 显示匹配的项目名称
    print('=== 匹配的项目名称 ===')
    for i, name in enumerate(df_matched[project_col].tolist(), 1):
        print(f'{i}. {name}')
    print()
    
    # 保存到新Excel文件
    output_file = '技改创新申请_清单内项目.xlsx'
    df_matched.to_excel(output_file, index=False, sheet_name='清单内项目')
    print(f'已保存到: {output_file}')
    print(f'完整路径: {os.path.abspath(output_file)}')
else:
    print(f'未找到列: {project_col}')
    print('可用列名:', list(df1.columns))
