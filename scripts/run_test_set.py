"""
党务 Agent 测试问题集自动化测试脚本

用法:
    python scripts/run_test_set.py --experiment E0
    python scripts/run_test_set.py --experiment E1 --delay 3

环境变量(.env 文件):
DIFY_API_URL=http://127.0.0.1:8888/v1
DIFY_API_KEY=app-tAfb17t5jGG8uaCGmUu7D7cY


产出:
    outputs/E{N}_测试结果_YYYY-MM-DD.md
"""

import os
import re
import sys
import time
import argparse
import requests
from pathlib import Path
from datetime import date
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

DIFY_API_URL = os.getenv("DIFY_API_URL", "").rstrip("/")
DIFY_API_KEY = os.getenv("DIFY_API_KEY", "")

TEST_SET_PATH = PROJECT_ROOT / "outputs" / "党务Agent_测试问题集_v1_2026-05-07.md"
OUTPUT_DIR = PROJECT_ROOT / "outputs"


def parse_test_set(filepath: Path) -> list[dict]:
    """解析测试问题集 markdown，提取 30 题。"""
    content = filepath.read_text(encoding="utf-8")
    questions = []

    pattern = re.compile(
        r"### ([A-D]\d+)\.\s*(.+?)\n\n"
        r"\*\*标准答案\*\*[：:](.+?)\n"
        r"\*\*出处\*\*[：:](.+?)\n"
        r"\*\*考察点\*\*[：:](.+?)\n"
        r"\*\*难度\*\*[：:](.+?)(?:\n|$)",
        re.DOTALL,
    )

    for match in pattern.finditer(content):
        qid = match.group(1).strip()
        category = qid[0]
        questions.append({
            "id": qid,
            "category": category,
            "question": match.group(2).strip(),
            "expected_answer": match.group(3).strip(),
            "source": match.group(4).strip(),
            "test_point": match.group(5).strip(),
            "difficulty": match.group(6).strip(),
        })

    return questions


def call_dify(question: str, max_retries: int = 3) -> dict:
    """调用 Dify Chatflow API，返回回答和引用来源。"""
    url = f"{DIFY_API_URL}/chat-messages"
    headers = {
        "Authorization": f"Bearer {DIFY_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": {},
        "query": question,
        "response_mode": "blocking",
        "user": "test-runner",
    }

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=60)
            resp.raise_for_status()
            data = resp.json()

            answer = data.get("answer", "")
            metadata = data.get("metadata", {})
            retriever_resources = metadata.get("retriever_resources", [])
            sources = [r.get("document_name", "") for r in retriever_resources]

            return {
                "answer": answer,
                "sources": sources,
                "raw_status": resp.status_code,
            }
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                wait = 5 * (attempt + 1)
                print(f"  [重试 {attempt+1}/{max_retries}] {e}, {wait}s 后重试...")
                time.sleep(wait)
            else:
                return {
                    "answer": f"[API 调用失败] {e}",
                    "sources": [],
                    "raw_status": -1,
                }


def run_experiment(questions: list[dict], experiment: str, delay: float) -> list[dict]:
    """逐题跑测试，返回结果列表。"""
    results = []
    total = len(questions)

    for i, q in enumerate(questions, 1):
        print(f"[{i}/{total}] {q['id']}: {q['question'][:40]}...")
        resp = call_dify(q["question"])
        results.append({
            **q,
            "dify_answer": resp["answer"],
            "dify_sources": " | ".join(resp["sources"]) if resp["sources"] else "无引用",
            "score": "",  # 待人工评分
            "note": "" if resp["raw_status"] == 200 else f"API状态:{resp['raw_status']}",
        })

        if i < total:
            time.sleep(delay)

    return results


