"""
部门统计 · 9 分组关键词映射（按顺序匹配，首个命中即归入）。
详见 制度pdf与txt/部门统计页面需求.md v1.0
"""

from typing import List, Tuple

# (分组显示名, 关键词列表) — 顺序不可随意调整
DEPARTMENT_GROUP_RULES: List[Tuple[str, List[str]]] = [
    ("特钢厂", ["特钢"]),
    ("富佰（涂层厂）", ["富佰", "涂层"]),
    ("轧钢厂", ["轧钢", "大棒", "长材"]),
    ("特冶厂", ["特冶", "电渣"]),
    ("装备部", ["装备"]),
    ("生产部", ["生产部"]),
    ("能源部", ["能源"]),
]

OTHER_GROUP = "其他项目"
DEPARTMENT_GROUP_KEYS: List[str] = [name for name, _ in DEPARTMENT_GROUP_RULES] + [OTHER_GROUP]

STATUS_KEYS = ("实施中", "已完成", "已结项", "暂停中")


def classify_to_group(text: str) -> str:
    """对单段文本做模糊匹配，返回分组名。"""
    if not text:
        return OTHER_GROUP
    t = str(text).strip()
    for group_name, keywords in DEPARTMENT_GROUP_RULES:
        for kw in keywords:
            if kw in t:
                return group_name
    return OTHER_GROUP


def classify_project_groups(
    department: str | None,
    improvement_site: list | None,
    dimension: str = "department",
) -> List[str]:
    """
    返回项目归属的分组列表。
    - department：申报单位，仅 1 个分组
    - site：改造场地，可多分组各计 1
    """
    if dimension == "site":
        sites = improvement_site or []
        if not sites and department:
            sites = [department]
        if not sites:
            return [OTHER_GROUP]
        keys: List[str] = []
        seen = set()
        for s in sites:
            g = classify_to_group(str(s))
            if g not in seen:
                seen.add(g)
                keys.append(g)
        return keys or [OTHER_GROUP]
    return [classify_to_group(department or "")]
