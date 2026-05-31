"""
V4 Markdown → docx 转换脚本
样式严格按《学校规范摘录.md》，不参考 V3 docx。
"""
import re
from docx import Document
from docx.shared import Pt, Cm, Emu, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.section import WD_ORIENT
from docx.oxml.ns import qn, nsdecls
from docx.oxml import parse_xml

INPUT_MD = "D:/projects/party-agent/outputs/党务Agent_软件设计文档_V4_P0改造完成.md"
OUTPUT_DOCX = "D:/projects/party-agent/outputs/党务Agent_软件设计文档_V4.docx"
OUTPUT_REPORT = "D:/projects/party-agent/outputs/转换报告.md"

# ── font sizes (Chinese naming → pt) ──
SAN_HAO = Pt(16)       # 三号
XIAO_SAN = Pt(15)      # 小三号
SI_HAO = Pt(14)        # 四号
XIAO_SI = Pt(12)       # 小四号
WU_HAO = Pt(10.5)      # 五号
XIAO_WU = Pt(9)        # 小五号

FONT_SONG = "宋体"
FONT_TNR = "Times New Roman"
LINE_SPACING_18 = Pt(18)  # 固定值 18 磅

# ── stats ──
stats = {
    "tags_removed": {"决策": 0, "V3 迁移": 0, "V3 改写": 0, "CC 补充": 0},
    "placeholders_kept": {"待用户填写": 0, "待用户决策": 0},
    "cc_placeholder_kept": 0,
    "heading_counts": {1: 0, 2: 0, 3: 0},
    "table_count": 0,
    "figure_count": 0,
    "total_paragraphs": 0,
    "status_blocks_removed": 0,
}

# ══════════════════════════════════════════
# STEP 1: Read and preprocess markdown
# ══════════════════════════════════════════
with open(INPUT_MD, "r", encoding="utf-8") as f:
    raw = f.read()

# --- Step 1a: Remove review tags (sentence-end tags only) ---
for tag_name, pattern in [
    ("决策", r"\[决策 \d+\.\d+\]"),
    ("V3 迁移", r"\[V3 迁移\]"),
    ("V3 改写", r"\[V3 改写\]"),
    ("CC 补充", r"(?<!\：)\[CC 补充\]"),  # only bare [CC 补充], not [CC 补充：...]
]:
    found = re.findall(pattern, raw)
    stats["tags_removed"][tag_name] = len(found)
    raw = re.sub(pattern, "", raw)

# --- Step 1b: Remove appendix section ---
appendix_match = re.search(r"^## 附录：段落索引", raw, re.MULTILINE)
if appendix_match:
    raw = raw[:appendix_match.start()]

# --- Step 1c: Remove version metadata at end ---
raw = re.sub(r"\*\*文档版本\*\*：.*?\n\*\*起草工具\*\*：.*?\n\*\*起草日期\*\*：.*?\n?", "", raw)

# --- Step 1d: Remove "本章状态总览" blocks ---
status_pattern = r"> 本章状态总览\n(?:> .*\n)*"
status_found = re.findall(status_pattern, raw)
stats["status_blocks_removed"] = len(status_found)
raw = re.sub(status_pattern, "", raw)

# Count remaining placeholders
stats["placeholders_kept"]["待用户填写"] = len(re.findall(r"\[待用户填写", raw))
stats["placeholders_kept"]["待用户决策"] = len(re.findall(r"\[待用户决策", raw))
stats["cc_placeholder_kept"] = len(re.findall(r"\[CC 补充：", raw))

# ══════════════════════════════════════════
# STEP 2: Parse markdown into blocks
# ══════════════════════════════════════════
lines = raw.split("\n")