def write_output(results: list[dict], experiment: str):
    """输出为 markdown 表格。"""
    today = date.today().isoformat()
    filename = f"{experiment}_测试结果_{today}.md"
    filepath = OUTPUT_DIR / filename

    lines = [
        f"# {experiment} 测试结果",
        f"",
        f"> 日期：{today}",
        f"> 测试集：党务Agent_测试问题集_v1_2026-05-07.md（30 题）",
        f"> 系统配置：Dify Chatflow + DeepSeek V4 + MiniMax Embedding",
        f"",
        f"---",
        f"",
        f"## 结果明细",
        f"",
        f"| 题号 | 类别 | 题面 | 标准答案(摘要) | 出处 | Dify 实际回答 | Dify 引用来源 | 评分 | 备注 |",
        f"|---|---|---|---|---|---|---|---|---|",
    ]

    for r in results:
        q_short = r["question"][:30] + ("..." if len(r["question"]) > 30 else "")
        a_short = r["expected_answer"][:40] + ("..." if len(r["expected_answer"]) > 40 else "")
        dify_short = r["dify_answer"][:60] + ("..." if len(r["dify_answer"]) > 60 else "")
        # 转义 markdown 表格中的竖线
        dify_short = dify_short.replace("|", "\\|").replace("\n", " ")
        a_short = a_short.replace("|", "\\|").replace("\n", " ")

        lines.append(
            f"| {r['id']} | {r['category']} | {q_short} | {a_short} | {r['source'][:30]} | {dify_short} | {r['dify_sources'][:30]} | {r['score']} | {r['note']} |"
        )

    lines.extend([
        f"",
        f"---",
        f"",
        f"## 统计",
        f"",
        f"| 类别 | 题数 | 完全对 | 部分对 | 错 | 准确率 |",
        f"|---|---|---|---|---|---|",
        f"| A 类 | 10 | | | | |",
        f"| B 类 | 10 | | | | |",
        f"| C 类 | 5 | | | | |",
        f"| D 类 | 5 | | | | |",
        f"| **总计** | **30** | | | | |",
        f"",
        f'> 评分由人工完成，填入上表"评分"列后更新统计。',
    ])

    filepath.write_text("\n".join(lines), encoding="utf-8")
    print(f"\n结果已写入: {filepath}")
    return filepath


def main():
    parser = argparse.ArgumentParser(description="党务 Agent RAG 测试脚本")
    parser.add_argument("--experiment", required=True, help="实验编号，如 E0, E1, E2...")
    parser.add_argument("--delay", type=float, default=2.0, help="每题间隔秒数(默认 2)")
    parser.add_argument("--dry-run", action="store_true", help="只解析测试集，不调 API")
    args = parser.parse_args()

    if not DIFY_API_URL or not DIFY_API_KEY:
        print("错误: 请在 .env 文件中配置 DIFY_API_URL 和 DIFY_API_KEY")
        print(f"  .env 路径: {PROJECT_ROOT / '.env'}")
        sys.exit(1)

    if not TEST_SET_PATH.exists():
        print(f"错误: 测试集文件不存在: {TEST_SET_PATH}")
        sys.exit(1)

    print(f"解析测试集: {TEST_SET_PATH.name}")
    questions = parse_test_set(TEST_SET_PATH)
    print(f"  解析到 {len(questions)} 题")

    if len(questions) != 30:
        print(f"  ⚠️ 预期 30 题，实际 {len(questions)} 题，请检查测试集格式")

    if args.dry_run:
        print("\n[Dry Run] 前 3 题预览:")
        for q in questions[:3]:
            print(f"  {q['id']}: {q['question'][:50]}")
        return

    print(f"\n开始 {args.experiment} 实验，共 {len(questions)} 题，间隔 {args.delay}s")
    print(f"API: {DIFY_API_URL}")
    print("-" * 60)

    results = run_experiment(questions, args.experiment, args.delay)
    write_output(results, args.experiment)

    failed = sum(1 for r in results if r["note"])
    if failed:
        print(f"\n⚠️ {failed} 题 API 调用异常，请检查备注列")


if __name__ == "__main__":
    main()
