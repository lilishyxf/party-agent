"""LLM prompt templates for each SKILL pipeline stage.

Each function returns a system instruction + user prompt pair that, when sent
to the LLM, produces structured JSON output for the pipeline stage.
"""
import json

# ── Stage 0: Sizheng Angle Suggestions ────────────────────────

SUGGEST_ANGLES_SYSTEM = """你是高校课程思政专家。你的任务是根据教师输入的专业知识点,分析其与思政教育的结合点,提出3-5个具体的思政角度供教师选择。

要求:
1. 每个角度必须具体,不能空泛。例如不要说"培养爱国精神",要说"通过XX技术的自主研发历程,体现科技自立自强"
2. 角度要有差异性:可以从不同维度切入,如国家战略、工匠精神、科技伦理、文化自信、社会责任等
3. 每个角度给一个简短的说明(1-2句),讲清楚这个角度的故事载体是什么
4. 结合当前中国科技发展和社会热点,让思政角度有时代感

输出格式(严格的JSON):
{
  "knowledge_point_summary": "对知识点的简要概括(一句话)",
  "angles": [
    {
      "label": "角度标题(8-15字)",
      "description": "这个角度的故事载体和思政价值(2-3句话)",
      "story_hint": "可以怎么讲这个故事(一句话)",
      "keywords": ["关键词1", "关键词2"]
    },
    ...
  ]
}
只输出JSON,不要其他文字。"""


def build_suggest_angles_prompt(knowledge_point: str) -> str:
    return f"""专业知识: {knowledge_point}

请分析这个知识点可以与哪些思政角度结合,给出3-5个具体的思政角度建议。"""


# ── Stage 1: Align ──────────────────────────────────────────

ALIGN_SYSTEM = """你是教学思政AI视频的"对齐规划"模块。你的任务是根据教师输入的专业知识点和思政角度,产出三样东西:

1. 对齐声明(一行):用「具体载体/案例」为故事载体,讲清楚「知识点」的「核心机制」,体现「思政价值」
2. Scene规划(8个Scene,每个Scene一句话beat,按8个教学功能排列)
3. 字数budget(每个Scene的目标旁白字数,总字数324字左右)

8个教学功能固定顺序:
Scene 1: 设景设问 — 用真实场景引出难题
Scene 2: 概念引入 — 知识点正式登场
Scene 3: 核心机制1 — 第一个关键步骤
Scene 4: 核心机制2 — 第二个关键步骤
Scene 5: 核心机制3 — 第三个步骤或综合
Scene 6: 结果展示 — 难题被解决
Scene 7: 思政升华 — 对国家/学科的意义
Scene 8: 价值收束 — 回到知识点,与开头呼应

Scene 3-5占总字数50%以上。每个Scene时长10-15秒,字数按3字/秒计算。

输出格式(严格的JSON):
{
  "alignment_statement": "...",
  "scenes": [
    {"number": 1, "teaching_function": "设景设问", "beat": "一句话叙事", "duration_seconds": 14, "word_count": 42},
    ...
  ],
  "total_word_count": 324
}
只输出JSON,不要其他文字。"""


def build_align_prompt(knowledge_point: str, sizheng_angle: str, style_track: str) -> str:
    return f"""知识点: {knowledge_point}
思政角度: {sizheng_angle}
视频风格轨道: {style_track}

请产出对齐声明、Scene规划、字数budget。"""


# ── Stage 2: Narrate ─────────────────────────────────────────

NARRATE_SYSTEM = """你是教学思政AI视频的"旁白撰写"模块。你的任务是把给定的知识点和思政角度,写成一段约324字的连贯播音旁白稿。

要求:
- 真在教知识点,不是设场景+喊口号
- 知识点是故事中具体问题的工具,机制讲到关键步骤
- 思政价值是人物/任务的内在动机或意义,不是结尾贴标签
- 节奏:约30s开场设景 → 约60s展开核心机制 → 约30s升华意义
- 中文播音语速约3字/秒,总字数320-360字
- 不要分段标注scene序号,就是一段连贯的播音稿
- 语言口语化,适合朗读,不要学术腔

只输出旁白文本,不要其他内容。"""


def build_narrate_prompt(knowledge_point: str, sizheng_angle: str, alignment: str, scene_plan: list) -> str:
    plan_text = "\n".join(
        f"Scene {s['number']}({s['teaching_function']}, {s['duration_seconds']}s/{s['word_count']}字): {s['beat']}"
        for s in scene_plan
    )
    return f"""知识点: {knowledge_point}
思政角度: {sizheng_angle}
对齐声明: {alignment}

Scene规划:
{plan_text}

总字数目标: 324字

请写出完整的连贯旁白稿。"""


# ── Stage 3: Prompt Gen ─────────────────────────────────────

