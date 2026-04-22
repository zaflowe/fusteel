# -*- coding: utf-8 -*-
"""
PDF 立项申请表解析模块
Q/FG G0286-2022 附录 A 版本 2/0

勾选框字符：
  \ue6a4 = ☑ 多选已勾
  \ue6a5 = □ 多选未勾
  \ue640 = ☑ 单选已勾 (是/需要)
  \ue63f = □ 单选未勾 (否/不需要)
"""
import io
import re
from typing import Optional
from datetime import datetime, date
from difflib import SequenceMatcher

try:
    from dateutil.relativedelta import relativedelta
    HAS_DATEUTIL = True
except ImportError:
    HAS_DATEUTIL = False

try:
    import pdfplumber
    HAS_PDFPLUMBER = True
except ImportError:
    HAS_PDFPLUMBER = False

# ── 勾选字符常量 ──────────────────────────────────────────────
CHECKED_MULTI   = '\ue6a4'   # ☑ 多选框已选
UNCHECKED_MULTI = '\ue6a5'   # □ 多选框未选
CHECKED_SINGLE  = '\ue640'   # ☑ 单选框已选
UNCHECKED_SINGLE = '\ue63f'  # □ 单选框未选

# ── 各勾选组选项顺序（严格按 PDF 表单顺序）──────────────────────
SITE_OPTIONS = [
    ('轧钢厂长材车间', '长材厂'),
    ('轧钢厂大棒车间', '大棒厂'),
    ('特钢厂', '特钢厂'),
    ('涂层厂', '涂层厂'),
    ('特冶厂', '特冶厂'),
    ('其他', None),        # 其他忽略
]

COMPANY_OPTIONS = [
    ('富钢', '富钢'),
    ('盛特隆', '盛特隆'),
    ('富佰', '富佰'),
    ('隆毅', '隆毅'),
    ('全部', None),
    ('其他', None),
]

PURPOSE_OPTIONS = [
    ('工艺改善', '工艺改善'),
    ('节能降耗', '节能降耗'),
    ('质量提升', '质量提升'),
    ('成本优化', '成本优化'),
    ('产业提升', '产业提升'),
    ('安全环保', '安全环保'),
    ('布局优化', '布局优化'),
    ('信息化', '信息化'),
    ('其他', None),
]

METHOD_OPTIONS = [
    ('管理创新', '管理创新'),
    ('技术改造', '技术改造'),
    ('新产品新工艺', '新产品新工艺'),
    ('战略性项目', '战略性项目'),
]

EVAL_OPTIONS  = ['需要', '不需要', '不清楚']
YESNO_OPTIONS = ['是', '否']


def _match_multi(text_block: str, options: list) -> list:
    """
    从文本块中按顺序提取 CHECKED_MULTI/UNCHECKED_MULTI 序列，
    映射到 options 列表，返回已选项的标签名（None 的忽略）。
    """
    chars = [c for c in text_block if c in (CHECKED_MULTI, UNCHECKED_MULTI)]
    selected = []
    for i, ch in enumerate(chars):
        if i < len(options) and ch == CHECKED_MULTI:
            label = options[i][1]   # 标签名
            if label is not None:
                selected.append(label)
    return selected


def _match_single(text_block: str, options: list) -> Optional[str]:
    """从文本块中按顺序提取 CHECKED_SINGLE/UNCHECKED_SINGLE 序列，返回选中选项。"""
    chars = [c for c in text_block if c in (CHECKED_SINGLE, UNCHECKED_SINGLE)]
    for i, ch in enumerate(chars):
        if i < len(options) and ch == CHECKED_SINGLE:
            return options[i]
    return None


def _find_table_cell_value(tables: list, key_substring: str) -> Optional[str]:
    """
    在所有提取的表格里，找包含 key_substring 的单元格，
    返回同行的下一个非空单元格文本。
    """
    for table in tables:
        for row in table:
            for j, cell in enumerate(row):
                if cell and key_substring in str(cell):
                    # 找同行后面第一个非空格
                    for k in range(j + 1, len(row)):
                        val = row[k]
                        if val and str(val).strip():
                            return str(val).strip()
    return None


def _extract_float(pattern: str, text: str) -> Optional[float]:
    m = re.search(pattern, text)
    if m:
        try:
            return float(m.group(1))
        except:
            pass
    return None


def _extract_str(pattern: str, text: str) -> Optional[str]:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else None


def _parse_date(raw: Optional[str]) -> Optional[str]:
    """将各种日期格式标准化为 YYYY-MM-DD 字符串"""
    if not raw:
        return None
    raw = raw.strip()
    # 2026-03-16
    m = re.search(r'(\d{4})-(\d{1,2})-(\d{1,2})', raw)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    # 2026年3月30日
    m = re.search(r'(\d{4})年(\d{1,2})月(\d{1,2})日?', raw)
    if m:
        return f"{m.group(1)}-{int(m.group(2)):02d}-{int(m.group(3)):02d}"
    return None