blocks = []  # list of (type, content, extra)
# types: "h1", "h2", "h3", "para", "table_caption", "table", "figure_caption",
#        "code_block", "hr", "blank", "list_item", "placeholder"

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.strip()

    # Skip blank lines and horizontal rules
    if stripped == "" or stripped == "---":
        i += 1
        continue

    # Headings
    if stripped.startswith("### "):
        blocks.append(("h3", stripped[4:].strip()))
        stats["heading_counts"][3] += 1
        i += 1
        continue
    if stripped.startswith("## "):
        blocks.append(("h2", stripped[3:].strip()))
        stats["heading_counts"][2] += 1
        i += 1
        continue
    if stripped.startswith("# "):
        blocks.append(("h1", stripped[2:].strip()))
        stats["heading_counts"][1] += 1
        i += 1
        continue

    # Code blocks
    if stripped.startswith("```"):
        code_lines = []
        i += 1
        while i < len(lines) and not lines[i].strip().startswith("```"):
            code_lines.append(lines[i])
            i += 1
        blocks.append(("code_block", "\n".join(code_lines)))
        i += 1  # skip closing ```
        continue

    # Table: detect by | at start
    if stripped.startswith("|"):
        table_lines = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            table_lines.append(lines[i].strip())
            i += 1
        blocks.append(("table", table_lines))
        stats["table_count"] += 1
        continue

    # Markdown list items (目录 section)
    if stripped.startswith("- "):
        blocks.append(("list_item", stripped[2:].strip()))
        i += 1
        continue

    # Placeholder paragraphs
    if "[待用户填写" in stripped or "[待用户决策" in stripped or "[CC 补充：" in stripped:
        blocks.append(("placeholder", stripped))
        i += 1
        continue

    # Figure captions (lines starting with 图 X.Y or [CC 补充：此处图)
    if re.match(r"^图 \d+\.\d+", stripped):
        blocks.append(("figure_caption", stripped))
        stats["figure_count"] += 1
        i += 1
        continue

    # Table captions (lines starting with 表 X.Y)
    if re.match(r"^表 \d+\.\d+", stripped):
        blocks.append(("table_caption", stripped))
        i += 1
        continue

    # Regular paragraph
    blocks.append(("para", stripped))
    stats["total_paragraphs"] += 1
    i += 1

# ══════════════════════════════════════════
# STEP 3: Create docx with proper styles
# ══════════════════════════════════════════
doc = Document()

# --- Page setup: A4, margins ---
section = doc.sections[0]
section.page_width = Cm(21.0)
section.page_height = Cm(29.7)
section.top_margin = Cm(2.54)
section.bottom_margin = Cm(2.54)
section.left_margin = Cm(3.17)
section.right_margin = Cm(3.17)

# --- Page number: bottom center ---
footer = section.footer
footer.is_linked_to_previous = False
fp = footer.paragraphs[0]
fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
run = fp.add_run()
fldChar1 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
run._r.append(fldChar1)
run2 = fp.add_run()
instrText = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> PAGE </w:instrText>')
run2._r.append(instrText)
run3 = fp.add_run()
fldChar2 = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
run3._r.append(fldChar2)

# --- Header: double line, 五号 centered ---
header = section.header
header.is_linked_to_previous = False
hp = header.paragraphs[0]
hp.alignment = WD_ALIGN_PARAGRAPH.CENTER
hr = hp.add_run("西安工业大学毕业设计(论文)")
hr.font.size = WU_HAO
hr.font.name = FONT_SONG
hr._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_SONG)
# Double line border under header
pPr = hp._p.get_or_add_pPr()
pBdr = parse_xml(
    f'<w:pBdr {nsdecls("w")}>'
    f'  <w:bottom w:val="double" w:sz="6" w:space="1" w:color="auto"/>'
    f'</w:pBdr>'
)
pPr.append(pBdr)


def set_font(run, name_cn=FONT_SONG, name_en=FONT_TNR, size=XIAO_SI, bold=False, italic=False, color=None):
    run.font.size = size
    run.font.name = name_en
    run._element.rPr.rFonts.set(qn("w:eastAsia"), name_cn)
    run.font.bold = bold
    run.font.italic = italic
    if color:
        run.font.color.rgb = color


def set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.JUSTIFY, first_indent=None,
                         line_spacing=LINE_SPACING_18, space_before=Pt(0), space_after=Pt(0)):
    pf = para.paragraph_format
    pf.alignment = alignment
    pf.line_spacing = line_spacing
    pf.line_spacing_rule = 0  # EXACTLY
    pf.space_before = space_before
    pf.space_after = space_after
    if first_indent is not None:
        pf.first_line_indent = first_indent


def add_heading_1(doc, text):
    """三号宋体加粗，居中，前后各空一行"""
    para = doc.add_paragraph()
    set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                         space_before=Pt(24), space_after=Pt(24))
    run = para.add_run(text)
    set_font(run, size=SAN_HAO, bold=True)
    return para