PROMPTGEN_SYSTEM = """你是教学思政AI视频的"分镜提示词"模块。根据给定的Scene规划和旁白稿,为每个Scene生成AI视频生产指令。

每个Scene需要产出:
1. 旁白片段(从总旁白稿中切片,标注字数)
2. 首帧画面prompt(中文,给即梦生图,16:9,画面中不要有任何文字)
3. 尾帧画面prompt(中文,给即梦生图,16:9,画面中不要有任何文字)
4. 场景prompt(含台词)——描述画面动作和镜头运动,末尾嵌入完整台词文本
5. 后期文字/UI叠加建议(哪些文字在哪个时间点以什么样式叠加)

[style_prefix]会被替换为对应轨道的风格锁前缀。在prompt里写[style_prefix]即可。

场景prompt必须细节丰富:镜头轨迹、光线变化、动效顺序、节奏、首帧到尾帧的过渡。台词直接写"台词:"后跟完整旁白文本。

输出格式(严格的JSON):
{
  "scenes": [
    {
      "scene_number": 1,
      "teaching_function": "设景设问",
      "duration_seconds": 14,
      "narration_text": "旁白片段",
      "subtitle_text": "字幕文本(可与旁白同)",
      "narration_word_count": 42,
      "start_frame_prompt": "首帧画面prompt...",
      "end_frame_prompt": "尾帧画面prompt...",
      "scene_prompt": "场景动效描述...\\n\\n台词:\\\"...\\\"",
      "post_overlay": [
        {"time_seconds": 1, "position": "左下", "text": "...", "style": "白色时间戳"},
        ...
      ]
    },
    ...
  ]
}
只输出JSON,不要其他文字。"""


def build_promptgen_prompt(
    knowledge_point: str,
    sizheng_angle: str,
    style_track: str,
    style_prefix_zh: str,
    scene_plan: list,
    full_narration: str,
    composition_rules: list = None,
) -> str:
    plan_text = "\n".join(
        f"Scene {s['number']}({s['teaching_function']}, {s['duration_seconds']}s): {s['beat']}"
        for s in scene_plan
    )
    rules_text = "\n".join(f"- {r}" for r in (composition_rules or []))
    return f"""知识点: {knowledge_point}
思政角度: {sizheng_angle}
风格轨道: {style_track}
风格锁前缀(每个画面prompt前置): {style_prefix_zh}

Scene规划:
{plan_text}

完整旁白稿:
{full_narration}

构图硬规则:
{rules_text}

请为每个Scene生成完整的首尾帧prompt和场景动效prompt(含台词)。"""


# ── Safety Check ─────────────────────────────────────────────

SAFETY_KEYWORDS = [
    "习近平", "李克强", "毛泽东", "邓小平", "江泽民", "胡锦涛",
    "台独", "藏独", "疆独", "港独",
    "屠杀", "镇压", "暴政",
    "法轮功", "六四", "天安门事件",
]

SAFETY_PATTERNS = [
    ("台湾.*独立|台湾.*国家", "涉台表述违规"),
    ("西藏.*独立|新疆.*独立", "领土主权表述违规"),
    ("香港.*独立", "涉港表述违规"),
]


# ── Stage 3.5: Character Reference Sheet ─────────────────────

CHAR_ANALYSIS_SYSTEM = """你是视频角色分析专家。根据视频旁白稿和分镜规划,判断画面中是否会出现需要保持形象一致性的具体人物角色。

**需要生成角色参照图的情况**:
- 真实历史人物(如马克思、钱学森、焦裕禄等) → 必须生成
- 故事中有明确身份且多次出场的虚构人物(如"张工程师""李老师") → 建议生成
- 多次出场的具名角色 → 建议生成

**不需要生成角色参照图的情况**:
- 抽象泛指(如"工人们""科学家们""党员们") → 不生成
- 纯背影/剪影/手部特写 → 不生成
- 无人物出现的纯科技/工业/自然场景 → 不生成

对每个需要生成的角色,基于公众已知信息描述其真实样貌特征。

输出格式(严格的JSON):
{
  "has_characters": true,
  "reasoning": "简短判断依据",
  "characters": [
    {
      "name": "角色名",
      "appearance_zh": "MG扁平矢量风格下的人物样貌描述(2-3句中文)",
      "clothing": "典型服装描述",
      "age_range": "年龄段(如30-40岁)",
      "hair_style": "发型发色描述",
      "facial_features": "面部特征(胡须/眼镜等)",
      "build": "体型(如中等/偏瘦/魁梧)"
    }
  ]
}
只输出JSON,不要其他文字。"""


def build_char_analysis_prompt(full_narration: str, scene_plan: list, knowledge_point: str) -> str:
    plan_summary = "\n".join(
        f"Scene {s.get('number', s.get('scene_number', '?'))}: {s.get('teaching_function', '')} — {s.get('beat', s.get('narration_text', ''))[:80]}"
        for s in (scene_plan or [])[:8]
    )
    return f"""知识点: {knowledge_point}

分镜规划:
{plan_summary}

完整旁白稿:
{full_narration}

请分析这个视频中是否会出现需要保持形象一致性的具体人物角色。"""


def build_char_sheet_prompt(character: dict, style_prefix: str) -> str:
    """Build a character reference sheet (三视图) image prompt."""
    return (
        f"{style_prefix}, 角色三视图参照卡, 纯白背景, 无背景场景, "
        f"左侧区域: 面部特写, {character.get('facial_features', '')}, {character.get('hair_style', '')}, "
        f"右侧区域: 全身三视图(正面/侧面/背面), 穿着{character.get('clothing', '')}, "
        f"{character.get('appearance_zh', '')}, "
        f"{character.get('build', '中等')}体型, {character.get('age_range', '成年')}, "
        f"极简线条, 扁平色块, 无阴影无渐变, 画面中不要有任何文字, no text, no watermark, "
        f"角色设计稿, 人物设定图, character design sheet"
    )


# ── Safety Check ─────────────────────────────────────────────

def check_safety(text: str) -> tuple[bool, str | None]:
    """Returns (passed, reason). Reason is None if passed."""
    for kw in SAFETY_KEYWORDS:
        if kw in text:
            return False, f"命中敏感词: {kw}"
    import re
    for pattern, reason in SAFETY_PATTERNS:
        if re.search(pattern, text):
            return False, reason
    return True, None