def parse_project_pdf(file_bytes: bytes) -> dict:
    """
    解析 Q/FG G0286-2022 格式的技改创新立项申请 PDF。
    返回 dict，字段名与 Project 模型一一对应，可直接用于创建或更新项目。
    """
    if not HAS_PDFPLUMBER:
        raise RuntimeError("pdfplumber 未安装，请运行: pip install pdfplumber")

    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        # 合并所有页的文本（保留特殊字符）
        full_text = '\n'.join(page.extract_text() or '' for page in pdf.pages)

        # 提取所有页的表格
        all_tables = []
        for page in pdf.pages:
            tables = page.extract_tables()
            if tables:
                all_tables.extend(tables)

    # ── 文本字段提取 ──────────────────────────────────────────
    project_code = _extract_str(r'项目编号[：:]\s*(JGCX-\d{4}-\d+)', full_text)
    department   = _extract_str(r'申报单位[：:]\s*(.+?)\s+日期', full_text)
    created_date = _extract_str(r'日期[：:]\s*(\d{4}-\d{2}-\d{2})', full_text)

    # 项目名称：从表格提取更可靠
    title = _find_table_cell_value(all_tables, '项目名称')
    if not title:
        title = _extract_str(r'项目名称\s+(.+?)\s+改造项目提出者', full_text)

    proposer = _find_table_cell_value(all_tables, '改造项目提出者')

    leader = _find_table_cell_value(all_tables, '项目实施负责人')
    if leader:
        # 清除括号内容
        leader = re.sub(r'[（(].+?[）)]', '', leader).strip()

    participants_raw = _find_table_cell_value(all_tables, '项目主要参与人员')
    participants = []
    if participants_raw:
        participants = [p.strip() for p in re.split(r'[、,，\s]+', participants_raw) if p.strip()]

    post_delivery = _find_table_cell_value(all_tables, '项目交付后负责人')

    # 实施周期
    period_str = _extract_str(r'实施周期[：:]?\s*(\d+)\s*个月', full_text)
    implementation_period = int(period_str) if period_str else None

    # 预计开始日期
    start_date_raw = _extract_str(r'预计开始日期[：:]\s*(.+?)\s*[；;]', full_text)
    planned_start_date = _parse_date(start_date_raw)

    # 预计结束日期：由 start + implementation_period 个月 推算
    # 这里保留为 'YYYY-MM-DD' 字符串，main.py 统一转 datetime 存库
    planned_end_date = None
    if planned_start_date and implementation_period:
        try:
            _start_dt = datetime.strptime(planned_start_date, '%Y-%m-%d')
            if HAS_DATEUTIL:
                _end_dt = _start_dt + relativedelta(months=int(implementation_period))
            else:
                # 回退方案：按 30 天/月估算
                from datetime import timedelta as _td
                _end_dt = _start_dt + _td(days=int(implementation_period) * 30)
            planned_end_date = _end_dt.strftime('%Y-%m-%d')
        except Exception:
            planned_end_date = None

    # 投入 / 收益
    #
    # 立项表里经常写 ">1"、"约 5"、"0.5"、"小于 10" 等非纯数字格式，
    # 之前只匹配 \d+ 会丢掉所有带前缀/修饰词的值。
    # 策略：
    #   budget_text / expected_revenue_text：抓取 "xxx(万元)" 括号前的整段原始字符串（保留符号）
    #   budget / expected_revenue：尝试从该字符串中抽取第一个数字，抽不到就 None（不阻塞）
    budget_text = _extract_str(r'投入[：:]\s*([^\n（(]+?)\s*[\(（]\s*万元\s*[\)）]', full_text)
    expected_revenue_text = _extract_str(r'预计收益[：:]\s*([^\n（(]+?)\s*[\(（]\s*万元\s*/\s*年\s*[\)）]', full_text)

    def _first_number(s: Optional[str]) -> Optional[float]:
        """从含有 '>1'、'约 5'、'0.5' 等的字符串里提取第一个正数浮点。"""
        if not s:
            return None
        m = re.search(r'(\d+(?:\.\d+)?)', s)
        if m:
            try:
                return float(m.group(1))
            except Exception:
                return None
        return None

    budget = _first_number(budget_text)
    expected_revenue = _first_number(expected_revenue_text)

    # 一次性投入/收益 → 在"注明"行之后
    annotation_block = ''
    m = re.search(r'注明[：:](.+?)(?:\n|$)', full_text)
    if m:
        annotation_block = m.group(1)
    is_one_time_investment = _match_single(annotation_block[:annotation_block.find('一次性收益')] if '一次性收益' in annotation_block else annotation_block, YESNO_OPTIONS)
    is_one_time_revenue    = _match_single(annotation_block[annotation_block.find('一次性收益'):] if '一次性收益' in annotation_block else '', YESNO_OPTIONS)

    # 定量目标具体描述
    quant_goal = _find_table_cell_value(all_tables, '（3）具体描述')
    if not quant_goal:
        m = re.search(r'（3）具体描述[^；]*；\s*\n(.+?)(?:二、|$)', full_text, re.DOTALL)
        if m:
            quant_goal = m.group(1).strip()

    # 现状问题
    current_problem = _find_table_cell_value(all_tables, '目前存在的问题')
    if not current_problem:
        current_problem = _find_table_cell_value(all_tables, '项目背景')

    # 技术指标及主要方案
    technical_solution = _find_table_cell_value(all_tables, '解决的技术指标')

    # ── 勾选框字段（扁平化匹配）─────────────────────────────────
    # PDF 多选勾选字符按出现顺序依次对应：
    #   SITE (6项) → COMPANY (6项) → PURPOSE (9项) → METHOD (4项)
    # 合计 25 个多选字符。用顺序切片比按锚点定位行更稳健。
    multi_chars = [c for c in full_text if c in (CHECKED_MULTI, UNCHECKED_MULTI)]

    def _slice_match(start: int, options: list) -> list:
        """按切片取出 len(options) 个勾选字符，映射到 options 标签列表"""
        chunk = multi_chars[start:start + len(options)]
        selected = []
        for ch, (_, label) in zip(chunk, options):
            if ch == CHECKED_MULTI and label is not None:
                selected.append(label)
        return selected

    improvement_site    = _slice_match(0, SITE_OPTIONS)
    owning_company      = _slice_match(len(SITE_OPTIONS), COMPANY_OPTIONS)
    improvement_purpose = _slice_match(len(SITE_OPTIONS) + len(COMPANY_OPTIONS), PURPOSE_OPTIONS)
    improvement_method  = _slice_match(
        len(SITE_OPTIONS) + len(COMPANY_OPTIONS) + len(PURPOSE_OPTIONS),
        METHOD_OPTIONS,
    )

    # 单选字段：是否需要能评/环评/安评（出现在多选之后）
    def _get_block(*anchors):
        for line in full_text.split('\n'):
            if any(a in line for a in anchors) and (CHECKED_SINGLE in line or UNCHECKED_SINGLE in line):
                return line
        return ''

    eval_block = _get_block('需要', '不需要', '不清楚')
    needs_evaluation = _match_single(eval_block, EVAL_OPTIONS)

    # ── 自动生成标签 ──────────────────────────────────────────
    tags = ['#实施中']
    for site in improvement_site:
        tags.append(f'#{site}')
    for comp in owning_company:
        tags.append(f'#{comp}')
    for purp in improvement_purpose:
        tags.append(f'#{purp}')
    for meth in improvement_method:
        tags.append(f'#{meth}')

    return {
        # 基础字段
        'project_code':         project_code,
        'title':                title or '（未识别项目名称）',
        'department':           department,
        'created_date':         created_date,   # 申报日期，用于前端显示
        'leader':               leader,
        'participants':         participants,
        'tags':                 tags,
        # 新增字段
        'proposer':             proposer,
        'post_delivery_person': post_delivery,
        'improvement_site':     improvement_site,
        'owning_company':       owning_company,
        'improvement_purpose':  improvement_purpose,
        'improvement_method':   improvement_method,
        'needs_evaluation':     needs_evaluation,
        'implementation_period': implementation_period,
        'planned_start_date':   planned_start_date,
        'planned_end_date':     planned_end_date,
        'budget':               budget,
        'budget_text':          budget_text,
        'expected_revenue':     expected_revenue,
        'expected_revenue_text': expected_revenue_text,
        'is_one_time_investment': (is_one_time_investment == '是') if is_one_time_investment else None,
        'is_one_time_revenue':    (is_one_time_revenue == '是') if is_one_time_revenue else None,
        'quantitative_goal':    quant_goal,
        'current_problem':      current_problem,
        'technical_solution':   technical_solution,
    }


def fuzzy_match_project(pdf_title: str, existing_titles: list, threshold: float = 0.80) -> Optional[str]:
    """
    对 pdf_title 与 existing_titles 做模糊匹配。
    返回匹配率 >= threshold 的最佳匹配项目标题，否则返回 None。
    """
    best_ratio = 0.0
    best_title = None
    for title in existing_titles:
        ratio = SequenceMatcher(None, pdf_title, title).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best_title = title
    if best_ratio >= threshold:
        return best_title
    return None