def add_heading_2(doc, text):
    """四号宋体加粗，左顶格"""
    para = doc.add_paragraph()
    set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                         space_before=Pt(12), space_after=Pt(6))
    run = para.add_run(text)
    set_font(run, size=SI_HAO, bold=True)
    return para


def add_heading_3(doc, text):
    """小四号宋体加粗，左顶格"""
    para = doc.add_paragraph()
    set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.LEFT,
                         space_before=Pt(6), space_after=Pt(3))
    run = para.add_run(text)
    set_font(run, size=XIAO_SI, bold=True)
    return para


def add_normal_para(doc, text, first_indent=Emu(480 * 2 * 635)):
    """小四号宋体，首行缩进2字符"""
    para = doc.add_paragraph()
    set_paragraph_format(para, first_indent=first_indent)
    # Handle bold markers **...**
    parts = re.split(r"(\*\*.*?\*\*)", text)
    for part in parts:
        if part.startswith("**") and part.endswith("**"):
            run = para.add_run(part[2:-2])
            set_font(run, bold=True)
        else:
            run = para.add_run(part)
            set_font(run)
    return para


def add_placeholder_para(doc, text):
    """浅灰色斜体，标记待填写段落"""
    para = doc.add_paragraph()
    set_paragraph_format(para, first_indent=Emu(480 * 2 * 635))
    run = para.add_run(text)
    set_font(run, italic=True, color=RGBColor(0x80, 0x80, 0x80))
    return para


def add_figure_caption(doc, text):
    """五号宋体居中"""
    para = doc.add_paragraph()
    set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                         space_before=Pt(6), space_after=Pt(6))
    run = para.add_run(text)
    set_font(run, size=WU_HAO)
    return para


def add_table_caption(doc, text):
    """五号宋体居中，在表上方"""
    para = doc.add_paragraph()
    set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                         space_before=Pt(6), space_after=Pt(3))
    run = para.add_run(text)
    set_font(run, size=WU_HAO)
    return para


def parse_table_lines(table_lines):
    """Parse markdown table lines into header + rows"""
    rows = []
    for line in table_lines:
        cells = [c.strip() for c in line.strip("|").split("|")]
        rows.append(cells)
    # Remove separator row (contains ---)
    data_rows = [r for r in rows if not all(re.match(r"^-+$", c.strip()) for c in r)]
    if len(data_rows) < 1:
        return [], []
    return data_rows[0], data_rows[1:]


def add_table(doc, table_lines):
    """Add a formatted table"""
    header, rows = parse_table_lines(table_lines)
    if not header:
        return
    ncols = len(header)
    tbl = doc.add_table(rows=1 + len(rows), cols=ncols)
    tbl.style = "Table Grid"
    # Header row
    for j, cell_text in enumerate(header):
        cell = tbl.rows[0].cells[j]
        cell.text = ""
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        run = p.add_run(cell_text)
        set_font(run, size=WU_HAO, bold=True)
        # Light blue header background
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="D9E2F3"/>')
        cell._tc.get_or_add_tcPr().append(shading)
    # Data rows
    for i, row in enumerate(rows):
        for j, cell_text in enumerate(row):
            if j < ncols:
                cell = tbl.rows[i + 1].cells[j]
                cell.text = ""
                p = cell.paragraphs[0]
                run = p.add_run(cell_text)
                set_font(run, size=WU_HAO)
    return tbl


def add_code_block(doc, text):
    """等宽字体段落"""
    para = doc.add_paragraph()
    set_paragraph_format(para, first_indent=Emu(480 * 2 * 635))
    run = para.add_run(text)
    run.font.size = WU_HAO
    run.font.name = "Courier New"
    run._element.rPr.rFonts.set(qn("w:eastAsia"), FONT_SONG)
    return para


# ══════════════════════════════════════════
# STEP 4: Render blocks into docx
# ══════════════════════════════════════════

# Skip the title block (first few lines before chapter 1)
# We need to handle: title, subtitle, author, advisor, date, abstract, toc
in_toc = False
in_abstract = False
abstract_title_done = False
en_abstract = False
skip_toc_items = False

for idx, block in enumerate(blocks):
    btype = block[0]
    content = block[1] if len(block) > 1 else ""

    # ── Title page elements ──
    if btype == "h1" and content == "基于 Dify 的高校党务 AI 平台设计开发":
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(72), space_after=Pt(12))
        run = para.add_run(content)
        set_font(run, size=Pt(22), bold=True)
        continue

    if btype == "para" and "毕业设计" in content and "设计文档" in content:
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(6), space_after=Pt(6))
        run = para.add_run(content.replace("**", "").replace("（", "(").replace("）", ")"))
        set_font(run, size=SI_HAO, bold=True)
        continue

    if btype == "para" and ("撰写人" in content or "指导教师" in content or "2026 年" in content):
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(3), space_after=Pt(3))
        run = para.add_run(content)
        set_font(run, size=SAN_HAO if "2026" not in content else SI_HAO)
        continue

    # ── Abstract ──
    if btype == "h2" and content == "摘要":
        doc.add_page_break()
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(24), space_after=Pt(12))
        run = para.add_run("摘要")
        set_font(run, size=XIAO_SAN, bold=True)
        in_abstract = True
        continue

    if btype == "h2" and content == "Abstract":
        doc.add_page_break()
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(24), space_after=Pt(12))
        run = para.add_run("Abstract")
        run.font.size = XIAO_SAN
        run.font.name = FONT_TNR
        run.font.bold = True
        en_abstract = True
        in_abstract = False
        continue

    # Keywords
    if btype == "para" and content.startswith("**关键词**"):
        para = doc.add_paragraph()
        set_paragraph_format(para, first_indent=Emu(480 * 2 * 635))
        run = para.add_run("关键词")
        set_font(run, bold=True)
        run2 = para.add_run(content.replace("**关键词**", ""))
        set_font(run2)
        in_abstract = False
        continue

    if btype == "para" and content.startswith("**Key Words**"):
        para = doc.add_paragraph()
        set_paragraph_format(para, first_indent=Emu(480 * 2 * 635))
        run = para.add_run("Key Words")
        set_font(run, name_cn=FONT_TNR, bold=True)
        run2 = para.add_run(content.replace("**Key Words**", ""))
        set_font(run2, name_cn=FONT_TNR)
        en_abstract = False
        continue

    # ── TOC section ──
    if btype == "h2" and content == "目录":
        doc.add_page_break()
        para = doc.add_paragraph()
        set_paragraph_format(para, alignment=WD_ALIGN_PARAGRAPH.CENTER,
                             space_before=Pt(24), space_after=Pt(12))
        run = para.add_run("目录")
        set_font(run, size=XIAO_SAN, bold=True)
        # Insert TOC field
        p_toc = doc.add_paragraph()
        run_toc = p_toc.add_run()
        fldChar_begin = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="begin"/>')
        run_toc._r.append(fldChar_begin)
        run_toc2 = p_toc.add_run()
        instrText = parse_xml(f'<w:instrText {nsdecls("w")} xml:space="preserve"> TOC \\o "1-3" \\h \\z \\u </w:instrText>')
        run_toc2._r.append(instrText)
        run_toc3 = p_toc.add_run()
        fldChar_end = parse_xml(f'<w:fldChar {nsdecls("w")} w:fldCharType="end"/>')
        run_toc3._r.append(fldChar_end)
        skip_toc_items = True
        continue

    # Skip markdown TOC list items
    if skip_toc_items and btype == "list_item":
        continue
    if skip_toc_items and btype != "list_item":
        skip_toc_items = False

    # ── Chapter headings ──
    if btype == "h1":
        # Check if it's a numbered chapter
        if re.match(r"^\d+\s", content):
            doc.add_page_break()
        add_heading_1(doc, content)
        continue

    if btype == "h2":
        add_heading_2(doc, content)
        continue

    if btype == "h3":
        add_heading_3(doc, content)
        continue

    # ── Tables ──
    if btype == "table_caption":
        add_table_caption(doc, content)
        continue

    if btype == "table":
        add_table(doc, content)
        continue

    # ── Figures ──
    if btype == "figure_caption":
        add_figure_caption(doc, content)
        continue

    # ── Code blocks ──
    if btype == "code_block":
        add_code_block(doc, content)
        continue

    # ── Placeholders ──
    if btype == "placeholder":
        add_placeholder_para(doc, content)
        continue

    # ── Normal paragraphs ──
    if btype == "para":
        if en_abstract:
            para = doc.add_paragraph()
            set_paragraph_format(para, first_indent=Emu(480 * 2 * 635))
            run = para.add_run(content)
            set_font(run, name_cn=FONT_TNR)
        else:
            add_normal_para(doc, content)
        continue

# ══════════════════════════════════════════
# STEP 5: Save
# ══════════════════════════════════════════
doc.save(OUTPUT_DOCX)
print(f"Saved: {OUTPUT_DOCX}")

# ══════════════════════════════════════════
# STEP 6: Generate report
# ══════════════════════════════════════════
total_tags = sum(stats["tags_removed"].values())
report = f"""# V4 Markdown → docx 转换报告

## 基本统计

| 项目 | 数值 |
|------|------|
| 章节数（第一级） | {stats["heading_counts"][1]} |
| 节数（第二级） | {stats["heading_counts"][2]} |
| 小节数（第三级） | {stats["heading_counts"][3]} |
| 正文段落数 | {stats["total_paragraphs"]} |
| 表格数 | {stats["table_count"]} |
| 图表占位数 | {stats["figure_count"]} |

## 预处理：清除的标签

| 标签类型 | 清除数量 |
|---------|---------|
| [决策 X.Y] | {stats["tags_removed"]["决策"]} |
| [V3 迁移] | {stats["tags_removed"]["V3 迁移"]} |
| [V3 改写] | {stats["tags_removed"]["V3 改写"]} |
| [CC 补充] | {stats["tags_removed"]["CC 补充"]} |
| **合计** | **{total_tags}** |

## 预处理：其他清除项

| 项目 | 数量 |
|------|------|
| "本章状态总览"块 | {stats["status_blocks_removed"]} |
| 附录段落索引 | 1（整块删除） |
| 文档版本元信息 | 1（整块删除） |

## 保留的占位段落

| 类型 | 数量 |
|------|------|
| [待用户填写:...] | {stats["placeholders_kept"]["待用户填写"]} |
| [待用户决策:...] | {stats["placeholders_kept"]["待用户决策"]} |
| [CC 补充：...] 带冒号的占位说明 | {stats["cc_placeholder_kept"]} |

## 样式应用说明

| 元素 | 样式 |
|------|------|
| 章标题（# X） | 三号宋体加粗，居中 |
| 节标题（## X.Y） | 四号宋体加粗，左顶格 |
| 小节标题（### X.Y.Z） | 小四号宋体加粗，左顶格 |
| 正文 | 小四号宋体，固定值 18 磅行距，首行缩进 2 字符 |
| 摘要标题 | 小三号宋体加粗，居中 |
| 表题 | 五号宋体居中，表上方 |
| 图题 | 五号宋体居中，图下方 |
| 表头 | 五号宋体加粗，浅蓝背景(D9E2F3) |
| 表格内容 | 五号宋体 |
| 页眉 | 五号居中，双线，"西安工业大学毕业设计(论文)" |
| 页码 | 底部居中 |
| 占位段落 | 浅灰色斜体 |

## 已知需要手动检查的样式问题

1. **页眉每章开始页**：python-docx 不支持按章切换页眉内容（需要为每章创建新 section），当前所有页统一使用"西安工业大学毕业设计(论文)"。如需每章首页显示章标题，需在 Word 中手动设置分节符。
2. **目录页码**：已插入 TOC 字段，但首次打开 docx 时需要右键目录 →"更新域"→"更新整个目录"才能显示页码。
3. **图片插入**：当前所有图表位置为文字占位（如"图 2.1 党务 Agent 系统功能结构图"），实际图片需要在 Word 中手动插入 PNG 文件。
4. **章标题占行数**：学校规范要求章标题"占 4 行"、节标题"占 2.5 行"，python-docx 通过段前段后间距近似实现，可能与学校模板的精确行距有微小偏差。
5. **首行缩进精度**：学校规范要求"2 中文字符"，脚本按小四号字宽计算为约 480 EMU × 2，实际效果可能因字体渲染略有差异。

---

**生成时间**：脚本运行时自动生成
**样式来源**：《学校规范摘录.md》（不参考 V3 docx）
"""

with open(OUTPUT_REPORT, "w", encoding="utf-8") as f:
    f.write(report)
print(f"Saved: {OUTPUT_REPORT}")
