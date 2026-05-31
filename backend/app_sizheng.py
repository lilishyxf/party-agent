import asyncio
import json
import os
import re
import uuid
import threading
import io
import shutil
import hashlib
import hmac
import base64
from contextlib import asynccontextmanager
from pathlib import Path

from PIL import Image

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, Depends, UploadFile, File, Form, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import delete as sa_delete, select, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import engine, get_db, Base, beijing_now
from datetime import datetime
from sqlalchemy.orm import joinedload

from models_sizheng_alias import (
    Member, Branch, PartyGroup, LearningMaterial, LearningRecord, PointRecord,
    WritingRecord, WritingTemplate, LearningTask, TaskAssignment, TaskMaterial,
    Question, AnswerRecord, QuizProgress,
    Exam, ExamQuestion, ExamAssignment,
    Topic, TopicItem, LearningNote, ChatHistory, Meeting, MEETING_TYPES,
    Notice, Todo, Document, Schedule, DevelopmentRecord, MemberContact, Dues, Assistance, Volunteer,
    AdminUser, OperationLog, SystemConfig, DataDict,
    DisciplineStudy, WarningEdu, Inspection,
    PartyTransfer, FloatingMember, Regulation, Archive, DuesReceipt, DuesPublic,
    AssessmentIndicator, PeerEvaluation,
    SpecialBrand, BranchShowcase, SpecialActivity,
)

load_dotenv()
DIFY_API_URL = os.getenv("DIFY_API_URL", "http://127.0.0.1:8888/v1")
DIFY_API_KEY = os.getenv("DIFY_API_KEY", "")
DIFY_QUIZ_API_KEY = os.getenv("DIFY_QUIZ_API_KEY", "")


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


sizheng_app = FastAPI(title="Party Affairs Agent API")

# Serve uploaded files



# ── 管理员鉴权依赖（必须定义在路由之前） ─────────────────

ADMIN_SECRET = os.getenv("ADMIN_SECRET_KEY", "party-agent-admin-secret-2026")

def create_admin_token(user_id: int) -> str:
    payload = f"{user_id}:{int(datetime.now().timestamp())}"
    sig = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return base64.b64encode(f"{payload}:{sig}".encode()).decode()

TOKEN_EXPIRE_SECONDS = 24 * 3600  # 24 小时

def verify_admin_token(token: str) -> int | None:
    try:
        raw = base64.b64decode(token.encode()).decode()
        payload, sig = raw.rsplit(":", 1)
        expected = hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if sig != expected: return None
        uid_str, ts_str = payload.split(":", 1)
        ts = int(ts_str)
        if int(datetime.now().timestamp()) - ts > TOKEN_EXPIRE_SECONDS:
            return None
        return int(uid_str)
    except Exception:
        return None

async def get_current_admin(request: Request, db: AsyncSession = Depends(get_db)):
    """FastAPI 依赖: 从 Authorization header 校验 token, 返回 AdminUser 或 401"""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "未登录")
    uid = verify_admin_token(auth[7:])
    if not uid:
        raise HTTPException(401, "登录已过期，请重新登录")
    user = await db.get(AdminUser, uid)
    if not user or not user.is_active:
        raise HTTPException(401, "账号已禁用")
    return user

async def require_super_admin(admin: AdminUser = Depends(get_current_admin)):
    if admin.role != "超级管理员":
        raise HTTPException(403, "仅超级管理员可操作")
    return admin


# ── 身份绑定 ───────────────────────────────────────

class BindRequest(BaseModel):
    openid: str
    student_id: str
    name: str


@sizheng_app.post("/bind")
async def bind_member(req: BindRequest, db: AsyncSession = Depends(get_db)):
    """党员身份绑定：学号/工号 + 姓名匹配，写入 openid
    优先精确匹配学号+姓名；若无结果则用姓名模糊匹配（兼容未录入学号的成员）"""
    # 先尝试精确匹配：学号 + 姓名
    member = (await db.execute(
        select(Member).where(Member.student_id == req.student_id, Member.name == req.name)
    )).scalar()

    if not member:
        # 回退：姓名模糊匹配
        candidates = (await db.execute(
            select(Member).where(Member.name == req.name)
        )).scalars().all()

        if len(candidates) == 0:
            return {"status": "error", "message": "未找到匹配的党员信息，请检查学号/工号和姓名"}
        if len(candidates) == 1:
            member = candidates[0]
        else:
            # 多个同名成员，但学号/工号不精确 → 尝试用学号/工号在候选中再次匹配
            narrowed = [c for c in candidates if c.student_id == req.student_id]
            if len(narrowed) == 1:
                member = narrowed[0]
            else:
                return {"status": "error", "message": "存在多个同名党员，请联系管理员确认学号/工号后重试"}

    member.wechat_openid = req.openid
    await db.commit()
    return {"status": "ok", "name": member.name, "role": member.role}


class UnbindRequest(BaseModel):
    openid: str


@sizheng_app.post("/unbind")
async def unbind_member(req: UnbindRequest, db: AsyncSession = Depends(get_db)):
    member = (await db.execute(
        select(Member).where(Member.wechat_openid == req.openid)
    )).scalar()
    if not member:
        return {"status": "error", "message": "未找到绑定信息"}
    member.wechat_openid = None
    await db.commit()
    return {"status": "ok", "name": member.name}


@sizheng_app.get("/members")
async def list_members(
    search: str = "",
    branch_id: int = 0,
    party_status: str = "",
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    """列出所有党员（教师端使用，支持搜索/筛选）"""
    q = select(Member)
    if search:
        q = q.where(
            (Member.name.ilike(f"%{search}%")) | (Member.student_id.ilike(f"%{search}%"))
        )
    if branch_id:
        q = q.where(Member.branch_id == branch_id)
    if party_status:
        q = q.where(Member.party_status == party_status)
    q = q.order_by(Member.name)
    members = (await db.execute(q)).scalars().all()

    # 批量查支部名 + 党小组名
    branch_ids = list({m.branch_id for m in members if m.branch_id})
    branches = {}
    if branch_ids:
        branch_rows = (await db.execute(
            select(Branch).where(Branch.id.in_(branch_ids))
        )).scalars().all()
        branches = {b.id: b.name for b in branch_rows}

    group_ids = list({m.party_group_id for m in members if m.party_group_id})
    groups = {}
    if group_ids:
        group_rows = (await db.execute(
            select(PartyGroup).where(PartyGroup.id.in_(group_ids))
        )).scalars().all()
        groups = {g.id: g.name for g in group_rows}

    return [
        {
            "id": m.id,
            "name": m.name,
            "student_id": m.student_id,
            "id_card": m.id_card,
            "phone": m.phone,
            "gender": m.gender,
            "birth_date": m.birth_date.isoformat() if m.birth_date else None,
            "branch_id": m.branch_id,
            "branch_name": branches.get(m.branch_id, "") if m.branch_id else "",
            "party_group_id": m.party_group_id,
            "party_group_name": groups.get(m.party_group_id, "") if m.party_group_id else "",
            "join_party_date": m.join_party_date.isoformat() if m.join_party_date else None,
            "party_status": m.party_status,
            "role": m.role,
            "position": m.position,
            "duty_description": m.duty_description,
            "appointment_date": m.appointment_date.isoformat() if m.appointment_date else None,
            "education": m.education,
            "ethnicity": m.ethnicity,
            "title": m.title,
            "student_status": m.student_status,
            "wechat_openid": m.wechat_openid,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in members
    ]


class MemberCreate(BaseModel):
    name: str
    student_id: str = ""
    id_card: str = ""
    phone: str = ""
    gender: str = ""
    birth_date: str = ""
    branch_id: int | None = None
    party_group_id: int | None = None
    join_party_date: str = ""
    party_status: str = "正式党员"
    role: str = "党员"
    position: str = ""
    duty_description: str = ""
    appointment_date: str = ""
    education: str = ""
    ethnicity: str = ""
    title: str = ""
    student_status: str = ""


class MemberUpdate(BaseModel):
    name: str | None = None
    student_id: str | None = None
    id_card: str | None = None
    phone: str | None = None
    gender: str | None = None
    birth_date: str | None = None
    branch_id: int | None = None
    party_group_id: int | None = None
    join_party_date: str | None = None
    party_status: str | None = None
    role: str | None = None
    position: str | None = None
    duty_description: str | None = None
    appointment_date: str | None = None
    education: str | None = None
    ethnicity: str | None = None
    title: str | None = None
    student_status: str | None = None


@sizheng_app.post("/members")
async def create_member(req: MemberCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """新增党员"""
    m = Member(
        name=req.name,
        student_id=req.student_id or None,
        id_card=req.id_card or None,
        phone=req.phone or None,
        gender=req.gender or None,
        birth_date=datetime.strptime(req.birth_date, "%Y-%m-%d").date() if req.birth_date else None,
        branch_id=req.branch_id,
        party_group_id=req.party_group_id or None,
        join_party_date=datetime.strptime(req.join_party_date, "%Y-%m-%d").date() if req.join_party_date else None,
        party_status=req.party_status,
        role=req.role,
        position=req.position or None,
        duty_description=req.duty_description or None,
        appointment_date=datetime.strptime(req.appointment_date, "%Y-%m-%d").date() if req.appointment_date else None,
        education=req.education or None,
        ethnicity=req.ethnicity or None,
        title=req.title or None,
        student_status=req.student_status or None,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"id": m.id, "name": m.name}


@sizheng_app.put("/members/{member_id}")
async def update_member(member_id: int, req: MemberUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """编辑党员信息"""
    m = (await db.execute(select(Member).where(Member.id == member_id))).scalar()
    if not m:
        return {"error": "not found"}
    for field in ["name", "student_id", "id_card", "phone", "gender", "party_status", "role", "position", "duty_description", "education", "ethnicity", "title", "student_status"]:
        v = getattr(req, field, None)
        if v is not None:
            setattr(m, field, v)
    if req.party_group_id is not None:
        m.party_group_id = req.party_group_id
    if req.birth_date is not None:
        m.birth_date = datetime.strptime(req.birth_date, "%Y-%m-%d").date() if req.birth_date else None
    if req.branch_id is not None:
        m.branch_id = req.branch_id
    if req.join_party_date is not None:
        m.join_party_date = datetime.strptime(req.join_party_date, "%Y-%m-%d").date() if req.join_party_date else None
    if req.appointment_date is not None:
        m.appointment_date = datetime.strptime(req.appointment_date, "%Y-%m-%d").date() if req.appointment_date else None
    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/members/{member_id}")
async def delete_member(member_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """删除党员"""
    m = (await db.execute(select(Member).where(Member.id == member_id))).scalar()
    if not m:
        return {"error": "not found"}
    await db.execute(sa_delete(LearningRecord).where(LearningRecord.member_id == member_id))
    await db.execute(sa_delete(AnswerRecord).where(AnswerRecord.member_id == member_id))
    await db.execute(sa_delete(QuizProgress).where(QuizProgress.member_id == member_id))
    await db.execute(sa_delete(PointRecord).where(PointRecord.member_id == member_id))
    await db.execute(sa_delete(LearningNote).where(LearningNote.member_id == member_id))
    await db.execute(sa_delete(WritingRecord).where(WritingRecord.member_id == member_id))
    await db.delete(m)
    await db.commit()
    return {"status": "ok"}


# ── 党小组管理 ───────────────────────────────────────

class PartyGroupCreate(BaseModel):
    branch_id: int
    name: str
    leader_id: int | None = None
    description: str = ""


class PartyGroupUpdate(BaseModel):
    branch_id: int | None = None
    name: str | None = None
    leader_id: int | None = None
    description: str | None = None


@sizheng_app.get("/party-groups")
async def list_party_groups(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """列出所有党小组"""
    rows = (await db.execute(
        select(PartyGroup).order_by(PartyGroup.name)
    )).scalars().all()

    # 批量查 leader 姓名 + 成员数
    leader_ids = list({g.leader_id for g in rows if g.leader_id})
    leaders = {}
    if leader_ids:
        member_rows = (await db.execute(
            select(Member).where(Member.id.in_(leader_ids))
        )).scalars().all()
        leaders = {m.id: m.name for m in member_rows}

    group_ids = [g.id for g in rows]
    member_counts = {}
    if group_ids:
        count_rows = (await db.execute(
            select(Member.party_group_id, func.count().label("cnt"))
            .where(Member.party_group_id.in_(group_ids))
            .group_by(Member.party_group_id)
        )).all()
        member_counts = {row.party_group_id: row.cnt for row in count_rows}

    # 批量查 branch 名
    branch_ids = list({g.branch_id for g in rows if g.branch_id})
    branch_names = {}
    if branch_ids:
        br_rows = (await db.execute(
            select(Branch).where(Branch.id.in_(branch_ids))
        )).scalars().all()
        branch_names = {b.id: b.name for b in br_rows}

    return [
        {
            "id": g.id,
            "branch_id": g.branch_id,
            "branch_name": branch_names.get(g.branch_id, ""),
            "name": g.name,
            "leader_id": g.leader_id,
            "leader_name": leaders.get(g.leader_id, ""),
            "description": g.description,
            "member_count": member_counts.get(g.id, 0),
        }
        for g in rows
    ]


@sizheng_app.post("/party-groups")
async def create_party_group(req: PartyGroupCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    g = PartyGroup(branch_id=req.branch_id, name=req.name, leader_id=req.leader_id or None, description=req.description or None)
    db.add(g)
    await db.commit()
    await db.refresh(g)
    return {"id": g.id, "name": g.name}


@sizheng_app.put("/party-groups/{group_id}")
async def update_party_group(group_id: int, req: PartyGroupUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(PartyGroup).where(PartyGroup.id == group_id))).scalar()
    if not g:
        return {"error": "not found"}
    for field in ["branch_id", "name", "leader_id", "description"]:
        v = getattr(req, field, None)
        if v is not None:
            setattr(g, field, v)
    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/party-groups/{group_id}")
async def delete_party_group(group_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    g = (await db.execute(select(PartyGroup).where(PartyGroup.id == group_id))).scalar()
    if not g:
        return {"error": "not found"}
    await db.delete(g)
    await db.commit()
    return {"status": "ok"}


@sizheng_app.get("/party-groups/{group_id}/members")
async def party_group_members(group_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """获取党小组成员"""
    members = (await db.execute(
        select(Member).where(Member.party_group_id == group_id).order_by(Member.name)
    )).scalars().all()
    return [{"id": m.id, "name": m.name, "role": m.role, "student_id": m.student_id} for m in members]


@sizheng_app.post("/members/import")
async def import_members(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """批量导入党员（CSV）"""
    import csv as csv_module
    from io import StringIO

    raw = (await file.read()).decode("utf-8-sig", errors="ignore")
    reader = csv_module.DictReader(StringIO(raw))
    if not reader.fieldnames:
        return {"status": "error", "message": "CSV 文件为空或格式不正确"}

    # 中文表头 → 字段映射
    FIELD_MAP = {
        "姓名": "name", "学号": "student_id", "学工号": "student_id",
        "性别": "gender", "出生日期": "birth_date", "手机号": "phone",
        "身份证号": "id_card", "支部": "branch_name", "所属支部": "branch_name",
        "政治面貌": "party_status", "角色": "role", "入党日期": "join_party_date",
        "学历": "education", "民族": "ethnicity", "职称": "title",
        "学生面貌": "student_status", "职务": "position", "任职日期": "appointment_date",
    }

    # 预加载支部名→ID 映射
    branches = (await db.execute(select(Branch))).scalars().all()
    branch_map = {b.name.strip(): b.id for b in branches}

    total, created, skipped = 0, 0, 0
    errors = []

    for row_num, row in enumerate(reader, start=2):  # 第 1 行是表头
        total += 1
        # 把中文表头映射为字段名
        mapped = {}
        for k, v in row.items():
            key = FIELD_MAP.get(k.strip(), k.strip())
            mapped[key] = v.strip() if v else ""

        name = mapped.get("name", "")
        if not name:
            errors.append(f"第{row_num}行：姓名为空，跳过")
            skipped += 1
            continue

        student_id = mapped.get("student_id", "")
        id_card = mapped.get("id_card", "")

        # 检测重复：按 student_id 或 id_card
        if student_id:
            exist = (await db.execute(
                select(Member).where(Member.student_id == student_id)
            )).scalar()
            if exist:
                skipped += 1
                continue
        if id_card:
            exist = (await db.execute(
                select(Member).where(Member.id_card == id_card)
            )).scalar()
            if exist:
                skipped += 1
                continue

        # 解析支部名 → branch_id
        branch_name = mapped.get("branch_name", "")
        branch_id = branch_map.get(branch_name) if branch_name else None

        # 解析日期
        def parse_date(s):
            if not s: return None
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日"]:
                try: return datetime.strptime(s, fmt).date()
                except: pass
            return None

        try:
            m = Member(
                name=name,
                student_id=student_id or None,
                id_card=id_card or None,
                phone=mapped.get("phone") or None,
                gender=mapped.get("gender") or None,
                birth_date=parse_date(mapped.get("birth_date", "")),
                branch_id=branch_id,
                join_party_date=parse_date(mapped.get("join_party_date", "")),
                party_status=mapped.get("party_status") or "正式党员",
                role=mapped.get("role") or "党员",
                position=mapped.get("position") or None,
                appointment_date=parse_date(mapped.get("appointment_date", "")),
                education=mapped.get("education") or None,
                ethnicity=mapped.get("ethnicity") or None,
                title=mapped.get("title") or None,
                student_status=mapped.get("student_status") or None,
            )
            db.add(m)
            created += 1
        except Exception as e:
            errors.append(f"第{row_num}行：{str(e)}")
            skipped += 1

    await db.commit()
    return {
        "status": "ok",
        "total": total,
        "created": created,
        "skipped": skipped,
        "errors": errors[:20],  # 最多返回 20 条错误
    }


@sizheng_app.get("/members/export")
async def export_members(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """导出党员信息为 Excel"""
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    members = (await db.execute(
        select(Member, Branch.name)
        .outerjoin(Branch, Member.branch_id == Branch.id)
        .order_by(Member.id)
    )).all()

    wb = Workbook()
    ws = wb.active
    ws.title = "党员信息"
    headers = ["姓名", "学号", "性别", "出生日期", "手机号", "身份证号",
               "支部", "政治面貌", "角色", "入党日期", "学历", "民族", "职称", "学生面貌"]
    ws.append(headers)

    for m, bname in members:
        ws.append([
            m.name, m.student_id, m.gender,
            m.birth_date.isoformat() if m.birth_date else "",
            m.phone, m.id_card,
            bname or "",
            m.party_status, m.role,
            m.join_party_date.isoformat() if m.join_party_date else "",
            m.education, m.ethnicity, m.title, m.student_status,
        ])

    # Auto-width
    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 30)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=members.xlsx"},
    )


# ── 党组织架构 ─────────────────────────────────────

@sizheng_app.get("/branches")
async def list_branches(db: AsyncSession = Depends(get_db)):
    """列出所有支部（树形结构）"""
    branches = (await db.execute(
        select(Branch).order_by(Branch.name)
    )).scalars().all()

    # 统计每个支部党员数
    counts = {}
    for b in branches:
        cnt = (await db.execute(
            select(func.count()).select_from(Member).where(Member.branch_id == b.id)
        )).scalar() or 0
        counts[b.id] = cnt

    def build(b):
        return {
            "id": b.id,
            "name": b.name,
            "parent_id": b.parent_id,
            "secretary_id": b.secretary_id,
            "description": b.description,
            "member_count": counts.get(b.id, 0),
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }

    # 查书记姓名
    secretary_ids = [b.secretary_id for b in branches if b.secretary_id]
    secretary_names = {}
    if secretary_ids:
        rows = (await db.execute(
            select(Member.id, Member.name).where(Member.id.in_(secretary_ids))
        )).all()
        secretary_names = {r.id: r.name for r in rows}

    items = [build(b) for b in branches]
    for item in items:
        if item["secretary_id"]:
            item["secretary_name"] = secretary_names.get(item["secretary_id"], "")

    return items


class BranchCreate(BaseModel):
    name: str
    parent_id: int | None = None
    secretary_id: int | None = None
    description: str = ""


class BranchUpdate(BaseModel):
    name: str | None = None
    parent_id: int | None = None
    secretary_id: int | None = None
    description: str | None = None


@sizheng_app.post("/branches")
async def create_branch(req: BranchCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """新增支部"""
    b = Branch(
        name=req.name,
        parent_id=req.parent_id,
        secretary_id=req.secretary_id,
        description=req.description,
    )
    db.add(b)
    await db.commit()
    await db.refresh(b)
    return {"id": b.id, "name": b.name}


@sizheng_app.put("/branches/{branch_id}")
async def update_branch(branch_id: int, req: BranchUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """编辑支部"""
    b = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar()
    if not b:
        return {"error": "not found"}
    for field in ["name", "parent_id", "secretary_id", "description"]:
        v = getattr(req, field, None)
        if v is not None:
            setattr(b, field, v)
    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/branches/{branch_id}")
async def delete_branch(branch_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """删除支部"""
    b = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar()
    if not b:
        return {"error": "not found"}
    has_members = (await db.execute(
        select(func.count()).select_from(Member).where(Member.branch_id == branch_id)
    )).scalar() or 0
    if has_members:
        return {"error": f"该支部下还有 {has_members} 名党员，请先转移党员再删除"}
    has_materials = (await db.execute(
        select(func.count()).select_from(LearningMaterial).where(LearningMaterial.branch_id == branch_id)
    )).scalar() or 0
    if has_materials:
        return {"error": f"该支部下还有 {has_materials} 份学习材料，请先删除或转移"}
    has_exams = (await db.execute(
        select(func.count()).select_from(Exam).where(Exam.branch_id == branch_id)
    )).scalar() or 0
    if has_exams:
        return {"error": f"该支部下还有 {has_exams} 场考试，请先删除或转移"}
    has_meetings = (await db.execute(
        select(func.count()).select_from(Meeting).where(Meeting.branch_id == branch_id)
    )).scalar() or 0
    if has_meetings:
        return {"error": f"该支部下还有 {has_meetings} 条会议记录，请先删除或转移"}
    has_notices = (await db.execute(
        select(func.count()).select_from(Notice).where(Notice.branch_id == branch_id)
    )).scalar() or 0
    if has_notices:
        return {"error": f"该支部下还有 {has_notices} 条通知，请先删除或转移"}
    await db.delete(b)
    await db.commit()
    return {"status": "ok"}


# ── 发展党员 ─────────────────────────────────────

STAGE_ORDER = ["申请人", "积极分子", "发展对象", "预备党员", "正式党员"]
STAGE_LABELS = {s: s for s in STAGE_ORDER}
NEXT_STAGE = {
    "申请人": "积极分子",
    "积极分子": "发展对象",
    "发展对象": "预备党员",
    "预备党员": "正式党员",
}
# 每一跃迁需要的会议类型（业务字段总录 §4.2）
STAGE_MEETING_TYPE = {
    "积极分子": "dev_activist",
    "发展对象": "dev_candidate",
    "预备党员": "dev_probationary",
    "正式党员": "probationary_full",
}


@sizheng_app.get("/development")
async def list_development(
    status: str = "",
    search: str = "",
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    """列出所有党员的发展状态"""
    q = select(Member)
    if status:
        q = q.where(Member.party_status == status)
    if search:
        q = q.where(
            (Member.name.ilike(f"%{search}%")) | (Member.student_id.ilike(f"%{search}%"))
        )
    if not status and not search:
        # 默认显示非正式党员（仍在发展流程中的）
        q = q.where(Member.party_status != "正式党员")
    q = q.order_by(Member.party_status, Member.name)
    members = (await db.execute(q)).scalars().all()

    # 查每个人的最新发展记录
    result = []
    for m in members:
        latest = (await db.execute(
            select(DevelopmentRecord)
            .where(DevelopmentRecord.member_id == m.id)
            .order_by(DevelopmentRecord.created_at.desc())
            .limit(1)
        )).scalar()
        result.append({
            "id": m.id,
            "name": m.name,
            "student_id": m.student_id,
            "party_status": m.party_status,
            "status_label": STAGE_LABELS.get(m.party_status, m.party_status),
            "join_party_date": m.join_party_date.isoformat() if m.join_party_date else None,
            "latest_record": {
                "from_status": latest.from_status,
                "to_status": latest.to_status,
                "meeting_date": latest.meeting_date.isoformat() if latest and latest.meeting_date else None,
                "decision": latest.decision,
            } if latest else None,
        })

    return result


@sizheng_app.get("/development/{member_id}/history")
async def get_development_history(member_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """查某党员的发展历程"""
    records = (await db.execute(
        select(DevelopmentRecord)
        .where(DevelopmentRecord.member_id == member_id)
        .order_by(DevelopmentRecord.created_at.asc())
    )).scalars().all()

    member = (await db.execute(
        select(Member).where(Member.id == member_id)
    )).scalar()

    return {
        "member": {
            "id": member.id,
            "name": member.name,
            "party_status": member.party_status,
            "status_label": STAGE_LABELS.get(member.party_status, ""),
        } if member else None,
        "records": [
            {
                "id": r.id,
                "from_status": r.from_status,
                "from_label": STAGE_LABELS.get(r.from_status, r.from_status),
                "to_status": r.to_status,
                "to_label": STAGE_LABELS.get(r.to_status, r.to_status),
                "meeting_id": r.meeting_id,
                "meeting_date": r.meeting_date.isoformat() if r.meeting_date else None,
                "decision": r.decision,
                "notes": r.notes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ],
    }


class DevelopmentAdvance(BaseModel):
    member_id: int
    to_status: str
    meeting_id: int | None = None
    meeting_date: str = ""
    decision: str = ""
    notes: str = ""


@sizheng_app.post("/development/advance")
async def advance_development(req: DevelopmentAdvance, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """推进发展流程:将党员从当前状态推到下一阶段"""
    member = (await db.execute(
        select(Member).where(Member.id == req.member_id)
    )).scalar()
    if not member:
        return {"error": "党员不存在"}

    current = member.party_status
    if current not in STAGE_ORDER:
        return {"error": f"未知的当前状态: {current}"}

    expected_next = NEXT_STAGE.get(current)
    if not expected_next:
        return {"error": f"已是正式党员,无法继续推进"}

    if req.to_status != expected_next:
        return {"error": f"下一步只能推进到'{STAGE_LABELS[expected_next]}', 不能跳步到'{STAGE_LABELS.get(req.to_status, req.to_status)}'"}

    # 记录流转
    record = DevelopmentRecord(
        member_id=req.member_id,
        from_status=current,
        to_status=req.to_status,
        meeting_id=req.meeting_id,
        meeting_date=datetime.strptime(req.meeting_date, "%Y-%m-%d").date() if req.meeting_date else None,
        decision=req.decision,
        notes=req.notes,
    )
    db.add(record)

    # 更新 member 状态
    member.party_status = req.to_status
    if req.to_status == "正式党员" and req.meeting_date:
        member.join_party_date = datetime.strptime(req.meeting_date, "%Y-%m-%d").date()

    await db.commit()
    await db.refresh(record)
    return {
        "status": "ok",
        "record_id": record.id,
        "from": STAGE_LABELS[current],
        "to": STAGE_LABELS[req.to_status],
    }


# ── Dify 代理 ───────────────────────────────────────

class ChatRequest(BaseModel):
    query: str
    openid: str = "web-user"
    conversation_id: str | None = None


@sizheng_app.post("/chat")
async def chat(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """代理 Dify 问答，支持多轮对话，保存历史"""
    # 调 Dify
    dify_body = {"inputs": {}, "query": req.query, "response_mode": "blocking", "user": f"portal-{req.openid}"}
    if req.conversation_id:
        dify_body["conversation_id"] = req.conversation_id

    resp = requests.post(
        f"{DIFY_API_URL}/chat-messages",
        headers={"Authorization": f"Bearer {DIFY_API_KEY}", "Content-Type": "application/json"},
        json=dify_body,
        timeout=90,
    )
    resp.raise_for_status()
    data = resp.json()
    answer = data.get("answer", "")
    answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()
    conversation_id = data.get("conversation_id", "")

    # 保存对话历史
    db.add(ChatHistory(openid=req.openid, conversation_id=conversation_id, role="user", content=req.query))
    db.add(ChatHistory(openid=req.openid, conversation_id=conversation_id, role="assistant", content=answer))
    await db.commit()

    return {"answer": answer, "conversation_id": conversation_id}


@sizheng_app.get("/chat/history")
async def chat_history(openid: str = "web-user", db: AsyncSession = Depends(get_db)):
    """拉取用户的对话历史，按 conversation 分组"""
    records = (await db.execute(
        select(ChatHistory)
        .where(ChatHistory.openid == openid)
        .order_by(ChatHistory.created_at.desc())
        .limit(100)
    )).scalars().all()

    # 按 conversation_id 分组
    convs = {}
    for r in records:
        cid = r.conversation_id or "__no_cid__"
        if cid not in convs:
            convs[cid] = []
        convs[cid].append({"role": r.role, "content": r.content, "time": r.created_at.isoformat()})

    return {
        "conversations": [
            {"conversation_id": cid, "messages": list(reversed(msgs))}
            for cid, msgs in convs.items()
        ]
    }


# ── 个人中心 ───────────────────────────────────────

@sizheng_app.get("/member/{openid}/stats")
async def member_stats(openid: str, db: AsyncSession = Depends(get_db)):
    """党员个人统计"""
    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return {"error": "未找到党员信息"}

    learn_count = (await db.execute(
        select(func.count()).select_from(LearningRecord).where(LearningRecord.member_id == member.id)
    )).scalar() or 0

    total_points = (await db.execute(
        select(func.coalesce(func.sum(PointRecord.points), 0)).where(PointRecord.member_id == member.id)
    )).scalar() or 0

    recent_records = (await db.execute(
        select(LearningRecord)
        .where(LearningRecord.member_id == member.id)
        .order_by(LearningRecord.created_at.desc())
        .limit(10)
    )).scalars().all()

    # 批量获取关联的材料标题
    material_ids = [r.material_id for r in recent_records]
    materials = {}
    if material_ids:
        mat_rows = (await db.execute(
            select(LearningMaterial).where(LearningMaterial.id.in_(material_ids))
        )).scalars().all()
        materials = {m.id: m.title for m in mat_rows}

    return {
        "name": member.name,
        "branch": "计算机学院教师第一支部",
        "learn_count": learn_count,
        "total_points": total_points,
        "recent": [
            {
                "action": materials.get(r.material_id, "学习"),
                "detail": r.created_at.strftime("%m-%d %H:%M") + " 学习",
                "created_at": r.created_at.isoformat(),
            }
            for r in recent_records
        ],
    }


@sizheng_app.get("/member/{openid}/learning-records")
async def member_learning_records(openid: str, page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return {"list": [], "total": 0}

    # 聚合三种学习记录: 材料浏览 + 任务完成 + 考试提交
    items = []

    # 材料浏览
    mat_rows = (await db.execute(
        select(LearningRecord, LearningMaterial.title)
        .join(LearningMaterial, LearningRecord.material_id == LearningMaterial.id)
        .where(LearningRecord.member_id == member.id)
    )).all()
    for r, title in mat_rows:
        items.append({
            "type": "material",
            "title": title or "学习材料",
            "detail": "完成学习" if r.completed else "开始学习",
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 任务完成
    task_rows = (await db.execute(
        select(TaskAssignment, LearningTask.title)
        .join(LearningTask, TaskAssignment.task_id == LearningTask.id)
        .where(TaskAssignment.member_id == member.id, TaskAssignment.status == "completed")
    )).all()
    for a, title in task_rows:
        items.append({
            "type": "task",
            "title": title or "学习任务",
            "detail": "完成任务",
            "created_at": a.created_at.isoformat() if a.created_at else None,
        })

    # 考试提交
    exam_rows = (await db.execute(
        select(ExamAssignment, Exam.title)
        .join(Exam, ExamAssignment.exam_id == Exam.id)
        .where(ExamAssignment.member_id == member.id, ExamAssignment.status == "submitted")
    )).all()
    for a, title in exam_rows:
        items.append({
            "type": "exam",
            "title": title or "考试",
            "detail": f"得分{a.score}分" if a.score is not None else "已提交",
            "created_at": a.submitted_at.isoformat() if a.submitted_at else a.created_at.isoformat(),
        })

    items.sort(key=lambda x: x["created_at"] or "", reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    return {"list": items[start:start + page_size], "total": total}


# ── 学习资源 ───────────────────────────────────────

@sizheng_app.get("/learning-materials")
async def learning_materials(
    category: str = "",
    search: str = "",
    page: int = 1,
    page_size: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """学习资源列表（支持筛选/搜索/分页）"""
    q = select(LearningMaterial)
    if category:
        q = q.where(LearningMaterial.category == category)
    if search:
        q = q.where(LearningMaterial.title.ilike(f"%{search}%"))
    q = q.order_by(LearningMaterial.created_at.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    materials = (await db.execute(q)).scalars().all()

    total_q = select(func.count()).select_from(LearningMaterial)
    if category:
        total_q = total_q.where(LearningMaterial.category == category)
    if search:
        total_q = total_q.where(LearningMaterial.title.ilike(f"%{search}%"))
    total = (await db.execute(total_q)).scalar() or 0

    return {
        "items": [
            {
                "id": m.id,
                "title": m.title,
                "type": m.type,
                "category": m.category,
                "content_url": m.content_url,
                "file_path": m.file_path,
                "description": m.description,
                "published_at": m.published_at.isoformat() if m.published_at else None,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in materials
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


class MaterialCreate(BaseModel):
    title: str
    type: str = "reading"
    category: str = "general"
    content_url: str = ""
    description: str = ""


class MaterialUpdate(BaseModel):
    title: str | None = None
    type: str | None = None
    category: str | None = None
    content_url: str | None = None
    description: str | None = None


@sizheng_app.post("/learning-materials")
async def create_material(req: MaterialCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """新增学习材料"""
    m = LearningMaterial(
        title=req.title,
        type=req.type,
        category=req.category,
        content_url=req.content_url,
        description=req.description,
        published_at=beijing_now(),
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"id": m.id, "title": m.title}


@sizheng_app.put("/learning-materials/{material_id}")
async def update_material(material_id: int, req: MaterialUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """编辑学习材料"""
    m = (await db.execute(select(LearningMaterial).where(LearningMaterial.id == material_id))).scalar()
    if not m:
        return {"error": "not found"}
    if req.title is not None:
        m.title = req.title
    if req.type is not None:
        m.type = req.type
    if req.category is not None:
        m.category = req.category
    if req.content_url is not None:
        m.content_url = req.content_url
    if req.description is not None:
        m.description = req.description
    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/learning-materials/{material_id}")
async def delete_material(material_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """删除学习材料"""
    m = (await db.execute(select(LearningMaterial).where(LearningMaterial.id == material_id))).scalar()
    if not m:
        return {"error": "not found"}
    await db.execute(sa_delete(LearningRecord).where(LearningRecord.material_id == material_id))
    await db.execute(sa_delete(TaskMaterial).where(TaskMaterial.material_id == material_id))
    await db.delete(m)
    await db.commit()
    return {"status": "ok"}


MATERIALS_DIR = "/opt/party-agent/frontends/admin/media/materials"


@sizheng_app.post("/learning-materials/upload")
async def upload_material(
    file: UploadFile = File(...),
    title: str = Form(""),
    type_: str = Form("reading", alias="type"),
    category: str = Form("general"),
    description: str = Form(""),
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    """上传学习材料文件（PDF/Word）"""
    os.makedirs(MATERIALS_DIR, exist_ok=True)

    ext = Path(file.filename).suffix.lower() if file.filename else ".bin"
    if ext not in (".pdf", ".docx", ".doc", ".txt"):
        return {"error": f"不支持的文件格式: {ext}，仅支持 PDF/Word/TXT"}

    safe_name = f"{uuid.uuid4().hex}{ext}"
    disk_path = os.path.join(MATERIALS_DIR, safe_name)

    content = await file.read()
    with open(disk_path, "wb") as f:
        f.write(content)

    # Extract text for knowledge base indexing
    extracted_text = ""
    try:
        if ext == ".pdf":
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(content))
            extracted_text = "\n".join(
                page.extract_text() or "" for page in reader.pages
            )[:50000]
        elif ext in (".docx", ".doc"):
            from docx import Document
            doc = Document(io.BytesIO(content))
            extracted_text = "\n".join(
                p.text for p in doc.paragraphs if p.text.strip()
            )[:50000]
        elif ext == ".txt":
            extracted_text = content.decode("utf-8", errors="ignore")[:50000]
    except Exception as e:
        print(f"Text extraction warning: {e}")

    m = LearningMaterial(
        title=title or file.filename,
        type=type_,
        category=category,
        content_url=f"/media/materials/{safe_name}",
        file_path=disk_path,
        description=description,
        published_at=beijing_now(),
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)

    return {
        "id": m.id,
        "title": m.title,
        "file_path": disk_path,
        "content_url": m.content_url,
        "text_length": len(extracted_text),
    }


class LearnRequest(BaseModel):
    openid: str = "web-user"


@sizheng_app.post("/learning-materials/{material_id}/learn")
async def learn_material(material_id: int, req: LearnRequest, db: AsyncSession = Depends(get_db)):
    """记录学习行为"""
    member = (await db.execute(select(Member).where(Member.wechat_openid == req.openid))).scalar()
    if not member:
        return {"status": "ok", "note": "未匹配党员"}

    db.add(LearningRecord(
        member_id=member.id,
        material_id=material_id,
        start_time=beijing_now(),
        end_time=beijing_now(),
        duration=0,
        completed=True,
    ))
    await db.commit()
    return {"status": "ok"}


# ── 写作辅助 ───────────────────────────────────────

WRITING_API_KEYS = {
    "thought_report": os.getenv("DIFY_WRITING_THOUGHT_REPORT", ""),
    "annual_summary": os.getenv("DIFY_WRITING_ANNUAL_SUMMARY", ""),
    "self_review": os.getenv("DIFY_WRITING_SELF_REVIEW", ""),
    "party_application": os.getenv("DIFY_WRITING_PARTY_APPLICATION", ""),
    "lesson_reflection": os.getenv("DIFY_WRITING_LESSON_REFLECTION", ""),
    "work_report": os.getenv("DIFY_WRITING_WORK_REPORT", ""),
}

# 异步任务存储（内存，服务重启会清空）
_writing_tasks: dict = {}
_writing_tasks_lock = threading.Lock()


def _run_dify_and_store(task_id: str, api_key: str, query: str):
    """后台线程：调 Dify，结果写回 _writing_tasks"""
    try:
        resp = requests.post(
            f"{DIFY_API_URL}/chat-messages",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "inputs": {},
                "query": query,
                "response_mode": "blocking",
                "user": "portal-writing",
            },
            timeout=300,
        )
        resp.raise_for_status()
        answer = resp.json().get("answer", "")
        answer = re.sub(r"<think>.*?</think>", "", answer, flags=re.DOTALL).strip()
        with _writing_tasks_lock:
            _writing_tasks[task_id] = {"status": "done", "draft": answer}
    except Exception as e:
        with _writing_tasks_lock:
            _writing_tasks[task_id] = {"status": "error", "message": str(e)}


class GenerateWritingRequest(BaseModel):
    template_key: str
    user_input: str
    openid: str = "web-user"


@sizheng_app.post("/writing/generate")
async def generate_writing(req: GenerateWritingRequest):
    """提交写作任务，立即返回 task_id"""
    if req.template_key not in WRITING_API_KEYS:
        return {"status": "error", "message": f"未知写作类型: {req.template_key}"}

    api_key = WRITING_API_KEYS[req.template_key]
    if not api_key or api_key.startswith("app-xxx"):
        return {"status": "error", "message": f"写作类型 {req.template_key} 的 Chatflow API Key 未配置"}

    task_id = uuid.uuid4().hex
    with _writing_tasks_lock:
        _writing_tasks[task_id] = {"status": "processing"}

    threading.Thread(target=_run_dify_and_store, args=(task_id, api_key, req.user_input), daemon=True).start()
    return {"task_id": task_id}


@sizheng_app.get("/writing/task/{task_id}")
async def get_writing_task(task_id: str):
    """轮询写作任务状态"""
    with _writing_tasks_lock:
        task = _writing_tasks.get(task_id)
    if not task:
        return {"status": "error", "message": "任务不存在或已过期"}
    return task


class SaveWritingRequest(BaseModel):
    openid: str = "web-user"
    template_key: str
    user_input: str
    ai_draft: str | None = None


@sizheng_app.post("/writing/save")
async def save_writing(req: SaveWritingRequest, db: AsyncSession = Depends(get_db)):
    member = (await db.execute(select(Member).where(Member.wechat_openid == req.openid))).scalar()
    if not member:
        return {"status": "error", "message": "未绑定党员身份"}

    db.add(WritingRecord(
        member_id=member.id,
        user_input=req.user_input,
        ai_draft=req.ai_draft,
        status="draft",
    ))
    await db.commit()
    return {"status": "ok"}


@sizheng_app.get("/writing/list")
async def list_writings(openid: str = "web-user", db: AsyncSession = Depends(get_db)):
    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return {"status": "error", "message": "未绑定党员身份"}

    records = (await db.execute(
        select(WritingRecord)
        .where(WritingRecord.member_id == member.id)
        .order_by(WritingRecord.created_at.desc())
    )).scalars().all()

    return [
        {
            "id": r.id,
            "user_input": r.user_input[:80],
            "ai_draft": r.ai_draft[:200] if r.ai_draft else None,
            "status": r.status,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]


# ── 任务中心（党员端） ────────────────────────────

@sizheng_app.get("/tasks")
async def list_member_tasks(openid: str, db: AsyncSession = Depends(get_db)):
    """党员查看分配给自己的任务（含考试）"""
    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return []

    items = []

    # 学习任务
    rows = (await db.execute(
        select(TaskAssignment, LearningTask)
        .join(LearningTask, TaskAssignment.task_id == LearningTask.id)
        .where(TaskAssignment.member_id == member.id)
        .order_by(TaskAssignment.status.asc(), LearningTask.deadline.asc())
    )).all()

    for a, t in rows:
        items.append({
            "assignment_id": a.id,
            "type": "task",
            "ref_id": t.id,
            "title": t.title,
            "description": t.description,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "status": a.status,
            "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        })

    # 考试
    exam_rows = (await db.execute(
        select(ExamAssignment, Exam)
        .join(Exam, ExamAssignment.exam_id == Exam.id)
        .where(ExamAssignment.member_id == member.id)
        .order_by(ExamAssignment.status.asc(), Exam.end_time.asc())
    )).all()

    for a, e in exam_rows:
        items.append({
            "assignment_id": a.id,
            "type": "exam",
            "ref_id": e.id,
            "title": f"考试：{e.title}",
            "description": f"共 {e.question_count} 题，及格分 {e.pass_score}",
            "deadline": e.end_time.isoformat() if e.end_time else None,
            "status": "completed" if a.status == "submitted" else a.status,
            "score": a.score,
            "completed_at": a.submitted_at.isoformat() if a.submitted_at else None,
        })

    return items


class SignOffRequest(BaseModel):
    openid: str


@sizheng_app.post("/tasks/{assignment_id}/sign")
async def sign_off_task(assignment_id: int, req: SignOffRequest, db: AsyncSession = Depends(get_db)):
    """党员签收/完成任务"""
    member = (await db.execute(select(Member).where(Member.wechat_openid == req.openid))).scalar()
    if not member:
        return {"status": "error", "message": "未绑定党员身份"}

    assignment = (await db.execute(
        select(TaskAssignment).where(TaskAssignment.id == assignment_id)
    )).scalar()
    if not assignment:
        return {"status": "error", "message": "任务分配记录不存在"}
    if assignment.member_id != member.id:
        return {"status": "error", "message": "无权操作此任务"}

    assignment.status = "completed"
    assignment.completed_at = beijing_now()
    await db.commit()
    return {"status": "ok"}


# ── 管理端：任务管理 ─────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    description: str | None = None
    branch_id: int | None = None
    deadline: str | None = None
    member_ids: list[int] = []
    assign_all_branch: bool = False

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    branch_id: int | None = None
    deadline: str | None = None


@sizheng_app.get("/admin/tasks")
async def admin_list_tasks(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：任务列表（含分配统计）"""
    tasks = (await db.execute(
        select(LearningTask).order_by(LearningTask.created_at.desc())
    )).scalars().all()

    branch_ids = list({t.branch_id for t in tasks if t.branch_id})
    branch_map = {}
    if branch_ids:
        branches = (await db.execute(
            select(Branch).where(Branch.id.in_(branch_ids))
        )).scalars().all()
        branch_map = {b.id: b.name for b in branches}

    result = []
    for t in tasks:
        stats = (await db.execute(
            select(
                func.count(TaskAssignment.id),
                func.sum(case((TaskAssignment.status == "completed", 1), else_=0)),
                func.sum(case((TaskAssignment.status == "pending", 1), else_=0)),
            ).where(TaskAssignment.task_id == t.id)
        )).one()

        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "branch_id": t.branch_id,
            "branch_name": branch_map.get(t.branch_id, "-") if t.branch_id else "-",
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "total_assigned": stats[0] or 0,
            "completed_count": stats[1] or 0,
            "pending_count": stats[2] or 0,
        })
    return result


@sizheng_app.get("/admin/tasks/{task_id}")
async def admin_get_task(
    task_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：任务详情含分配名单"""
    task = await db.get(LearningTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    assignments = (await db.execute(
        select(TaskAssignment, Member.name, Member.student_id)
        .join(Member, TaskAssignment.member_id == Member.id)
        .where(TaskAssignment.task_id == task_id)
    )).all()

    materials = (await db.execute(
        select(LearningMaterial.id, LearningMaterial.title)
        .join(TaskMaterial, TaskMaterial.material_id == LearningMaterial.id)
        .where(TaskMaterial.task_id == task_id)
    )).all()

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "branch_id": task.branch_id,
        "deadline": task.deadline.isoformat() if task.deadline else None,
        "assignments": [
            {
                "id": a.id,
                "member_id": a.member_id,
                "name": name,
                "student_id": student_id,
                "status": a.status,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
            }
            for a, name, student_id in assignments
        ],
        "materials": [{"id": mid, "title": mtitle} for mid, mtitle in materials],
    }


@sizheng_app.post("/admin/tasks")
async def admin_create_task(
    req: TaskCreate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：创建任务并分配党员"""
    deadline = None
    if req.deadline:
        try:
            deadline = datetime.strptime(req.deadline, "%Y-%m-%d")
        except ValueError:
            deadline = datetime.fromisoformat(req.deadline)

    task = LearningTask(
        title=req.title,
        description=req.description,
        branch_id=req.branch_id,
        deadline=deadline,
    )
    db.add(task)
    await db.flush()

    # 确定分配成员
    if req.assign_all_branch and req.branch_id:
        members = (await db.execute(
            select(Member).where(Member.branch_id == req.branch_id)
        )).scalars().all()
        member_ids = [m.id for m in members]
    else:
        member_ids = req.member_ids

    for mid in member_ids:
        db.add(TaskAssignment(task_id=task.id, member_id=mid, status="pending"))

    await db.commit()
    return {"status": "ok", "task_id": task.id, "assigned_count": len(member_ids)}


@sizheng_app.put("/admin/tasks/{task_id}")
async def admin_update_task(
    task_id: int,
    req: TaskUpdate,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：更新任务信息"""
    task = await db.get(LearningTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    if req.title is not None:
        task.title = req.title
    if req.description is not None:
        task.description = req.description
    if req.branch_id is not None:
        task.branch_id = req.branch_id
    if req.deadline is not None:
        try:
            task.deadline = datetime.strptime(req.deadline, "%Y-%m-%d")
        except ValueError:
            task.deadline = datetime.fromisoformat(req.deadline)

    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/admin/tasks/{task_id}")
async def admin_delete_task(
    task_id: int,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：删除任务（级联删除分配记录）"""
    task = await db.get(LearningTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    await db.delete(task)
    await db.commit()
    return {"status": "ok"}


@sizheng_app.post("/admin/tasks/{task_id}/assign")
async def admin_assign_task(
    task_id: int,
    member_ids: list[int],
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """管理端：重新分配任务到指定党员（覆盖旧分配）"""
    task = await db.get(LearningTask, task_id)
    if not task:
        raise HTTPException(404, "任务不存在")

    # 删除已有分配
    existing = (await db.execute(
        select(TaskAssignment).where(
            TaskAssignment.task_id == task_id,
            TaskAssignment.status == "pending",
        )
    )).scalars().all()
    for a in existing:
        await db.delete(a)

    # 创建新分配
    for mid in member_ids:
        # 避免重复创建已完成的任务
        dup = (await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.member_id == mid,
            )
        )).scalar()
        if not dup:
            db.add(TaskAssignment(task_id=task_id, member_id=mid, status="pending"))

    await db.commit()
    return {"status": "ok", "assigned_count": len(member_ids)}


# ── 考试中心 ───────────────────────────────────────

class ExamCreate(BaseModel):
    title: str
    question_ids: list[int]
    member_ids: list[int] = []
    start_time: str = ""
    end_time: str = ""
    pass_score: int = 60


@sizheng_app.post("/exams")
async def create_exam(req: ExamCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师创建考试"""
    import random
    def _parse_dt(s):
        if not s: return None
        s = s.replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=None) if dt.tzinfo else dt
    start = _parse_dt(req.start_time) or beijing_now()
    end = _parse_dt(req.end_time) or beijing_now()
    # 随机抽取题目
    q_ids = random.sample(req.question_ids, min(len(req.question_ids), 20))

    exam = Exam(
        title=req.title,
        branch_id=1,
        created_by=1,
        start_time=start,
        end_time=end,
        pass_score=req.pass_score,
        question_count=len(q_ids),
    )
    db.add(exam)
    await db.flush()

    for qid in q_ids:
        db.add(ExamQuestion(exam_id=exam.id, question_id=qid))

    # 分配成员（member_ids 为空则分配给所有已绑定成员）
    if not req.member_ids:
        members = (await db.execute(select(Member))).scalars().all()
        req.member_ids = [m.id for m in members]

    for mid in req.member_ids:
        db.add(ExamAssignment(exam_id=exam.id, member_id=mid, status="pending"))

    await db.commit()
    return {"exam_id": exam.id, "question_count": len(q_ids), "member_count": len(req.member_ids)}


@sizheng_app.get("/exams")
async def list_exams(page: int = 1, page_size: int = 20, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师查看考试列表"""
    total_q = select(func.count()).select_from(Exam)
    total = (await db.execute(total_q)).scalar() or 0

    rows = (await db.execute(
        select(Exam).order_by(Exam.created_at.desc())
        .offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    items = []
    for e in rows:
        submitted = (await db.execute(
            select(func.count()).select_from(ExamAssignment)
            .where(ExamAssignment.exam_id == e.id, ExamAssignment.status == "submitted")
        )).scalar() or 0
        assigned = (await db.execute(
            select(func.count()).select_from(ExamAssignment)
            .where(ExamAssignment.exam_id == e.id)
        )).scalar() or 0
        items.append({
            "id": e.id, "title": e.title, "question_count": e.question_count,
            "pass_score": e.pass_score,
            "start_time": e.start_time.isoformat() if e.start_time else None,
            "end_time": e.end_time.isoformat() if e.end_time else None,
            "assigned_count": assigned, "submitted_count": submitted,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@sizheng_app.get("/exams/{exam_id}")
async def get_exam_detail(exam_id: int, openid: str = "", db: AsyncSession = Depends(get_db)):
    """学生获取考试详情（含题目，不含答案）"""
    exam = (await db.execute(select(Exam).where(Exam.id == exam_id))).scalar()
    if not exam:
        return {"error": "考试不存在"}

    eq_rows = (await db.execute(
        select(ExamQuestion).where(ExamQuestion.exam_id == exam_id)
    )).scalars().all()

    questions = []
    for eq in eq_rows:
        q = (await db.execute(select(Question).where(Question.id == eq.question_id))).scalar()
        if q:
            questions.append({
                "question_id": q.id, "content": q.content, "type": q.type,
                "options": q.options,
            })

    return {
        "exam_id": exam.id, "title": exam.title,
        "pass_score": exam.pass_score, "question_count": exam.question_count,
        "start_time": exam.start_time.isoformat() if exam.start_time else None,
        "end_time": exam.end_time.isoformat() if exam.end_time else None,
        "questions": questions,
    }


@sizheng_app.get("/exams/{exam_id}/my-result")
async def get_my_exam_result(exam_id: int, openid: str = "", db: AsyncSession = Depends(get_db)):
    """学生查看自己某次考试的结果"""
    exam = (await db.execute(select(Exam).where(Exam.id == exam_id))).scalar()
    if not exam:
        return {"error": "考试不存在"}

    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return {"error": "未绑定党员身份"}

    assignment = (await db.execute(
        select(ExamAssignment).where(
            ExamAssignment.exam_id == exam_id,
            ExamAssignment.member_id == member.id,
        )
    )).scalar()
    if not assignment or assignment.status != "submitted":
        return {"error": "你尚未提交该考试"}

    # 获取所有题目和用户的答案
    records = (await db.execute(
        select(AnswerRecord).where(
            AnswerRecord.exam_id == exam_id,
            AnswerRecord.member_id == member.id,
        )
    )).scalars().all()

    answers = {}
    for r in records:
        answers[r.question_id] = {"user_answer": r.user_answer, "is_correct": r.is_correct}

    eq_rows = (await db.execute(
        select(ExamQuestion).where(ExamQuestion.exam_id == exam_id)
    )).scalars().all()

    questions = []
    for eq in eq_rows:
        q = (await db.execute(select(Question).where(Question.id == eq.question_id))).scalar()
        if q:
            ar = answers.get(q.id, {})
            questions.append({
                "question_id": q.id, "content": q.content, "type": q.type,
                "options": q.options, "correct_answer": q.answer,
                "explanation": q.explanation,
                "user_answer": ar.get("user_answer", ""),
                "is_correct": ar.get("is_correct", False),
            })

    return {
        "exam_id": exam.id, "title": exam.title,
        "pass_score": exam.pass_score, "question_count": exam.question_count,
        "score": assignment.score,
        "passed": assignment.score >= exam.pass_score,
        "submitted_at": assignment.submitted_at.isoformat() if assignment.submitted_at else None,
        "questions": questions,
    }


@sizheng_app.get("/exams/my-history")
async def get_exam_history(openid: str = "", db: AsyncSession = Depends(get_db)):
    member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
    if not member:
        return {"exams": []}

    rows = (await db.execute(
        select(ExamAssignment, Exam).join(Exam, ExamAssignment.exam_id == Exam.id)
        .where(ExamAssignment.member_id == member.id, ExamAssignment.status == "submitted")
        .order_by(ExamAssignment.submitted_at.desc())
    )).all()

    return {"exams": [{
        "assignment_id": a.id,
        "exam_id": e.id,
        "title": e.title,
        "score": a.score,
        "pass_score": e.pass_score,
        "passed": (a.score or 0) >= e.pass_score,
        "question_count": e.question_count,
        "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
    } for a, e in rows]}


class ExamSubmit(BaseModel):
    openid: str = "web-user"
    answers: list[dict]


@sizheng_app.post("/exams/{exam_id}/submit")
async def submit_exam(exam_id: int, req: ExamSubmit, db: AsyncSession = Depends(get_db)):
    """学生提交考试答案，自动判分"""
    exam = (await db.execute(select(Exam).where(Exam.id == exam_id))).scalar()
    if not exam:
        return {"status": "error", "message": "考试不存在"}

    member = (await db.execute(select(Member).where(Member.wechat_openid == req.openid))).scalar()
    if not member:
        return {"status": "error", "message": "未绑定党员身份"}

    assignment = (await db.execute(
        select(ExamAssignment).where(
            ExamAssignment.exam_id == exam_id,
            ExamAssignment.member_id == member.id,
        )
    )).scalar()
    if not assignment:
        return {"status": "error", "message": "你未分配到该考试"}

    correct = 0
    total = len(req.answers)
    for a in req.answers:
        q = (await db.execute(select(Question).where(Question.id == a["question_id"]))).scalar()
        is_correct = False
        if q:
            is_correct = a.get("answer", "").strip().upper() == q.answer.strip().upper()
            if is_correct:
                correct += 1
        db.add(AnswerRecord(
            member_id=member.id, question_id=a["question_id"],
            exam_id=exam_id, user_answer=a.get("answer", ""),
            is_correct=is_correct,
        ))

    score = round(correct / total * 100) if total > 0 else 0
    assignment.status = "submitted"
    assignment.score = score
    assignment.submitted_at = beijing_now()
    await db.commit()

    return {"correct": correct, "total": total, "score": score, "passed": score >= exam.pass_score}


@sizheng_app.get("/exams/{exam_id}/results")
async def exam_results(exam_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师查看考试成绩"""
    rows = (await db.execute(
        select(ExamAssignment, Member.name, Member.wechat_openid)
        .join(Member, ExamAssignment.member_id == Member.id)
        .where(ExamAssignment.exam_id == exam_id)
    )).all()

    exam = (await db.execute(select(Exam).where(Exam.id == exam_id))).scalar()
    if not exam:
        return {"error": "考试不存在"}

    return {
        "exam_id": exam.id, "title": exam.title,
        "pass_score": exam.pass_score,
        "results": [
            {
                "member_name": name, "openid": openid,
                "status": a.status, "score": a.score,
                "submitted_at": a.submitted_at.isoformat() if a.submitted_at else None,
            }
            for a, name, openid in rows
        ],
    }


# ── 专题学习 ───────────────────────────────────────

class TopicCreate(BaseModel):
    title: str
    description: str = ""
    cover_url: str = ""
    order_num: int = 0


class TopicItemCreate(BaseModel):
    item_type: str  # "material" | "task"
    item_id: int


@sizheng_app.get("/topics")
async def list_topics(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Topic).order_by(Topic.order_num, Topic.created_at.desc())
    )).scalars().all()
    return [{"id": t.id, "title": t.title, "description": t.description,
             "cover_url": t.cover_url, "order_num": t.order_num,
             "created_at": t.created_at.isoformat()} for t in rows]


@sizheng_app.post("/topics")
async def create_topic(req: TopicCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = Topic(title=req.title, description=req.description,
              cover_url=req.cover_url, order_num=req.order_num)
    db.add(t)
    await db.commit()
    return {"id": t.id}


@sizheng_app.put("/topics/{topic_id}")
async def update_topic(topic_id: int, req: TopicCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar()
    if not t:
        return {"error": "专题不存在"}
    t.title = req.title
    t.description = req.description
    t.cover_url = req.cover_url
    t.order_num = req.order_num
    await db.commit()
    return {"status": "ok"}


@sizheng_app.delete("/topics/{topic_id}")
async def delete_topic(topic_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar()
    if not t:
        return {"error": "专题不存在"}
    await db.delete(t)
    await db.commit()
    return {"status": "ok"}


@sizheng_app.get("/topics/{topic_id}")
async def get_topic_detail(topic_id: int, db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar()
    if not t:
        return {"error": "专题不存在"}
    items = (await db.execute(
        select(TopicItem).where(TopicItem.topic_id == topic_id).order_by(TopicItem.order_num)
    )).scalars().all()
    detail = {"id": t.id, "title": t.title, "description": t.description,
              "cover_url": t.cover_url, "items": []}
    for item in items:
        item_data = {"id": item.id, "item_type": item.item_type, "item_id": item.item_id}
        if item.item_type == "material":
            m = (await db.execute(select(LearningMaterial).where(LearningMaterial.id == item.item_id))).scalar()
            if m:
                item_data["title"] = m.title
                item_data["type"] = m.type
                item_data["url"] = m.content_url
                item_data["description"] = m.description
        elif item.item_type == "task":
            task = (await db.execute(select(LearningTask).where(LearningTask.id == item.item_id))).scalar()
            if task:
                item_data["title"] = task.title
                item_data["description"] = task.description
        detail["items"].append(item_data)
    return detail


@sizheng_app.post("/topics/{topic_id}/items")
async def add_topic_item(topic_id: int, req: TopicItemCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = (await db.execute(select(Topic).where(Topic.id == topic_id))).scalar()
    if not t:
        return {"error": "专题不存在"}
    item = TopicItem(topic_id=topic_id, item_type=req.item_type, item_id=req.item_id)
    db.add(item)
    await db.commit()
    return {"id": item.id}


@sizheng_app.delete("/topics/items/{item_id}")
async def remove_topic_item(item_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    item = (await db.execute(select(TopicItem).where(TopicItem.id == item_id))).scalar()
    if not item:
        return {"error": "item 不存在"}
    await db.delete(item)
    await db.commit()
    return {"status": "ok"}


# ── 学习档案管理 ───────────────────────────────────

@sizheng_app.get("/learning-records")
async def get_learning_records(page: int = 1, page_size: int = 20, search: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师查看每位党员的学习统计"""
    # 查所有党员（支持姓名搜索）
    q = select(Member)
    if search:
        q = q.where(Member.name.ilike(f"%{search}%"))
    members = (await db.execute(q.order_by(Member.name).offset((page - 1) * page_size).limit(page_size))).scalars().all()
    count_q = select(func.count()).select_from(Member)
    if search:
        count_q = count_q.where(Member.name.ilike(f"%{search}%"))
    total = (await db.execute(count_q)).scalar() or 0

    items = []
    for m in members:
        # 浏览材料数
        material_count = (await db.execute(
            select(func.count()).select_from(LearningRecord)
            .where(LearningRecord.member_id == m.id)
        )).scalar() or 0
        # 完成任务数
        task_count = (await db.execute(
            select(func.count()).select_from(TaskAssignment)
            .where(TaskAssignment.member_id == m.id, TaskAssignment.status == "completed")
        )).scalar() or 0
        # 考试次数
        exam_count = (await db.execute(
            select(func.count()).select_from(ExamAssignment)
            .where(ExamAssignment.member_id == m.id, ExamAssignment.status == "submitted")
        )).scalar() or 0
        # 考试均分
        avg_score_row = (await db.execute(
            select(func.avg(ExamAssignment.score)).select_from(ExamAssignment)
            .where(ExamAssignment.member_id == m.id, ExamAssignment.status == "submitted")
        )).scalar()
        avg_score = round(avg_score_row, 1) if avg_score_row else None
        # 考试通过率
        total_exams = (await db.execute(
            select(func.count()).select_from(ExamAssignment)
            .where(ExamAssignment.member_id == m.id, ExamAssignment.status == "submitted")
        )).scalar() or 0
        total_passed = 0
        if total_exams > 0:
            # 对每场考试判断是否通过
            exam_assignments = (await db.execute(
                select(ExamAssignment).where(
                    ExamAssignment.member_id == m.id,
                    ExamAssignment.status == "submitted",
                )
            )).scalars().all()
            for ea in exam_assignments:
                e = (await db.execute(select(Exam).where(Exam.id == ea.exam_id))).scalar()
                if e and ea.score >= e.pass_score:
                    total_passed += 1
        pass_rate = round(total_passed / total_exams * 100, 1) if total_exams > 0 else None

        items.append({
            "member_id": m.id, "name": m.name, "student_id": m.student_id,
            "material_count": material_count, "task_count": task_count,
            "exam_count": exam_count, "avg_score": avg_score,
            "pass_rate": pass_rate,
        })

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@sizheng_app.get("/learning-records/export")
async def export_learning_records(
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """导出学习记录为 Excel"""
    from openpyxl import Workbook
    from io import BytesIO
    from fastapi.responses import StreamingResponse

    rows = (await db.execute(
        select(LearningRecord, Member.name, Member.student_id, Member.branch_id, LearningMaterial.title)
        .join(Member, LearningRecord.member_id == Member.id)
        .outerjoin(LearningMaterial, LearningRecord.material_id == LearningMaterial.id)
        .order_by(LearningRecord.created_at.desc())
    )).all()

    # Build branch name map
    bid_set = {r[3] for r in rows if r[3]}
    branch_map = {}
    if bid_set:
        branches = (await db.execute(select(Branch).where(Branch.id.in_(bid_set)))).scalars().all()
        branch_map = {b.id: b.name for b in branches}

    wb = Workbook()
    ws = wb.active
    ws.title = "学习记录"
    headers = ["姓名", "学号", "支部", "学习材料", "开始时间", "结束时间", "时长(秒)", "已完成", "记录时间"]
    ws.append(headers)

    for lr, name, student_id, bid, mat_title in rows:
        ws.append([
            name, student_id, branch_map.get(bid, ""),
            mat_title or "",
            lr.start_time.isoformat() if lr.start_time else "",
            lr.end_time.isoformat() if lr.end_time else "",
            lr.duration or 0,
            "是" if lr.completed else "否",
            lr.created_at.isoformat() if lr.created_at else "",
        ])

    for col in ws.columns:
        max_len = max((len(str(c.value or "")) for c in col), default=8)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 2, 36)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=learning_records.xlsx"},
    )


# ── 学习动态 ───────────────────────────────────────

@sizheng_app.get("/learning-activities")
async def get_learning_activities(page: int = 1, page_size: int = 30, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师查看近期学习动态"""
    activities = []

    # 学习记录（浏览材料）
    lr_rows = (await db.execute(
        select(LearningRecord, Member.name)
        .join(Member, LearningRecord.member_id == Member.id)
        .order_by(LearningRecord.created_at.desc())
        .limit(200)
    )).all()
    for lr, name in lr_rows:
        mat = (await db.execute(select(LearningMaterial).where(LearningMaterial.id == lr.material_id))).scalar()
        activities.append({
            "type": "learning",
            "member_name": name,
            "description": f"浏览了学习材料《{mat.title if mat else '未知'}》",
            "time": lr.created_at.isoformat() if lr.created_at else None,
        })

    # 考试记录
    ar_rows = (await db.execute(
        select(AnswerRecord, Member.name)
        .join(Member, AnswerRecord.member_id == Member.id)
        .where(AnswerRecord.exam_id != None)
        .order_by(AnswerRecord.created_at.desc())
        .limit(200)
    )).all()
    seen_exams = set()
    for ar, name in ar_rows:
        if ar.exam_id and ar.exam_id not in seen_exams:
            seen_exams.add(ar.exam_id)
            exam = (await db.execute(select(Exam).where(Exam.id == ar.exam_id))).scalar()
            assignment = (await db.execute(
                select(ExamAssignment).where(
                    ExamAssignment.exam_id == ar.exam_id,
                    ExamAssignment.member_id == ar.member_id,
                )
            )).scalar()
            if assignment and assignment.status == "submitted":
                activities.append({
                    "type": "exam",
                    "member_name": name,
                    "description": f"完成考试《{exam.title if exam else '未知'}》得分 {assignment.score}",
                    "time": assignment.submitted_at.isoformat() if assignment.submitted_at else None,
                })

    # 按时间倒序
    activities.sort(key=lambda x: x["time"] or "", reverse=True)

    total = len(activities)
    start = (page - 1) * page_size
    items = activities[start:start + page_size]

    return {"items": items, "total": total, "page": page, "page_size": page_size}


# ── 学习笔记 ───────────────────────────────────────

class NoteCreate(BaseModel):
    openid: str = "web-user"
    material_id: int
    content: str


@sizheng_app.get("/notes")
async def list_notes(material_id: int | None = None, openid: str = "", db: AsyncSession = Depends(get_db)):
    """查看笔记：openid 为空时教师看全部，有值时学生看自己的"""
    q = select(LearningNote)
    if material_id:
        q = q.where(LearningNote.material_id == material_id)
    if openid:
        member = (await db.execute(select(Member).where(Member.wechat_openid == openid))).scalar()
        if member:
            q = q.where(LearningNote.member_id == member.id)
        else:
            return []
    q = q.order_by(LearningNote.created_at.desc())
    notes = (await db.execute(q)).scalars().all()
    return [
        {
            "id": n.id, "content": n.content,
            "material_id": n.material_id, "member_id": n.member_id,
            "created_at": n.created_at.isoformat(),
        }
        for n in notes
    ]


@sizheng_app.post("/notes")
async def create_note(req: NoteCreate, db: AsyncSession = Depends(get_db)):
    member = (await db.execute(select(Member).where(Member.wechat_openid == req.openid))).scalar()
    if not member:
        return {"error": "未绑定党员身份"}
    n = LearningNote(member_id=member.id, material_id=req.material_id, content=req.content)
    db.add(n)
    await db.commit()
    return {"id": n.id}


@sizheng_app.delete("/notes/{note_id}")
async def delete_note(note_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(LearningNote).where(LearningNote.id == note_id))).scalar()
    if not n:
        return {"error": "笔记不存在"}
    await db.delete(n)
    await db.commit()
    return {"status": "ok"}


# ── 学习简报 ───────────────────────────────────────

@sizheng_app.get("/learning-briefing")
async def get_learning_briefing(start_date: str = "", end_date: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """教师生成学习简报"""
    from datetime import date
    sd = date.fromisoformat(start_date) if start_date else date.today().replace(day=1)
    ed = date.fromisoformat(end_date) if end_date else date.today()

    # 学习人次
    lr_count = (await db.execute(
        select(func.count()).select_from(LearningRecord)
        .where(LearningRecord.created_at >= sd, LearningRecord.created_at <= ed)
    )).scalar() or 0

    # 完成任务数
    task_count = (await db.execute(
        select(func.count()).select_from(TaskAssignment)
        .where(TaskAssignment.status == "completed",
               TaskAssignment.completed_at >= sd, TaskAssignment.completed_at <= ed)
    )).scalar() or 0

    # 考试通过率
    total_exams = (await db.execute(
        select(func.count()).select_from(ExamAssignment)
        .where(ExamAssignment.status == "submitted",
               ExamAssignment.submitted_at >= sd, ExamAssignment.submitted_at <= ed)
    )).scalar() or 0
    total_passed = 0
    if total_exams > 0:
        eas = (await db.execute(
            select(ExamAssignment).where(
                ExamAssignment.status == "submitted",
                ExamAssignment.submitted_at >= sd, ExamAssignment.submitted_at <= ed,
            )
        )).scalars().all()
        for ea in eas:
            e = (await db.execute(select(Exam).where(Exam.id == ea.exam_id))).scalar()
            if e and ea.score >= e.pass_score:
                total_passed += 1
    pass_rate = round(total_passed / total_exams * 100, 1) if total_exams > 0 else 0

    # 新增材料数
    new_materials = (await db.execute(
        select(func.count()).select_from(LearningMaterial)
        .where(LearningMaterial.created_at >= sd, LearningMaterial.created_at <= ed)
    )).scalar() or 0

    # 最活跃 Top 5（按浏览材料+任务+考试综合）
    all_learners = (await db.execute(
        select(LearningRecord.member_id, func.count().label("cnt"))
        .where(LearningRecord.created_at >= sd, LearningRecord.created_at <= ed)
        .group_by(LearningRecord.member_id)
        .order_by(func.count().desc())
        .limit(5)
    )).all()

    top_learners = []
    for mid, cnt in all_learners:
        m = (await db.execute(select(Member).where(Member.id == mid))).scalar()
        if m:
            top_learners.append({"name": m.name, "student_id": m.student_id, "activity_count": cnt})

    return {
        "period": {"start": sd.isoformat(), "end": ed.isoformat()},
        "learning_count": lr_count,
        "task_count": task_count,
        "pass_rate": pass_rate,
        "new_materials": new_materials,
        "top_learners": top_learners,
    }


# ── 自测练习 ───────────────────────────────────────

async def _ensure_questions(category: str, difficulty: str, count: int, db: AsyncSession) -> list[Question]:
    """调 Dify 出题工作流，解析 JSON，去重入库，不够时自动补调，返回新生成的 Question 列表"""
    new_questions = []
    needed = count
    max_rounds = 3

    for round_num in range(max_rounds):
        if needed <= 0:
            break

        resp = await asyncio.to_thread(
            requests.post,
            f"{DIFY_API_URL}/workflows/run",
            headers={"Authorization": f"Bearer {DIFY_QUIZ_API_KEY}", "Content-Type": "application/json"},
            json={
                "inputs": {
                    "_category_": category,
                    "difficulty_": difficulty.strip() if difficulty.strip() != "hard" else "hard  ",
                    "count_": max(needed + 2, 3),  # 多要几个，防止去重后不够
                },
                "response_mode": "blocking",
                "user": "portal-quiz",
            },
            timeout=300,
        )
        resp.raise_for_status()
        raw = resp.json().get("data", {}).get("outputs", {}).get("text", "")
        cleaned = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```\w*\n?", "", cleaned)
            cleaned = re.sub(r"\n?```$", "", cleaned)

        items = json.loads(cleaned)[:needed]
        round_new = 0
        for q in items:
            existing = (await db.execute(
                select(Question).where(Question.content == q["content"])
            )).scalar()
            if existing:
                continue
            question = Question(
                content=q["content"],
                type="choice" if q.get("type") == "choice" else "truefalse",
                options=json.dumps(q.get("options") or [], ensure_ascii=False),
                answer=q["answer"],
                explanation=q.get("explanation", ""),
                category=category,
                difficulty=difficulty.strip(),
            )
            db.add(question)
            new_questions.append(question)
            round_new += 1

        await db.commit()
        needed = count - len(new_questions)
        if round_new == 0 and needed > 0:
            break  # 连续 0 新增，说明已无新题可出

    return new_questions


class GenerateQuestionsRequest(BaseModel):
    category: str
    difficulty: str
    count: int = 5


@sizheng_app.post("/questions/generate")
async def generate_questions(req: GenerateQuestionsRequest, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    if not DIFY_QUIZ_API_KEY:
        return {"status": "error", "message": "出题工作流 API Key 未配置"}
    try:
        new_qs = await _ensure_questions(req.category, req.difficulty, req.count, db)
        return {"status": "ok", "generated": len(new_qs)}
    except requests.RequestException as e:
        return {"status": "error", "message": f"出题服务调用失败: {str(e)}"}
    except json.JSONDecodeError:
        return {"status": "error", "message": "出题结果解析失败，LLM 输出格式异常"}


class PreGenerateRequest(BaseModel):
    category: str
    target_count: int = 40
    difficulties: list[str] = ["easy", "medium", "hard"]


@sizheng_app.post("/questions/pre-generate")
async def pre_generate_questions(req: PreGenerateRequest, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """批量预生成题目：每种难度生成 target_count/3 道，不等待"""
    if not DIFY_QUIZ_API_KEY:
        return {"status": "error", "message": "出题工作流 API Key 未配置"}

    per_diff = max(req.target_count // len(req.difficulties), 3)
    results = {}
    total = 0

    for diff in req.difficulties:
        try:
            new_qs = await _ensure_questions(req.category, diff, per_diff, db)
            results[diff] = len(new_qs)
            total += len(new_qs)
        except Exception as e:
            results[diff] = f"失败: {str(e)}"

    return {"status": "ok", "category": req.category, "by_difficulty": results, "total_generated": total}


class PreGenerateAllRequest(BaseModel):
    target_per_category: int = 40


@sizheng_app.post("/questions/pre-generate-all")
async def pre_generate_all(req: PreGenerateAllRequest, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """一键预生成全部 4 个分类的题目"""
    if not DIFY_QUIZ_API_KEY:
        return {"status": "error", "message": "出题工作流 API Key 未配置"}

    categories = ["charter", "policy", "history", "education"]
    per_diff = max(req.target_per_category // 3, 3)
    all_results = {}
    grand_total = 0

    for cat in categories:
        all_results[cat] = {}
        for diff in ["easy", "medium", "hard"]:
            try:
                new_qs = await _ensure_questions(cat, diff, per_diff, db)
                all_results[cat][diff] = len(new_qs)
                grand_total += len(new_qs)
            except Exception as e:
                all_results[cat][diff] = f"失败: {str(e)}"

    return {
        "status": "ok",
        "target_per_category": req.target_per_category,
        "by_category": all_results,
        "grand_total": grand_total,
    }


@sizheng_app.get("/questions")
async def get_questions(
    category: str = "",
    page: int = 1,
    page_size: int = 50,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    q = select(Question)
    if category:
        q = q.where(Question.category == category)
    q = q.order_by(Question.id.desc())
    q = q.offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(q)).scalars().all()

    total_q = select(func.count()).select_from(Question)
    if category:
        total_q = total_q.where(Question.category == category)
    total = (await db.execute(total_q)).scalar() or 0

    return {
        "items": [
            {
                "id": it.id,
                "content": it.content,
                "type": it.type,
                "options": it.options,
                "answer": it.answer,
                "explanation": it.explanation,
                "category": it.category,
                "difficulty": it.difficulty,
            }
            for it in items
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@sizheng_app.delete("/questions/{question_id}")
async def delete_question(question_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = (await db.execute(select(Question).where(Question.id == question_id))).scalar()
    if not q:
        return {"error": "not found"}
    await db.execute(sa_delete(AnswerRecord).where(AnswerRecord.question_id == question_id))
    await db.delete(q)
    await db.commit()
    return {"status": "ok"}


class CheckAnswerRequest(BaseModel):
    question_id: int
    user_answer: str
    openid: str = "web-user"
    time_spent: int | None = None


@sizheng_app.post("/questions/check")
async def check_answer(req: CheckAnswerRequest, db: AsyncSession = Depends(get_db)):
    question = (await db.execute(
        select(Question).where(Question.id == req.question_id)
    )).scalar()
    if not question:
        return {"status": "error", "message": "题目不存在"}

    is_correct = req.user_answer.strip().upper() == question.answer.strip().upper()

    member = await _resolve_member(req.openid, db)
    if member:
        db.add(AnswerRecord(
            member_id=member.id,
            question_id=req.question_id,
            user_answer=req.user_answer,
            is_correct=is_correct,
            time_spent=req.time_spent,
        ))
        await db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": question.answer,
        "explanation": question.explanation,
    }


async def _resolve_member(openid: str, db: AsyncSession):
    if not openid or openid == "web-user":
        return None
    return (await db.execute(
        select(Member).where(Member.wechat_openid == openid)
    )).scalar()


# ── 题库进度（自测练习 v2） ──────────────────────────

CATEGORY_LABELS = {
    "charter": "党章党纪",
    "policy": "时政方针",
    "history": "党史学习",
    "education": "党性教育",
}
CATEGORIES = list(CATEGORY_LABELS.keys())
SESSION_SIZE = 10


@sizheng_app.get("/quiz/overview")
async def quiz_overview(openid: str, db: AsyncSession = Depends(get_db)):
    """返回四个题库的进度概览（未登录也返回题库，进度为 0）"""
    member = await _resolve_member(openid, db)

    result = []
    for cat in CATEGORIES:
        total = (await db.execute(
            select(func.count()).select_from(Question).where(Question.category == cat)
        )).scalar() or 0

        current_idx = 0
        answered_distinct = 0
        wrong_count = 0

        if member:
            progress = (await db.execute(
                select(QuizProgress).where(
                    QuizProgress.member_id == member.id,
                    QuizProgress.category == cat,
                )
            )).scalar()
            current_idx = progress.current_index if progress else 0

            wrong_count = (await db.execute(
                select(func.count()).select_from(AnswerRecord)
                .join(Question)
                .where(
                    AnswerRecord.member_id == member.id,
                    Question.category == cat,
                    AnswerRecord.is_correct == False,
                )
            )).scalar() or 0

            answered_distinct = (await db.execute(
                select(func.count(func.distinct(AnswerRecord.question_id)))
                .select_from(AnswerRecord)
                .join(Question)
                .where(
                    AnswerRecord.member_id == member.id,
                    Question.category == cat,
                )
            )).scalar() or 0

        result.append({
            "category": cat,
            "label": CATEGORY_LABELS[cat],
            "total": total,
            "current_index": current_idx,
            "answered_count": answered_distinct,
            "wrong_count": wrong_count,
        })

    return result


class QuizAnswerRequest(BaseModel):
    question_id: int
    user_answer: str
    category: str
    question_index: int  # 该题在题库中的序号 (0-based)
    openid: str = "web-user"
    time_spent: int | None = None


@sizheng_app.post("/quiz/answer")
async def quiz_answer(req: QuizAnswerRequest, db: AsyncSession = Depends(get_db)):
    """提交单题答案，记录进度，返回判分"""
    question = (await db.execute(
        select(Question).where(Question.id == req.question_id)
    )).scalar()
    if not question:
        return {"status": "error", "message": "题目不存在"}

    is_correct = req.user_answer.strip().upper() == question.answer.strip().upper()

    member = await _resolve_member(req.openid, db)
    if member:
        db.add(AnswerRecord(
            member_id=member.id,
            question_id=req.question_id,
            user_answer=req.user_answer,
            is_correct=is_correct,
            time_spent=req.time_spent,
        ))

        # 更新进度
        progress = (await db.execute(
            select(QuizProgress).where(
                QuizProgress.member_id == member.id,
                QuizProgress.category == req.category,
            )
        )).scalar()
        if progress:
            progress.current_index = max(progress.current_index, req.question_index + 1)
            progress.updated_at = beijing_now()
        else:
            db.add(QuizProgress(
                member_id=member.id,
                category=req.category,
                current_index=req.question_index + 1,
            ))

        await db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": question.answer,
        "explanation": question.explanation,
    }


@sizheng_app.get("/quiz/questions")
async def quiz_questions(
    category: str,
    openid: str,
    offset: int = 0,
    limit: int = SESSION_SIZE,
    db: AsyncSession = Depends(get_db),
):
    """按序取题（按 id 排序，保证顺序稳定）"""
    existing = (await db.execute(
        select(Question)
        .where(Question.category == category)
        .order_by(Question.id.asc())
        .offset(offset)
        .limit(limit)
    )).scalars().all()

    total = (await db.execute(
        select(func.count()).select_from(Question).where(Question.category == category)
    )).scalar() or 0

    return {
        "questions": [
            {
                "id": q.id,
                "content": q.content,
                "type": q.type,
                "options": q.options,
                "category": q.category,
                "difficulty": q.difficulty,
            }
            for q in existing
        ],
        "total": total,
        "offset": offset,
    }


@sizheng_app.get("/quiz/wrong")
async def quiz_wrong(openid: str, category: str | None = None, db: AsyncSession = Depends(get_db)):
    """获取错题列表，可按分类筛选"""
    member = await _resolve_member(openid, db)
    if not member:
        return []

    conditions = [
        AnswerRecord.member_id == member.id,
        AnswerRecord.is_correct == False,
    ]

    query = (
        select(AnswerRecord, Question)
        .join(Question)
        .where(*conditions)
    )

    if category:
        query = query.where(Question.category == category)

    query = query.order_by(AnswerRecord.created_at.desc())

    rows = (await db.execute(query)).all()

    return [
        {
            "record_id": ar.id,
            "question_id": q.id,
            "content": q.content,
            "type": q.type,
            "options": q.options,
            "answer": q.answer,
            "explanation": q.explanation,
            "category": q.category,
            "user_answer": ar.user_answer,
            "answered_at": ar.created_at.isoformat(),
        }
        for ar, q in rows
    ]


# ── 宣传中心 · 图片管理 ────────────────────────────

from urllib.parse import quote

MEDIA_IMAGES_DIR = "/opt/party-agent/frontends/admin/media/images"

@sizheng_app.get("/promotion/images/albums")
async def get_image_albums():
    """返回所有相册及其照片列表"""
    if not os.path.isdir(MEDIA_IMAGES_DIR):
        return {"albums": []}

    albums = []
    for name in sorted(os.listdir(MEDIA_IMAGES_DIR)):
        dpath = os.path.join(MEDIA_IMAGES_DIR, name)
        if not os.path.isdir(dpath):
            continue
        files = sorted([
            f for f in os.listdir(dpath)
            if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
        ])
        if not files:
            continue
        albums.append({
            "key": name,
            "count": len(files),
            "cover": f"/admin/media/images/{quote(name)}/{quote(files[0])}",
            "photos": [f"/admin/media/images/{quote(name)}/{quote(f)}" for f in files],
        })

    return {"albums": albums}


@sizheng_app.post("/promotion/images/upload")
async def upload_images(album: str = Form(...), files: list[UploadFile] = File(...)):
    """上传图片到指定相册（相册不存在则自动创建）"""
    # Sanitize album key: only allow alphanumeric, hyphens, underscores, Chinese
    safe_album = re.sub(r'[^\w一-鿿-]', '', album)
    if not safe_album:
        return {"status": "error", "message": "相册名称无效"}

    album_dir = os.path.join(MEDIA_IMAGES_DIR, safe_album)
    os.makedirs(album_dir, exist_ok=True)

    # Find the next photo number
    existing = [f for f in os.listdir(album_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))]
    next_num = len(existing) + 1

    uploaded = []
    for f in files:
        if not f.filename:
            continue
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in ('.jpg', '.jpeg', '.png', '.webp'):
            continue

        contents = await f.read()
        img = Image.open(io.BytesIO(contents))

        # Convert to RGB with white background (handles PNG alpha → JPG)
        if img.mode in ('RGBA', 'LA', 'P'):
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            rgb_img.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
            img = rgb_img
        elif img.mode != 'RGB':
            img = img.convert('RGB')

        new_name = f"{next_num:02d}.jpg"
        dest = os.path.join(album_dir, new_name)
        img.save(dest, 'JPEG', quality=90)

        uploaded.append({
            "name": new_name,
            "url": f"/admin/media/images/{safe_album}/{new_name}",
        })
        next_num += 1

    return {"status": "ok", "album": safe_album, "uploaded": uploaded}


@sizheng_app.delete("/promotion/images/delete")
async def delete_image(album: str, filename: str):
    """删除指定相册中的某张照片，并重新编号剩余文件"""
    safe_album = re.sub(r'[^\w一-鿿-]', '', album)
    safe_name = os.path.basename(filename)
    album_dir = os.path.join(MEDIA_IMAGES_DIR, safe_album)
    path = os.path.join(album_dir, safe_name)

    if not os.path.isfile(path):
        return {"status": "error", "message": "文件不存在"}

    os.remove(path)

    # Renumber remaining files to keep sequential names
    remaining = sorted([
        f for f in os.listdir(album_dir)
        if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))
    ])
    for i, f in enumerate(remaining):
        ext = os.path.splitext(f)[1].lower()
        new_name = f"{i + 1:02d}{ext}"
        if f != new_name:
            os.rename(os.path.join(album_dir, f), os.path.join(album_dir, new_name))

    # Remove album directory if empty
    if len(remaining) == 0:
        os.rmdir(album_dir)

    return {"status": "ok", "remaining": len(remaining)}


# ── 活动中心 · 会议管理 ──────────────────────────────

class MeetingCreate(BaseModel):
    meeting_type: str
    title: str
    meeting_date: str
    location: str
    host: str
    recorder: str
    attendees: str
    observers: str = ""
    absentees: str = ""
    topic: str
    content: str = ""
    extra_fields: dict | None = None
    branch_id: int | None = None

class MeetingUpdate(BaseModel):
    meeting_type: str | None = None
    title: str | None = None
    meeting_date: str | None = None
    location: str | None = None
    host: str | None = None
    recorder: str | None = None
    attendees: str | None = None
    observers: str | None = None
    absentees: str | None = None
    topic: str | None = None
    content: str | None = None
    extra_fields: dict | None = None
    branch_id: int | None = None

@sizheng_app.get("/meetings")
async def list_meetings(
    type: str = "",
    search: str = "",
    page: int = 1,
    page_size: int = 20,
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db),
):
    q = select(Meeting)
    count_q = select(func.count()).select_from(Meeting)

    if type:
        types = [t.strip() for t in type.split(",") if t.strip()]
        if types:
            q = q.where(Meeting.meeting_type.in_(types))
            count_q = count_q.where(Meeting.meeting_type.in_(types))
    if search:
        q = q.where(Meeting.title.ilike(f"%{search}%"))
        count_q = count_q.where(Meeting.title.ilike(f"%{search}%"))

    total = (await db.execute(count_q)).scalar() or 0
    items = (await db.execute(
        q.order_by(Meeting.meeting_date.desc()).offset((page - 1) * page_size).limit(page_size)
    )).scalars().all()

    return {
        "items": [{ "id": m.id, "meeting_type": m.meeting_type, "title": m.title,
            "meeting_date": str(m.meeting_date), "location": m.location,
            "host": m.host, "recorder": m.recorder, "attendees": m.attendees,
            "observers": m.observers, "absentees": m.absentees, "topic": m.topic,
            "content": m.content, "extra_fields": m.extra_fields,
            "branch_id": m.branch_id, "created_at": str(m.created_at) } for m in items],
        "total": total, "page": page, "page_size": page_size,
    }

@sizheng_app.get("/meetings/stats")
async def meeting_stats(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    """Return meeting counts by type for current month / quarter / year."""
    today = beijing_now().date()
    month_start = today.replace(day=1)
    q = (today.month - 1) // 3
    q_start = today.replace(month=q * 3 + 1, day=1)
    year_start = today.replace(month=1, day=1)

    def _count(rows, t):
        for r in rows:
            if r[0] == t: return r[1]
        return 0

    async def query_async(start_date):
        qq = select(Meeting.meeting_type, func.count()).where(
            Meeting.meeting_date >= start_date
        ).group_by(Meeting.meeting_type)
        return (await db.execute(qq)).all()

    month_rows = await query_async(month_start)
    quarter_rows = await query_async(q_start)
    year_rows = await query_async(year_start)

    TYPES = ["party_member_congress", "branch_committee", "party_group",
             "party_lecture", "theme_party_day"]

    return {
        "month": {t: _count(month_rows, t) for t in TYPES},
        "quarter": {t: _count(quarter_rows, t) for t in TYPES},
        "year": {t: _count(year_rows, t) for t in TYPES},
    }

@sizheng_app.get("/meetings/{meeting_id}")
async def get_meeting(meeting_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        return {"error": "会议不存在"}
    return { "id": m.id, "meeting_type": m.meeting_type, "title": m.title,
        "meeting_date": str(m.meeting_date), "location": m.location,
        "host": m.host, "recorder": m.recorder, "attendees": m.attendees,
        "observers": m.observers, "absentees": m.absentees, "topic": m.topic,
        "content": m.content, "extra_fields": m.extra_fields,
        "branch_id": m.branch_id, "created_at": str(m.created_at) }

@sizheng_app.post("/meetings")
async def create_meeting(data: MeetingCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    m = Meeting(
        meeting_type=data.meeting_type,
        title=data.title,
        meeting_date=datetime.strptime(data.meeting_date, "%Y-%m-%d").date(),
        location=data.location,
        host=data.host,
        recorder=data.recorder,
        attendees=data.attendees,
        observers=data.observers or None,
        absentees=data.absentees or None,
        topic=data.topic,
        content=data.content or None,
        extra_fields=data.extra_fields,
        branch_id=data.branch_id,
    )
    db.add(m)
    await db.commit()
    await db.refresh(m)
    return {"status": "ok", "id": m.id, "title": m.title}

@sizheng_app.put("/meetings/{meeting_id}")
async def update_meeting(meeting_id: int, data: MeetingUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        return {"error": "会议不存在"}
    for field in ["meeting_type", "title", "location", "host", "recorder",
                  "attendees", "observers", "absentees", "topic", "content",
                  "extra_fields", "branch_id"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(m, field, val)
    if data.meeting_date:
        m.meeting_date = datetime.strptime(data.meeting_date, "%Y-%m-%d").date()
    await db.commit()
    return {"status": "ok", "id": m.id}

@sizheng_app.delete("/meetings/{meeting_id}")
async def delete_meeting(meeting_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    m = await db.get(Meeting, meeting_id)
    if not m:
        return {"error": "会议不存在"}
    await db.delete(m)
    await db.commit()
    return {"status": "ok"}


# ── 办公中心 ─────────────────────────────────────────

# -- 通知公告 --

class NoticeCreate(BaseModel):
    title: str
    content: str = ""
    status: str = "draft"
    branch_id: int | None = None

class NoticeUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    status: str | None = None
    branch_id: int | None = None

def _notice_out(n):
    return { "id": n.id, "title": n.title, "content": n.content,
        "status": n.status, "branch_id": n.branch_id,
        "published_at": str(n.published_at) if n.published_at else None,
        "created_at": str(n.created_at) }

@sizheng_app.get("/notices")
async def list_notices(search: str = "", status: str = "", page: int = 1, page_size: int = 20, db: AsyncSession = Depends(get_db)):
    q = select(Notice).order_by(Notice.created_at.desc())
    cq = select(func.count()).select_from(Notice)
    if search:
        q = q.where(Notice.title.ilike(f"%{search}%"))
        cq = cq.where(Notice.title.ilike(f"%{search}%"))
    if status:
        q = q.where(Notice.status == status)
        cq = cq.where(Notice.status == status)
    total = (await db.execute(cq)).scalar() or 0
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"items": [_notice_out(n) for n in items], "total": total, "page": page, "page_size": page_size}

@sizheng_app.post("/notices")
async def create_notice(data: NoticeCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    n = Notice(title=data.title, content=data.content, status=data.status, branch_id=data.branch_id)
    if data.status == "published": n.published_at = beijing_now()
    db.add(n); await db.commit(); await db.refresh(n)
    return {"status": "ok", "id": n.id}

@sizheng_app.put("/notices/{notice_id}")
async def update_notice(notice_id: int, data: NoticeUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    n = await db.get(Notice, notice_id)
    if not n: return {"error": "不存在"}
    for f in ["title", "content", "status", "branch_id"]:
        v = getattr(data, f, None)
        if v is not None: setattr(n, f, v)
    if data.status == "published" and not n.published_at: n.published_at = beijing_now()
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/notices/{notice_id}")
async def delete_notice(notice_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    n = await db.get(Notice, notice_id)
    if not n: return {"error": "不存在"}
    await db.delete(n); await db.commit()
    return {"status": "ok"}


# -- 工作待办 --

class TodoCreate(BaseModel):
    title: str
    description: str = ""
    assignee: str = ""
    deadline: str | None = None
    priority: str = "medium"
    status: str = "pending"

class TodoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee: str | None = None
    deadline: str | None = None
    priority: str | None = None
    status: str | None = None

def _todo_out(t):
    return { "id": t.id, "title": t.title, "description": t.description,
        "assignee": t.assignee, "deadline": str(t.deadline) if t.deadline else None,
        "priority": t.priority, "status": t.status, "created_at": str(t.created_at) }

@sizheng_app.get("/todos")
async def list_todos(search: str = "", status: str = "", page: int = 1, page_size: int = 20, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Todo).order_by(Todo.created_at.desc())
    cq = select(func.count()).select_from(Todo)
    if search:
        q = q.where(Todo.title.ilike(f"%{search}%"))
        cq = cq.where(Todo.title.ilike(f"%{search}%"))
    if status:
        q = q.where(Todo.status == status)
        cq = cq.where(Todo.status == status)
    total = (await db.execute(cq)).scalar() or 0
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"items": [_todo_out(t) for t in items], "total": total, "page": page, "page_size": page_size}

@sizheng_app.post("/todos")
async def create_todo(data: TodoCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = Todo(title=data.title, description=data.description, assignee=data.assignee,
             priority=data.priority, status=data.status)
    if data.deadline: t.deadline = datetime.strptime(data.deadline, "%Y-%m-%d").date()
    db.add(t); await db.commit(); await db.refresh(t)
    return {"status": "ok", "id": t.id}

@sizheng_app.put("/todos/{todo_id}")
async def update_todo(todo_id: int, data: TodoUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = await db.get(Todo, todo_id)
    if not t: return {"error": "不存在"}
    for f in ["title", "description", "assignee", "priority", "status"]:
        v = getattr(data, f, None)
        if v is not None: setattr(t, f, v)
    if data.deadline: t.deadline = datetime.strptime(data.deadline, "%Y-%m-%d").date()
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = await db.get(Todo, todo_id)
    if not t: return {"error": "不存在"}
    await db.delete(t); await db.commit()
    return {"status": "ok"}


# -- 公文流转 --

class DocCreate(BaseModel):
    title: str
    content: str = ""
    doc_type: str = "receipt"
    doc_number: str = ""
    sender: str = ""
    receiver: str = ""
    status: str = "draft"

class DocUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    doc_type: str | None = None
    doc_number: str | None = None
    sender: str | None = None
    receiver: str | None = None
    status: str | None = None

def _doc_out(d):
    return { "id": d.id, "title": d.title, "content": d.content,
        "doc_type": d.doc_type, "doc_number": d.doc_number,
        "sender": d.sender, "receiver": d.receiver, "status": d.status,
        "created_at": str(d.created_at) }

@sizheng_app.get("/documents")
async def list_documents(search: str = "", doc_type: str = "", status: str = "", page: int = 1, page_size: int = 20, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Document).order_by(Document.created_at.desc())
    cq = select(func.count()).select_from(Document)
    if search:
        q = q.where(Document.title.ilike(f"%{search}%"))
        cq = cq.where(Document.title.ilike(f"%{search}%"))
    if doc_type:
        q = q.where(Document.doc_type == doc_type)
        cq = cq.where(Document.doc_type == doc_type)
    if status:
        q = q.where(Document.status == status)
        cq = cq.where(Document.status == status)
    total = (await db.execute(cq)).scalar() or 0
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"items": [_doc_out(d) for d in items], "total": total, "page": page, "page_size": page_size}

@sizheng_app.post("/documents")
async def create_document(data: DocCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = Document(**data.model_dump())
    db.add(d); await db.commit(); await db.refresh(d)
    return {"status": "ok", "id": d.id}

@sizheng_app.put("/documents/{doc_id}")
async def update_document(doc_id: int, data: DocUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(Document, doc_id)
    if not d: return {"error": "不存在"}
    for f in ["title", "content", "doc_type", "doc_number", "sender", "receiver", "status"]:
        v = getattr(data, f, None)
        if v is not None: setattr(d, f, v)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/documents/{doc_id}")
async def delete_document(doc_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(Document, doc_id)
    if not d: return {"error": "不存在"}
    await db.delete(d); await db.commit()
    return {"status": "ok"}


# -- 日程安排 --

class SchedCreate(BaseModel):
    title: str
    description: str = ""
    start_time: str
    end_time: str = ""
    location: str = ""
    event_type: str = "other"

class SchedUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    event_type: str | None = None

def _sched_out(s):
    return { "id": s.id, "title": s.title, "description": s.description,
        "start_time": str(s.start_time), "end_time": str(s.end_time) if s.end_time else None,
        "location": s.location, "event_type": s.event_type, "created_at": str(s.created_at) }

@sizheng_app.get("/schedules")
async def list_schedules(search: str = "", event_type: str = "", page: int = 1, page_size: int = 20, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Schedule).order_by(Schedule.start_time.desc())
    cq = select(func.count()).select_from(Schedule)
    if search:
        q = q.where(Schedule.title.ilike(f"%{search}%"))
        cq = cq.where(Schedule.title.ilike(f"%{search}%"))
    if event_type:
        q = q.where(Schedule.event_type == event_type)
        cq = cq.where(Schedule.event_type == event_type)
    total = (await db.execute(cq)).scalar() or 0
    items = (await db.execute(q.offset((page-1)*page_size).limit(page_size))).scalars().all()
    return {"items": [_sched_out(s) for s in items], "total": total, "page": page, "page_size": page_size}

@sizheng_app.post("/schedules")
async def create_schedule(data: SchedCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = Schedule(title=data.title, description=data.description,
                 start_time=datetime.fromisoformat(data.start_time),
                 end_time=datetime.fromisoformat(data.end_time) if data.end_time else None,
                 location=data.location, event_type=data.event_type)
    db.add(s); await db.commit(); await db.refresh(s)
    return {"status": "ok", "id": s.id}

@sizheng_app.put("/schedules/{sched_id}")
async def update_schedule(sched_id: int, data: SchedUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = await db.get(Schedule, sched_id)
    if not s: return {"error": "不存在"}
    for f in ["title", "description", "location", "event_type"]:
        v = getattr(data, f, None)
        if v is not None: setattr(s, f, v)
    if data.start_time: s.start_time = datetime.fromisoformat(data.start_time)
    if data.end_time: s.end_time = datetime.fromisoformat(data.end_time)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/schedules/{sched_id}")
async def delete_schedule(sched_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = await db.get(Schedule, sched_id)
    if not s: return {"error": "不存在"}
    await db.delete(s); await db.commit()
    return {"status": "ok"}


# ── 干部管理 ─────────────────────────────────────

CADRE_ROLES = ["支部书记", "支委委员", "干部"]

@sizheng_app.get("/cadres")
async def list_cadres(search: str = "", branch_id: int = 0, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Member).where(Member.role.in_(CADRE_ROLES))
    if search:
        q = q.where((Member.name.ilike(f"%{search}%")) | (Member.student_id.ilike(f"%{search}%")))
    if branch_id:
        q = q.where(Member.branch_id == branch_id)
    q = q.order_by(Member.role, Member.name)
    rows = (await db.execute(q)).scalars().all()
    return [{
        "id": m.id, "name": m.name, "student_id": m.student_id, "gender": m.gender,
        "role": m.role, "position": m.position, "branch_id": m.branch_id,
        "branch_name": m.branch.name if m.branch else None,
        "phone": m.phone, "party_status": m.party_status,
        "appointment_date": m.appointment_date.isoformat() if m.appointment_date else None,
    } for m in rows]


# ── 党员联系 ─────────────────────────────────────

class ContactCreate(BaseModel):
    member_id: int
    contact_name: str
    contact_phone: str = ""
    contact_type: str = "群众"
    notes: str = ""

class ContactUpdate(BaseModel):
    contact_name: str | None = None
    contact_phone: str | None = None
    contact_type: str | None = None
    notes: str | None = None

@sizheng_app.get("/contacts")
async def list_contacts(search: str = "", member_id: int = 0, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(MemberContact)
    if search:
        q = q.where(MemberContact.contact_name.ilike(f"%{search}%"))
    if member_id:
        q = q.where(MemberContact.member_id == member_id)
    q = q.order_by(MemberContact.created_at.desc())
    rows = (await db.execute(q)).scalars().all()
    # get member names
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m.name for m in ms}
    return [{
        "id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "contact_name": r.contact_name, "contact_phone": r.contact_phone,
        "contact_type": r.contact_type, "notes": r.notes,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    } for r in rows]

@sizheng_app.post("/contacts")
async def create_contact(req: ContactCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = MemberContact(
        member_id=req.member_id, contact_name=req.contact_name,
        contact_phone=req.contact_phone or None, contact_type=req.contact_type,
        notes=req.notes or None,
    )
    db.add(c); await db.commit(); await db.refresh(c)
    return {"id": c.id, "contact_name": c.contact_name}

@sizheng_app.put("/contacts/{contact_id}")
async def update_contact(contact_id: int, req: ContactUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = await db.get(MemberContact, contact_id)
    if not c: return {"error": "不存在"}
    for field in ["contact_name", "contact_phone", "contact_type", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(c, field, v)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/contacts/{contact_id}")
async def delete_contact(contact_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    c = await db.get(MemberContact, contact_id)
    if not c: return {"error": "不存在"}
    await db.delete(c); await db.commit()
    return {"status": "ok"}


# ── 党费收缴 ─────────────────────────────────────

class DuesCreate(BaseModel):
    member_id: int
    year: int
    month: int
    amount: float = 0
    status: str = "未缴"
    paid_date: str = ""
    notes: str = ""

class DuesUpdate(BaseModel):
    amount: float | None = None
    status: str | None = None
    paid_date: str | None = None
    notes: str | None = None

@sizheng_app.get("/dues")
async def list_dues(year: int = 0, month: int = 0, search: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Dues)
    if year: q = q.where(Dues.year == year)
    if month: q = q.where(Dues.month == month)
    q = q.order_by(Dues.year.desc(), Dues.month.desc())
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m.name for m in ms}
    result = [{"id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "year": r.year, "month": r.month, "amount": r.amount, "status": r.status,
        "paid_date": r.paid_date.isoformat() if r.paid_date else None, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"]]
    return result

@sizheng_app.post("/dues")
async def create_dues(req: DuesCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = Dues(member_id=req.member_id, year=req.year, month=req.month, amount=req.amount,
        status=req.status, paid_date=datetime.strptime(req.paid_date, "%Y-%m-%d").date() if req.paid_date else None,
        notes=req.notes or None)
    db.add(d); await db.commit(); await db.refresh(d)
    return {"id": d.id}

@sizheng_app.put("/dues/{dues_id}")
async def update_dues(dues_id: int, req: DuesUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(Dues, dues_id)
    if not d: return {"error": "不存在"}
    if req.amount is not None: d.amount = req.amount
    if req.status is not None: d.status = req.status
    if req.paid_date is not None: d.paid_date = datetime.strptime(req.paid_date, "%Y-%m-%d").date() if req.paid_date else None
    if req.notes is not None: d.notes = req.notes
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/dues/{dues_id}")
async def delete_dues(dues_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(Dues, dues_id)
    if not d: return {"error": "不存在"}
    await db.delete(d); await db.commit()
    return {"status": "ok"}


# ── 党费智能导入 ─────────────────────────────────

class DuesImportConfirm(BaseModel):
    records: list[dict]


@sizheng_app.post("/dues/import")
async def import_dues_preview(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """AI 解析党费 Excel，返回预览数据"""
    from openpyxl import load_workbook
    from io import BytesIO
    import difflib

    # 读取 Excel
    raw = await file.read()
    wb = load_workbook(BytesIO(raw), data_only=True)
    ws = wb.active
    rows = [[str(c.value).strip() if c.value is not None else "" for c in row] for row in ws.iter_rows()]
    if len(rows) < 2:
        return {"status": "error", "message": "表格至少需要表头 + 一行数据"}

    headers = rows[0]
    data_rows = rows[1:]

    # 取前 5 行作为 AI 分析的样本
    sample = data_rows[:min(5, len(data_rows))]

    # 构建 AI prompt
    prompt = f"""你是一个数据处理助手。分析以下党费收缴表格的结构。

表头: {json.dumps(headers, ensure_ascii=False)}
样本数据（前5行）:
{json.dumps([dict(zip(headers, s)) for s in sample], ensure_ascii=False)}

请返回 JSON，将原始表头映射到标准字段。标准字段名: member_name(姓名), year(年份), month(月份), amount(金额), status(状态), paid_date(缴费日期), notes(备注)。

识别规则:
- 状态列的值如"已缴/未缴/减免" → status
- 数字且包含"年"或值为2020-2030范围 → year
- 数字且值为1-12范围 → month
- 金额数字（带"元"或小数）→ amount
- 日期格式 → paid_date
- 长的文本 → notes

只返回 JSON，不要其他文字: {{"映射": {{"原表头1": "标准字段1", ...}}, "置信度": "high/medium/low"}}"""

    try:
        ai_resp = requests.post(
            f"{DIFY_API_URL}/chat-messages",
            headers={"Authorization": f"Bearer {DIFY_API_KEY}", "Content-Type": "application/json"},
            json={"inputs": {}, "query": prompt, "response_mode": "blocking", "user": f"admin-{admin.id}"},
            timeout=60,
        )
        ai_resp.raise_for_status()
        ai_data = ai_resp.json()
        ai_answer = ai_data.get("answer", "{}")
        ai_answer = re.sub(r"<think>.*?</think>", "", ai_answer, flags=re.DOTALL).strip()
        # 提取 JSON
        json_match = re.search(r'\{[\s\S]*\}', ai_answer)
        mapping = json.loads(json_match.group()) if json_match else {}
        field_map = mapping.get("映射", {})
        confidence = mapping.get("置信度", "medium")
    except Exception as e:
        # AI 解析失败时用内置规则兜底
        field_map = auto_detect_dues_columns(headers)
        confidence = "low"

    # 用映射解析所有行
    parsed = []
    for dr in data_rows:
        record = {}
        for i, h in enumerate(headers):
            std_field = field_map.get(h)
            if std_field and i < len(dr):
                record[std_field] = dr[i]
        if record.get("member_name"):
            parsed.append(record)

    # 模糊匹配党员姓名
    members = (await db.execute(select(Member.id, Member.name, Member.student_id, Member.branch_id))).all()
    member_list = [{"id": m[0], "name": m[1], "student_id": m[2] or "", "branch_id": m[3]} for m in members]

    preview = []
    for rec in parsed:
        raw_name = rec.get("member_name", "").replace(" ", "").replace("　", "")
        # 精确匹配
        match = None
        match_score = 0
        for m in member_list:
            if m["name"] == raw_name:
                match = m
                match_score = 100
                break
        # 模糊匹配
        if not match:
            best = 0
            best_m = None
            for m in member_list:
                score = difflib.SequenceMatcher(None, raw_name, m["name"]).ratio()
                if score > best:
                    best = score
                    best_m = m
            if best >= 0.6:
                match = best_m
                match_score = int(best * 100)

        preview.append({
            **rec,
            "member_id": match["id"] if match else None,
            "member_name": raw_name,
            "matched_name": match["name"] if match else None,
            "match_score": match_score,
            "student_id": match["student_id"] if match else "",
        })

    return {
        "status": "ok",
        "preview": preview,
        "confidence": confidence,
        "total": len(preview),
        "headers": headers,
        "field_map": field_map,
    }


@sizheng_app.post("/dues/import/confirm")
async def import_dues_confirm(
    req: DuesImportConfirm,
    admin: AdminUser = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """确认导入党费记录"""
    created, skipped = 0, 0
    for rec in req.records:
        member_id = rec.get("member_id")
        year = rec.get("year")
        month = rec.get("month")
        if not member_id or not year or not month:
            skipped += 1
            continue
        # 检查重复（同一党员同年同月只保留一条）
        exist = (await db.execute(
            select(Dues).where(
                Dues.member_id == int(member_id),
                Dues.year == int(year),
                Dues.month == int(month),
            )
        )).scalar()
        if exist:
            skipped += 1
            continue

        try:
            amount = float(rec.get("amount", 0)) if rec.get("amount") else 0
        except (ValueError, TypeError):
            amount = 0

        paid_date = None
        raw_date = rec.get("paid_date", "")
        if raw_date:
            for fmt in ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y年%m月%d日"]:
                try:
                    paid_date = datetime.strptime(str(raw_date), fmt).date()
                    break
                except: pass

        db.add(Dues(
            member_id=int(member_id),
            year=int(year),
            month=int(month),
            amount=amount,
            status=rec.get("status", "未缴"),
            paid_date=paid_date,
            notes=str(rec.get("notes", "")) if rec.get("notes") else None,
        ))
        created += 1

    await db.commit()
    return {"status": "ok", "created": created, "skipped": skipped}


def auto_detect_dues_columns(headers: list[str]) -> dict:
    """内置规则兜底：根据表头关键词自动映射"""
    KEYWORDS = {
        "member_name": ["姓名", "党员姓名", "名称", "党员", "名字"],
        "year": ["年份", "年", "年度"],
        "month": ["月份", "月"],
        "amount": ["金额", "党费", "数额", "元", "缴费金额"],
        "status": ["状态", "是否已缴", "缴费状态"],
        "paid_date": ["缴费日期", "日期", "缴纳日期", "付款日期"],
        "notes": ["备注", "说明", "注"],
    }
    result = {}
    for h in headers:
        h_clean = h.strip().lower()
        for field, kws in KEYWORDS.items():
            if any(kw in h_clean or kw in h for kw in kws):
                result[h] = field
                break
    return result


# ── 困难党员帮扶 ─────────────────────────────────

class AssistanceCreate(BaseModel):
    member_id: int
    assistance_type: str
    amount: float = 0
    reason: str = ""
    date: str
    status: str = "已完成"
    notes: str = ""

class AssistanceUpdate(BaseModel):
    assistance_type: str | None = None
    amount: float | None = None
    reason: str | None = None
    date: str | None = None
    status: str | None = None
    notes: str | None = None

@sizheng_app.get("/assistance")
async def list_assistance(search: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Assistance).order_by(Assistance.date.desc())
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m.name for m in ms}
    result = [{"id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "assistance_type": r.assistance_type, "amount": r.amount, "reason": r.reason,
        "date": r.date.isoformat() if r.date else None, "status": r.status, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"] or search in r["assistance_type"]]
    return result

@sizheng_app.post("/assistance")
async def create_assistance(req: AssistanceCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = Assistance(member_id=req.member_id, assistance_type=req.assistance_type,
        amount=req.amount, reason=req.reason or None,
        date=datetime.strptime(req.date, "%Y-%m-%d").date(), status=req.status, notes=req.notes or None)
    db.add(a); await db.commit(); await db.refresh(a)
    return {"id": a.id}

@sizheng_app.put("/assistance/{aid}")
async def update_assistance(aid: int, req: AssistanceUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(Assistance, aid)
    if not a: return {"error": "不存在"}
    for field in ["assistance_type", "status"]:
        v = getattr(req, field, None)
        if v is not None: setattr(a, field, v)
    if req.amount is not None: a.amount = req.amount
    if req.reason is not None: a.reason = req.reason
    if req.date is not None: a.date = datetime.strptime(req.date, "%Y-%m-%d").date() if req.date else None
    if req.notes is not None: a.notes = req.notes
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/assistance/{aid}")
async def delete_assistance(aid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(Assistance, aid)
    if not a: return {"error": "不存在"}
    await db.delete(a); await db.commit()
    return {"status": "ok"}


# ── 志愿服务记录 ─────────────────────────────────

class VolunteerCreate(BaseModel):
    member_id: int
    activity_name: str
    hours: float = 0
    date: str
    description: str = ""
    notes: str = ""

class VolunteerUpdate(BaseModel):
    activity_name: str | None = None
    hours: float | None = None
    date: str | None = None
    description: str | None = None
    notes: str | None = None

@sizheng_app.get("/volunteers")
async def list_volunteers(search: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Volunteer).order_by(Volunteer.date.desc())
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m.name for m in ms}
    result = [{"id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "activity_name": r.activity_name, "hours": r.hours,
        "date": r.date.isoformat() if r.date else None, "description": r.description, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["activity_name"] or search in r["member_name"]]
    return result

@sizheng_app.post("/volunteers")
async def create_volunteer(req: VolunteerCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    v = Volunteer(member_id=req.member_id, activity_name=req.activity_name, hours=req.hours,
        date=datetime.strptime(req.date, "%Y-%m-%d").date(), description=req.description or None, notes=req.notes or None)
    db.add(v); await db.commit(); await db.refresh(v)
    return {"id": v.id}

@sizheng_app.put("/volunteers/{vid}")
async def update_volunteer(vid: int, req: VolunteerUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    v = await db.get(Volunteer, vid)
    if not v: return {"error": "不存在"}
    for field in ["activity_name", "description", "notes"]:
        val = getattr(req, field, None)
        if val is not None: setattr(v, field, val)
    if req.hours is not None: v.hours = req.hours
    if req.date is not None: v.date = datetime.strptime(req.date, "%Y-%m-%d").date() if req.date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/volunteers/{vid}")
async def delete_volunteer(vid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    v = await db.get(Volunteer, vid)
    if not v: return {"error": "不存在"}
    await db.delete(v); await db.commit()
    return {"status": "ok"}


# ── 管理员鉴权路由 ─────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class AdminPasswordChange(BaseModel):
    old_password: str | None = None
    new_password: str

@sizheng_app.post("/admin/login")
async def admin_login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    """管理员登录"""
    user = (await db.execute(
        select(AdminUser).where(AdminUser.username == req.username, AdminUser.is_active == True)
    )).scalar()
    if not user:
        return {"status": "error", "message": "账号不存在或已禁用"}
    hashed = hashlib.pbkdf2_hmac("sha256", req.password.encode(), user.username.encode(), 100000).hex()
    if hashed != user.password_hash:
        return {"status": "error", "message": "密码错误"}
    token = create_admin_token(user.id)
    # 记操作日志
    log = OperationLog(admin_user_id=user.id, username=user.username, action="登录",
        target_type="admin_user", target_id=user.id, detail="登录系统")
    db.add(log)
    await db.commit()
    return {"status": "ok", "token": token, "user": {"id": user.id, "username": user.username,
        "real_name": user.real_name, "role": user.role}}

@sizheng_app.get("/admin/me")
async def admin_me(admin: AdminUser = Depends(get_current_admin)):
    return {"id": admin.id, "username": admin.username, "real_name": admin.real_name,
        "role": admin.role, "phone": admin.phone}

@sizheng_app.post("/admin/change-password")
async def admin_change_password(req: AdminPasswordChange, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    admin.password_hash = hashlib.pbkdf2_hmac("sha256", req.new_password.encode(), admin.username.encode(), 100000).hex()
    await db.commit()
    return {"status": "ok"}


# ── 管理员用户管理 ─────────────────────────────────

class AdminUserCreate(BaseModel):
    username: str
    password: str
    real_name: str
    phone: str = ""
    role: str = "普通管理员"

class AdminUserUpdate(BaseModel):
    real_name: str | None = None
    phone: str | None = None
    role: str | None = None
    is_active: bool | None = None
    password: str | None = None

@sizheng_app.get("/admin-users")
async def list_admin_users(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AdminUser).order_by(AdminUser.id))).scalars().all()
    return [{"id": r.id, "username": r.username, "real_name": r.real_name, "phone": r.phone,
        "role": r.role, "is_active": r.is_active, "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows]

@sizheng_app.post("/admin-users")
async def create_admin_user(req: AdminUserCreate, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    exist = (await db.execute(select(AdminUser).where(AdminUser.username == req.username))).scalar()
    if exist:
        return {"status": "error", "message": "用户名已存在"}
    h = hashlib.pbkdf2_hmac("sha256", req.password.encode(), req.username.encode(), 100000).hex()
    u = AdminUser(username=req.username, password_hash=h, real_name=req.real_name,
        phone=req.phone or None, role=req.role)
    db.add(u); await db.commit(); await db.refresh(u)
    # log
    log = OperationLog(admin_user_id=admin.id, username=admin.username, action="创建",
        target_type="admin_user", target_id=u.id, detail=f"创建管理员 {u.username}")
    db.add(log); await db.commit()
    return {"id": u.id}

@sizheng_app.put("/admin-users/{uid}")
async def update_admin_user(uid: int, req: AdminUserUpdate, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    u = await db.get(AdminUser, uid)
    if not u: return {"error": "不存在"}
    changed = []
    if req.real_name is not None: u.real_name = req.real_name; changed.append("姓名")
    if req.phone is not None: u.phone = req.phone
    if req.role is not None: u.role = req.role; changed.append(f"角色→{req.role}")
    if req.is_active is not None: u.is_active = req.is_active; changed.append("启用" if req.is_active else "禁用")
    if req.password:
        u.password_hash = hashlib.pbkdf2_hmac("sha256", req.password.encode(), u.username.encode(), 100000).hex()
        changed.append("密码")
    await db.commit()
    if changed:
        log = OperationLog(admin_user_id=admin.id, username=admin.username, action="更新",
            target_type="admin_user", target_id=u.id, detail=f"修改 {u.username}: {', '.join(changed)}")
        db.add(log); await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/admin-users/{uid}")
async def delete_admin_user(uid: int, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    u = await db.get(AdminUser, uid)
    if not u: return {"error": "不存在"}
    if u.id == admin.id: return {"status": "error", "message": "不能删除自己"}
    await db.delete(u)
    log = OperationLog(admin_user_id=admin.id, username=admin.username, action="删除",
        target_type="admin_user", target_id=uid, detail=f"删除管理员 {u.username}")
    db.add(log); await db.commit()
    return {"status": "ok"}


# ── 操作日志 ─────────────────────────────────────

@sizheng_app.get("/operation-logs")
async def list_operation_logs(page: int = 1, page_size: int = 30, admin_user_id: int = 0, action: str = "",
    admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(OperationLog).order_by(OperationLog.id.desc())
    if admin_user_id: q = q.where(OperationLog.admin_user_id == admin_user_id)
    if action: q = q.where(OperationLog.action == action)
    total = (await db.execute(select(func.count()).select_from(q.subquery()))).scalar()
    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()
    return {"list": [{"id": r.id, "admin_user_id": r.admin_user_id, "username": r.username,
        "action": r.action, "target_type": r.target_type, "target_id": r.target_id,
        "detail": r.detail, "ip_address": r.ip_address, "is_read": r.is_read,
        "created_at": r.created_at.isoformat() if r.created_at else None} for r in rows],
        "total": total}

@sizheng_app.get("/operation-logs/unread-count")
async def unread_count(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    cnt = (await db.execute(select(func.count()).select_from(OperationLog).where(OperationLog.is_read == False))).scalar()
    return {"count": cnt}

@sizheng_app.post("/operation-logs/{log_id}/read")
async def mark_log_read(log_id: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    log = await db.get(OperationLog, log_id)
    if log: log.is_read = True; await db.commit()
    return {"status": "ok"}

@sizheng_app.post("/operation-logs/read-all")
async def mark_all_read(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    logs = (await db.execute(select(OperationLog).where(OperationLog.is_read == False))).scalars().all()
    for log in logs: log.is_read = True
    await db.commit()
    return {"status": "ok"}


# ── 系统配置 ─────────────────────────────────────

class ConfigUpsert(BaseModel):
    config_key: str
    config_value: str = ""
    description: str = ""

@sizheng_app.get("/system-configs")
async def list_system_configs(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SystemConfig).order_by(SystemConfig.config_key))).scalars().all()
    result = {}
    for r in rows:
        result[r.config_key] = {"id": r.id, "value": r.config_value, "description": r.description}
    return result

@sizheng_app.post("/system-configs")
async def save_system_config(req: ConfigUpsert, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    existing = (await db.execute(select(SystemConfig).where(SystemConfig.config_key == req.config_key))).scalar()
    if existing:
        existing.config_value = req.config_value
        existing.description = req.description or None
        existing.updated_at = beijing_now()
    else:
        cfg = SystemConfig(config_key=req.config_key, config_value=req.config_value,
            description=req.description or None)
        db.add(cfg)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/system-configs/{config_id}")
async def delete_system_config(config_id: int, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    c = await db.get(SystemConfig, config_id)
    if not c: return {"error": "不存在"}
    await db.delete(c); await db.commit()
    return {"status": "ok"}


# ── 数据字典 ─────────────────────────────────────

class DictCreate(BaseModel):
    dict_type: str
    dict_key: str
    dict_value: str
    sort_order: int = 0
    description: str = ""

class DictUpdate(BaseModel):
    dict_key: str | None = None
    dict_value: str | None = None
    sort_order: int | None = None
    description: str | None = None
    is_active: bool | None = None

@sizheng_app.get("/data-dicts")
async def list_data_dicts(dict_type: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(DataDict).order_by(DataDict.dict_type, DataDict.sort_order)
    if dict_type: q = q.where(DataDict.dict_type == dict_type)
    rows = (await db.execute(q)).scalars().all()
    result = {}
    for r in rows:
        if r.dict_type not in result: result[r.dict_type] = []
        result[r.dict_type].append({"id": r.id, "dict_key": r.dict_key, "dict_value": r.dict_value,
            "sort_order": r.sort_order, "description": r.description, "is_active": r.is_active})
    return result

@sizheng_app.post("/data-dicts")
async def create_data_dict(req: DictCreate, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    d = DataDict(dict_type=req.dict_type, dict_key=req.dict_key, dict_value=req.dict_value,
        sort_order=req.sort_order, description=req.description or None)
    db.add(d); await db.commit(); await db.refresh(d)
    return {"id": d.id}

@sizheng_app.put("/data-dicts/{did}")
async def update_data_dict(did: int, req: DictUpdate, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DataDict, did)
    if not d: return {"error": "不存在"}
    for field in ["dict_key", "dict_value", "description"]:
        v = getattr(req, field, None)
        if v is not None: setattr(d, field, v)
    if req.sort_order is not None: d.sort_order = req.sort_order
    if req.is_active is not None: d.is_active = req.is_active
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/data-dicts/{did}")
async def delete_data_dict(did: int, admin: AdminUser = Depends(require_super_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DataDict, did)
    if not d: return {"error": "不存在"}
    await db.delete(d); await db.commit()
    return {"status": "ok"}


# ── 监督中心 · 党风党纪学习 ──────────────────────────

class DisciplineCreate(BaseModel):
    title: str
    study_date: str
    content: str = ""
    attendees: str = ""
    organizer: str = ""
    notes: str = ""

class DisciplineUpdate(BaseModel):
    title: str | None = None
    study_date: str | None = None
    content: str | None = None
    attendees: str | None = None
    organizer: str | None = None
    notes: str | None = None

@sizheng_app.get("/supervision/discipline-study")
async def list_discipline(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(DisciplineStudy).order_by(DisciplineStudy.study_date.desc()))).scalars().all()
    return [{"id": r.id, "title": r.title, "study_date": r.study_date.isoformat() if r.study_date else None,
        "content": r.content, "attendees": r.attendees, "organizer": r.organizer, "notes": r.notes} for r in rows]

@sizheng_app.post("/supervision/discipline-study")
async def create_discipline(req: DisciplineCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = DisciplineStudy(title=req.title, study_date=datetime.strptime(req.study_date, "%Y-%m-%d").date(),
        content=req.content or None, attendees=req.attendees or None, organizer=req.organizer or None, notes=req.notes or None)
    db.add(d); await db.commit(); await db.refresh(d)
    return {"id": d.id}

@sizheng_app.put("/supervision/discipline-study/{did}")
async def update_discipline(did: int, req: DisciplineUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DisciplineStudy, did)
    if not d: return {"error": "不存在"}
    for field in ["title", "content", "attendees", "organizer", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(d, field, v)
    if req.study_date is not None: d.study_date = datetime.strptime(req.study_date, "%Y-%m-%d").date()
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/supervision/discipline-study/{did}")
async def delete_discipline(did: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DisciplineStudy, did)
    if not d: return {"error": "不存在"}
    await db.delete(d); await db.commit()
    return {"status": "ok"}


# ── 监督中心 · 廉政警示教育 ──────────────────────────

WARNING_TYPES = ["案例通报", "观看专题片", "现场教育", "其他"]

class WarningCreate(BaseModel):
    title: str
    edu_date: str
    edu_type: str = "案例通报"
    content: str = ""
    attendees: str = ""
    organizer: str = ""
    notes: str = ""

class WarningUpdate(BaseModel):
    title: str | None = None
    edu_date: str | None = None
    edu_type: str | None = None
    content: str | None = None
    attendees: str | None = None
    organizer: str | None = None
    notes: str | None = None

@sizheng_app.get("/supervision/warning-edu")
async def list_warning(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(WarningEdu).order_by(WarningEdu.edu_date.desc()))).scalars().all()
    return [{"id": r.id, "title": r.title, "edu_date": r.edu_date.isoformat() if r.edu_date else None,
        "edu_type": r.edu_type, "content": r.content, "attendees": r.attendees,
        "organizer": r.organizer, "notes": r.notes} for r in rows]

@sizheng_app.post("/supervision/warning-edu")
async def create_warning(req: WarningCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    w = WarningEdu(title=req.title, edu_date=datetime.strptime(req.edu_date, "%Y-%m-%d").date(),
        edu_type=req.edu_type, content=req.content or None, attendees=req.attendees or None,
        organizer=req.organizer or None, notes=req.notes or None)
    db.add(w); await db.commit(); await db.refresh(w)
    return {"id": w.id}

@sizheng_app.put("/supervision/warning-edu/{wid}")
async def update_warning(wid: int, req: WarningUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    w = await db.get(WarningEdu, wid)
    if not w: return {"error": "不存在"}
    for field in ["title", "edu_type", "content", "attendees", "organizer", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(w, field, v)
    if req.edu_date is not None: w.edu_date = datetime.strptime(req.edu_date, "%Y-%m-%d").date()
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/supervision/warning-edu/{wid}")
async def delete_warning(wid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    w = await db.get(WarningEdu, wid)
    if not w: return {"error": "不存在"}
    await db.delete(w); await db.commit()
    return {"status": "ok"}


# ── 监督中心 · 监督检查记录 ──────────────────────────

RECTIFICATION_STATUS = ["待整改", "整改中", "已完成"]

class InspectionCreate(BaseModel):
    inspect_date: str
    inspector: str
    scope: str = ""
    finding: str = ""
    rectification_status: str = "待整改"
    rectification_notes: str = ""

class InspectionUpdate(BaseModel):
    inspect_date: str | None = None
    inspector: str | None = None
    scope: str | None = None
    finding: str | None = None
    rectification_status: str | None = None
    rectification_notes: str | None = None

@sizheng_app.get("/supervision/inspection")
async def list_inspection(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Inspection).order_by(Inspection.inspect_date.desc()))).scalars().all()
    return [{"id": r.id, "inspect_date": r.inspect_date.isoformat() if r.inspect_date else None,
        "inspector": r.inspector, "scope": r.scope, "finding": r.finding,
        "rectification_status": r.rectification_status, "rectification_notes": r.rectification_notes} for r in rows]

@sizheng_app.post("/supervision/inspection")
async def create_inspection(req: InspectionCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    insp = Inspection(inspect_date=datetime.strptime(req.inspect_date, "%Y-%m-%d").date(),
        inspector=req.inspector, scope=req.scope or None, finding=req.finding or None,
        rectification_status=req.rectification_status, rectification_notes=req.rectification_notes or None)
    db.add(insp); await db.commit(); await db.refresh(insp)
    return {"id": insp.id}

@sizheng_app.put("/supervision/inspection/{iid}")
async def update_inspection(iid: int, req: InspectionUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    insp = await db.get(Inspection, iid)
    if not insp: return {"error": "不存在"}
    for field in ["inspector", "scope", "finding", "rectification_status", "rectification_notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(insp, field, v)
    if req.inspect_date is not None: insp.inspect_date = datetime.strptime(req.inspect_date, "%Y-%m-%d").date()
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/supervision/inspection/{iid}")
async def delete_inspection(iid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    insp = await db.get(Inspection, iid)
    if not insp: return {"error": "不存在"}
    await db.delete(insp); await db.commit()
    return {"status": "ok"}


# ── 仪表盘统计 ─────────────────────────────────────

@sizheng_app.get("/dashboard/stats")
async def dashboard_stats(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    this_month = now.month
    this_year = now.year

    # 党员统计
    total_members = (await db.execute(select(func.count()).select_from(Member))).scalar() or 0
    total_branches = (await db.execute(select(func.count()).select_from(Branch))).scalar() or 0

    def _dist(rows):
        return [{"name": k or "未知", "value": c} for k, c in rows if k]

    # 各维度分布
    status_dist = _dist((await db.execute(
        select(Member.party_status, func.count()).group_by(Member.party_status)
    )).all())

    role_dist = _dist((await db.execute(
        select(Member.role, func.count()).group_by(Member.role)
    )).all())

    gender_dist = _dist((await db.execute(
        select(Member.gender, func.count()).group_by(Member.gender)
    )).all())

    education_dist = _dist((await db.execute(
        select(Member.education, func.count()).group_by(Member.education)
    )).all())

    ethnicity_dist = _dist((await db.execute(
        select(Member.ethnicity, func.count()).group_by(Member.ethnicity)
    )).all())

    title_dist = _dist((await db.execute(
        select(Member.title, func.count()).group_by(Member.title)
    )).all())

    student_status_dist = _dist((await db.execute(
        select(Member.student_status, func.count()).group_by(Member.student_status)
    )).all())

    # 年龄分布（按出生年份分桶）
    age_rows = (await db.execute(
        select(Member.birth_date).where(Member.birth_date.isnot(None))
    )).scalars().all()
    age_buckets = {"25岁以下": 0, "26-35岁": 0, "36-45岁": 0, "46-55岁": 0, "56岁以上": 0}
    for bd in age_rows:
        if bd is None: continue
        age = this_year - bd.year
        if age <= 25: age_buckets["25岁以下"] += 1
        elif age <= 35: age_buckets["26-35岁"] += 1
        elif age <= 45: age_buckets["36-45岁"] += 1
        elif age <= 55: age_buckets["46-55岁"] += 1
        else: age_buckets["56岁以上"] += 1
    age_dist = [{"name": k, "value": v} for k, v in age_buckets.items()]

    # 本月会议数
    month_meetings = (await db.execute(
        select(func.count()).select_from(Meeting).where(
            func.date_part('year', Meeting.meeting_date) == this_year,
            func.date_part('month', Meeting.meeting_date) == this_month,
        )
    )).scalar() or 0

    # 党费收缴率（本月）
    month_dues_should = (await db.execute(
        select(func.count()).select_from(Dues).where(Dues.year == this_year, Dues.month == this_month)
    )).scalar() or 0
    month_dues_paid = (await db.execute(
        select(func.count()).select_from(Dues).where(Dues.year == this_year, Dues.month == this_month, Dues.status == "已缴")
    )).scalar() or 0
    dues_rate = round(month_dues_paid / month_dues_should * 100, 1) if month_dues_should > 0 else 0

    # 近 6 月会议趋势
    trend = []
    for i in range(5, -1, -1):
        m = now.month - i
        y = this_year
        if m <= 0:
            m += 12
            y -= 1
        cnt = (await db.execute(
            select(func.count()).select_from(Meeting).where(
                func.date_part('year', Meeting.meeting_date) == y,
                func.date_part('month', Meeting.meeting_date) == m,
            )
        )).scalar() or 0
        trend.append({"month": f"{y}-{m:02d}", "count": cnt})

    # 会议类型分布
    meeting_type_dist = _dist((await db.execute(
        select(Meeting.meeting_type, func.count()).group_by(Meeting.meeting_type)
    )).all())

    # 最近操作
    recent_logs = (await db.execute(
        select(OperationLog).order_by(OperationLog.id.desc()).limit(8)
    )).scalars().all()
    activity = [{"id": r.id, "username": r.username, "action": r.action,
        "detail": r.detail, "created_at": r.created_at.isoformat() if r.created_at else None} for r in recent_logs]

    return {
        "total_members": total_members,
        "total_branches": total_branches,
        "month_meetings": month_meetings,
        "dues_rate": dues_rate,
        "status_distribution": status_dist,
        "role_distribution": role_dist,
        "gender_distribution": gender_dist,
        "education_distribution": education_dist,
        "ethnicity_distribution": ethnicity_dist,
        "title_distribution": title_dist,
        "student_status_distribution": student_status_dist,
        "age_distribution": age_dist,
        "meeting_trend": trend,
        "meeting_type_distribution": meeting_type_dist,
        "recent_activity": activity,
    }


# ── 组织关系转接 ─────────────────────────────────────

TRANSFER_TYPES = ["系统内", "省内跨党委", "省外"]
TRANSFER_STATUS = ["办理中", "已完成", "已退回"]

class TransferCreate(BaseModel):
    member_id: int
    from_branch: str
    to_branch: str
    transfer_type: str = "系统内"
    status: str = "办理中"
    letter_number: str = ""
    apply_date: str
    complete_date: str = ""
    notes: str = ""

class TransferUpdate(BaseModel):
    from_branch: str | None = None
    to_branch: str | None = None
    transfer_type: str | None = None
    status: str | None = None
    letter_number: str | None = None
    complete_date: str | None = None
    notes: str | None = None

@sizheng_app.get("/transfers")
async def list_transfers(search: str = "", status: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(PartyTransfer).order_by(PartyTransfer.created_at.desc())
    if status: q = q.where(PartyTransfer.status == status)
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name, Member.student_id).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m for m in ms}
    result = [{"id": r.id, "member_id": r.member_id,
        "member_name": member_map[r.member_id].name if r.member_id in member_map else "",
        "student_id": member_map[r.member_id].student_id if r.member_id in member_map else "",
        "from_branch": r.from_branch, "to_branch": r.to_branch,
        "transfer_type": r.transfer_type, "status": r.status,
        "letter_number": r.letter_number,
        "apply_date": r.apply_date.isoformat() if r.apply_date else None,
        "complete_date": r.complete_date.isoformat() if r.complete_date else None,
        "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"] or search in r["student_id"]]
    return result

@sizheng_app.post("/transfers")
async def create_transfer(req: TransferCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = PartyTransfer(member_id=req.member_id, from_branch=req.from_branch,
        to_branch=req.to_branch, transfer_type=req.transfer_type, status=req.status,
        letter_number=req.letter_number or None,
        apply_date=datetime.strptime(req.apply_date, "%Y-%m-%d").date(),
        complete_date=datetime.strptime(req.complete_date, "%Y-%m-%d").date() if req.complete_date else None,
        notes=req.notes or None)
    db.add(t); await db.commit(); await db.refresh(t)
    return {"id": t.id}

@sizheng_app.put("/transfers/{tid}")
async def update_transfer(tid: int, req: TransferUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = await db.get(PartyTransfer, tid)
    if not t: return {"error": "不存在"}
    for field in ["from_branch", "to_branch", "transfer_type", "status", "letter_number", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(t, field, v)
    if req.complete_date is not None: t.complete_date = datetime.strptime(req.complete_date, "%Y-%m-%d").date() if req.complete_date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/transfers/{tid}")
async def delete_transfer(tid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    t = await db.get(PartyTransfer, tid)
    if not t: return {"error": "不存在"}
    await db.delete(t); await db.commit()
    return {"status": "ok"}


# ── 流动党员管理 ─────────────────────────────────────

FLOAT_TYPES = ["流出", "流入"]
FLOAT_STATUS = ["在流动中", "已返回", "失联"]

class FloatingCreate(BaseModel):
    member_id: int
    float_type: str = "流出"
    destination: str
    depart_date: str
    expected_return_date: str = ""
    certificate_number: str = ""
    status: str = "在流动中"
    contact_record: str = ""
    notes: str = ""

class FloatingUpdate(BaseModel):
    float_type: str | None = None
    destination: str | None = None
    expected_return_date: str | None = None
    certificate_number: str | None = None
    status: str | None = None
    contact_record: str | None = None
    notes: str | None = None

@sizheng_app.get("/floating-members")
async def list_floating(search: str = "", float_type: str = "", status: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(FloatingMember).order_by(FloatingMember.depart_date.desc())
    if float_type: q = q.where(FloatingMember.float_type == float_type)
    if status: q = q.where(FloatingMember.status == status)
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name, Member.student_id).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m for m in ms}
    result = [{"id": r.id, "member_id": r.member_id,
        "member_name": member_map[r.member_id].name if r.member_id in member_map else "",
        "student_id": member_map[r.member_id].student_id if r.member_id in member_map else "",
        "float_type": r.float_type, "destination": r.destination,
        "depart_date": r.depart_date.isoformat() if r.depart_date else None,
        "expected_return_date": r.expected_return_date.isoformat() if r.expected_return_date else None,
        "certificate_number": r.certificate_number,
        "status": r.status, "contact_record": r.contact_record, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"] or search in r["student_id"]]
    return result

@sizheng_app.post("/floating-members")
async def create_floating(req: FloatingCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    f = FloatingMember(member_id=req.member_id, float_type=req.float_type,
        destination=req.destination,
        depart_date=datetime.strptime(req.depart_date, "%Y-%m-%d").date(),
        expected_return_date=datetime.strptime(req.expected_return_date, "%Y-%m-%d").date() if req.expected_return_date else None,
        certificate_number=req.certificate_number or None,
        status=req.status, contact_record=req.contact_record or None, notes=req.notes or None)
    db.add(f); await db.commit(); await db.refresh(f)
    return {"id": f.id}

@sizheng_app.put("/floating-members/{fid}")
async def update_floating(fid: int, req: FloatingUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    f = await db.get(FloatingMember, fid)
    if not f: return {"error": "不存在"}
    for field in ["float_type", "destination", "certificate_number", "status", "contact_record", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(f, field, v)
    if req.expected_return_date is not None: f.expected_return_date = datetime.strptime(req.expected_return_date, "%Y-%m-%d").date() if req.expected_return_date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/floating-members/{fid}")
async def delete_floating(fid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    f = await db.get(FloatingMember, fid)
    if not f: return {"error": "不存在"}
    await db.delete(f); await db.commit()
    return {"status": "ok"}


# ── 制度汇编 ─────────────────────────────────────

REGULATION_CATEGORIES = ["党章", "准则", "条例", "规定", "办法", "细则", "其他"]

class RegulationCreate(BaseModel):
    title: str
    category: str = "条例"
    issuing_authority: str = ""
    publish_date: str = ""
    content: str = ""
    notes: str = ""

class RegulationUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    issuing_authority: str | None = None
    publish_date: str | None = None
    content: str | None = None
    notes: str | None = None

@sizheng_app.get("/regulations")
async def list_regulations(search: str = "", category: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Regulation).order_by(Regulation.category, Regulation.publish_date.desc())
    if category: q = q.where(Regulation.category == category)
    rows = (await db.execute(q)).scalars().all()
    result = [{"id": r.id, "title": r.title, "category": r.category,
        "issuing_authority": r.issuing_authority,
        "publish_date": r.publish_date.isoformat() if r.publish_date else None,
        "content": r.content, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["title"] or search in (r["issuing_authority"] or "")]
    return result

@sizheng_app.post("/regulations")
async def create_regulation(req: RegulationCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    r = Regulation(title=req.title, category=req.category,
        issuing_authority=req.issuing_authority or None,
        publish_date=datetime.strptime(req.publish_date, "%Y-%m-%d").date() if req.publish_date else None,
        content=req.content or None, notes=req.notes or None)
    db.add(r); await db.commit(); await db.refresh(r)
    return {"id": r.id}

@sizheng_app.put("/regulations/{rid}")
async def update_regulation(rid: int, req: RegulationUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    r = await db.get(Regulation, rid)
    if not r: return {"error": "不存在"}
    for field in ["title", "category", "issuing_authority", "content", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(r, field, v)
    if req.publish_date is not None: r.publish_date = datetime.strptime(req.publish_date, "%Y-%m-%d").date() if req.publish_date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/regulations/{rid}")
async def delete_regulation(rid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    r = await db.get(Regulation, rid)
    if not r: return {"error": "不存在"}
    await db.delete(r); await db.commit()
    return {"status": "ok"}


# ── 归档管理 ─────────────────────────────────────

ARCHIVE_STATUS = ["已归档", "已销毁"]

class ArchiveCreate(BaseModel):
    title: str
    archive_date: str
    box_number: str = ""
    storage_location: str = ""
    retention_years: int | None = None
    status: str = "已归档"
    notes: str = ""

class ArchiveUpdate(BaseModel):
    title: str | None = None
    archive_date: str | None = None
    box_number: str | None = None
    storage_location: str | None = None
    retention_years: int | None = None
    status: str | None = None
    notes: str | None = None

@sizheng_app.get("/archives")
async def list_archives(search: str = "", status: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(Archive).order_by(Archive.archive_date.desc())
    if status: q = q.where(Archive.status == status)
    rows = (await db.execute(q)).scalars().all()
    result = [{"id": r.id, "title": r.title,
        "archive_date": r.archive_date.isoformat() if r.archive_date else None,
        "box_number": r.box_number, "storage_location": r.storage_location,
        "retention_years": r.retention_years, "status": r.status, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["title"] or search in (r["box_number"] or "")]
    return result

@sizheng_app.post("/archives")
async def create_archive(req: ArchiveCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = Archive(title=req.title,
        archive_date=datetime.strptime(req.archive_date, "%Y-%m-%d").date(),
        box_number=req.box_number or None,
        storage_location=req.storage_location or None,
        retention_years=req.retention_years,
        status=req.status, notes=req.notes or None)
    db.add(a); await db.commit(); await db.refresh(a)
    return {"id": a.id}

@sizheng_app.put("/archives/{aid}")
async def update_archive(aid: int, req: ArchiveUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(Archive, aid)
    if not a: return {"error": "不存在"}
    for field in ["title", "box_number", "storage_location", "status", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(a, field, v)
    if req.archive_date is not None: a.archive_date = datetime.strptime(req.archive_date, "%Y-%m-%d").date() if req.archive_date else None
    if req.retention_years is not None: a.retention_years = req.retention_years
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/archives/{aid}")
async def delete_archive(aid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(Archive, aid)
    if not a: return {"error": "不存在"}
    await db.delete(a); await db.commit()
    return {"status": "ok"}


# ── 党费票据管理 ─────────────────────────────────────

RECEIPT_STATUS = ["已开具", "已作废"]

class ReceiptCreate(BaseModel):
    member_id: int
    receipt_number: str
    year: int
    month: int
    amount: float = 0
    issue_date: str
    status: str = "已开具"
    notes: str = ""

class ReceiptUpdate(BaseModel):
    receipt_number: str | None = None
    amount: float | None = None
    issue_date: str | None = None
    status: str | None = None
    notes: str | None = None

@sizheng_app.get("/dues-receipts")
async def list_dues_receipts(search: str = "", year: int = 0, month: int = 0, status: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(DuesReceipt).order_by(DuesReceipt.issue_date.desc())
    if year: q = q.where(DuesReceipt.year == year)
    if month: q = q.where(DuesReceipt.month == month)
    if status: q = q.where(DuesReceipt.status == status)
    rows = (await db.execute(q)).scalars().all()
    member_ids = list(set(r.member_id for r in rows))
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(member_ids)))).all()
        member_map = {m.id: m.name for m in ms}
    result = [{"id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "receipt_number": r.receipt_number, "year": r.year, "month": r.month,
        "amount": r.amount, "issue_date": r.issue_date.isoformat() if r.issue_date else None,
        "status": r.status, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"] or search in r["receipt_number"]]
    return result

@sizheng_app.post("/dues-receipts")
async def create_dues_receipt(req: ReceiptCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = DuesReceipt(member_id=req.member_id, receipt_number=req.receipt_number,
        year=req.year, month=req.month, amount=req.amount,
        issue_date=datetime.strptime(req.issue_date, "%Y-%m-%d").date(),
        status=req.status, notes=req.notes or None)
    db.add(d); await db.commit(); await db.refresh(d)
    return {"id": d.id}

@sizheng_app.put("/dues-receipts/{rid}")
async def update_dues_receipt(rid: int, req: ReceiptUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    r = await db.get(DuesReceipt, rid)
    if not r: return {"error": "不存在"}
    for field in ["receipt_number", "status", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(r, field, v)
    if req.amount is not None: r.amount = req.amount
    if req.issue_date is not None: r.issue_date = datetime.strptime(req.issue_date, "%Y-%m-%d").date() if req.issue_date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/dues-receipts/{rid}")
async def delete_dues_receipt(rid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    r = await db.get(DuesReceipt, rid)
    if not r: return {"error": "不存在"}
    await db.delete(r); await db.commit()
    return {"status": "ok"}


# ── 党费使用公示 ─────────────────────────────────────

DUES_PUBLIC_CATEGORIES = ["活动经费", "慰问", "学习材料", "其他"]
DUES_PUBLIC_STATUS = ["公示中", "已结束"]

class DuesPublicCreate(BaseModel):
    title: str
    amount: float = 0
    category: str = "活动经费"
    date: str
    description: str = ""
    status: str = "公示中"
    notes: str = ""

class DuesPublicUpdate(BaseModel):
    title: str | None = None
    amount: float | None = None
    category: str | None = None
    date: str | None = None
    description: str | None = None
    status: str | None = None
    notes: str | None = None

@sizheng_app.get("/dues-public")
async def list_dues_public(search: str = "", category: str = "", status: str = "", admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(DuesPublic).order_by(DuesPublic.date.desc())
    if category: q = q.where(DuesPublic.category == category)
    if status: q = q.where(DuesPublic.status == status)
    rows = (await db.execute(q)).scalars().all()
    result = [{"id": r.id, "title": r.title, "amount": r.amount, "category": r.category,
        "date": r.date.isoformat() if r.date else None, "description": r.description,
        "status": r.status, "notes": r.notes} for r in rows]
    if search:
        result = [r for r in result if search in r["title"]]
    return result

@sizheng_app.post("/dues-public")
async def create_dues_public(req: DuesPublicCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = DuesPublic(title=req.title, amount=req.amount, category=req.category,
        date=datetime.strptime(req.date, "%Y-%m-%d").date(),
        description=req.description or None, status=req.status, notes=req.notes or None)
    db.add(d); await db.commit(); await db.refresh(d)
    return {"id": d.id}

@sizheng_app.put("/dues-public/{did}")
async def update_dues_public(did: int, req: DuesPublicUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DuesPublic, did)
    if not d: return {"error": "不存在"}
    for field in ["title", "category", "description", "status", "notes"]:
        v = getattr(req, field, None)
        if v is not None: setattr(d, field, v)
    if req.amount is not None: d.amount = req.amount
    if req.date is not None: d.date = datetime.strptime(req.date, "%Y-%m-%d").date() if req.date else None
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/dues-public/{did}")
async def delete_dues_public(did: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = await db.get(DuesPublic, did)
    if not d: return {"error": "不存在"}
    await db.delete(d); await db.commit()
    return {"status": "ok"}


# ── 任务完成进度 ─────────────────────────────────────

@sizheng_app.get("/task-progress")
async def task_progress(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    tasks = (await db.execute(select(LearningTask).order_by(LearningTask.created_at.desc()))).scalars().all()
    members = (await db.execute(select(Member.id, Member.name))).all()
    member_map = {m.id: m.name for m in members}
    result = []
    for t in tasks:
        total = (await db.execute(
            select(func.count()).select_from(TaskAssignment).where(TaskAssignment.task_id == t.id)
        )).scalar() or 0
        completed = (await db.execute(
            select(func.count()).select_from(TaskAssignment).where(
                TaskAssignment.task_id == t.id, TaskAssignment.status == "completed"
            )
        )).scalar() or 0
        assignments = (await db.execute(
            select(TaskAssignment).where(TaskAssignment.task_id == t.id)
        )).scalars().all()
        detail = [{"member_id": a.member_id, "member_name": member_map.get(a.member_id, ""),
            "status": a.status, "completed_at": a.completed_at.isoformat() if a.completed_at else None} for a in assignments]
        result.append({
            "id": t.id, "title": t.title, "total_assigned": total, "completed": completed,
            "rate": round(completed / total * 100, 1) if total > 0 else 0,
            "deadline": t.deadline.isoformat() if t.deadline else None,
            "detail": detail,
        })
    return result


# ── 考核指标 ─────────────────────────────────────

INDICATOR_CATEGORIES = ["共性指标", "个性指标"]

class IndicatorCreate(BaseModel):
    name: str
    category: str = "共性指标"
    max_score: int = 100
    year: int
    description: str = ""

class IndicatorUpdate(BaseModel):
    name: str | None = None
    category: str | None = None
    max_score: int | None = None
    description: str | None = None

@sizheng_app.get("/indicators")
async def list_indicators(category: str = "", year: int = 0, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(AssessmentIndicator).order_by(AssessmentIndicator.category, AssessmentIndicator.name)
    if category: q = q.where(AssessmentIndicator.category == category)
    if year: q = q.where(AssessmentIndicator.year == year)
    rows = (await db.execute(q)).scalars().all()
    return [{"id": r.id, "name": r.name, "category": r.category, "max_score": r.max_score,
        "year": r.year, "description": r.description} for r in rows]

@sizheng_app.post("/indicators")
async def create_indicator(req: IndicatorCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    ind = AssessmentIndicator(name=req.name, category=req.category, max_score=req.max_score,
        year=req.year, description=req.description or None)
    db.add(ind); await db.commit(); await db.refresh(ind)
    return {"id": ind.id}

@sizheng_app.put("/indicators/{iid}")
async def update_indicator(iid: int, req: IndicatorUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    ind = await db.get(AssessmentIndicator, iid)
    if not ind: return {"error": "不存在"}
    for field in ["name", "category", "description"]:
        v = getattr(req, field, None)
        if v is not None: setattr(ind, field, v)
    if req.max_score is not None: ind.max_score = req.max_score
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/indicators/{iid}")
async def delete_indicator(iid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    ind = await db.get(AssessmentIndicator, iid)
    if not ind: return {"error": "不存在"}
    await db.delete(ind); await db.commit()
    return {"status": "ok"}


# ── 自评互评 ─────────────────────────────────────

EVAL_TYPES = ["自评", "互评"]

class EvalCreate(BaseModel):
    member_id: int
    eval_type: str = "自评"
    target_member_id: int | None = None
    year: int
    score: int = 0
    comment: str = ""

class EvalUpdate(BaseModel):
    score: int | None = None
    comment: str | None = None

@sizheng_app.get("/evaluations")
async def list_evaluations(search: str = "", eval_type: str = "", year: int = 0, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    q = select(PeerEvaluation).order_by(PeerEvaluation.created_at.desc())
    if eval_type: q = q.where(PeerEvaluation.eval_type == eval_type)
    if year: q = q.where(PeerEvaluation.year == year)
    rows = (await db.execute(q)).scalars().all()
    member_ids = set()
    for r in rows:
        member_ids.add(r.member_id)
        if r.target_member_id: member_ids.add(r.target_member_id)
    member_map = {}
    if member_ids:
        ms = (await db.execute(select(Member.id, Member.name).where(Member.id.in_(list(member_ids))))).all()
        member_map = {m.id: m.name for m in ms}
    result = [{"id": r.id, "member_id": r.member_id, "member_name": member_map.get(r.member_id, ""),
        "eval_type": r.eval_type, "target_member_id": r.target_member_id,
        "target_name": member_map.get(r.target_member_id, "") if r.target_member_id else "",
        "year": r.year, "score": r.score, "comment": r.comment} for r in rows]
    if search:
        result = [r for r in result if search in r["member_name"] or search in r["target_name"]]
    return result

@sizheng_app.post("/evaluations")
async def create_evaluation(req: EvalCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    e = PeerEvaluation(member_id=req.member_id, eval_type=req.eval_type,
        target_member_id=req.target_member_id, year=req.year, score=req.score,
        comment=req.comment or None)
    db.add(e); await db.commit(); await db.refresh(e)
    return {"id": e.id}

@sizheng_app.put("/evaluations/{eid}")
async def update_evaluation(eid: int, req: EvalUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    e = await db.get(PeerEvaluation, eid)
    if not e: return {"error": "不存在"}
    if req.score is not None: e.score = req.score
    if req.comment is not None: e.comment = req.comment
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/evaluations/{eid}")
async def delete_evaluation(eid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    e = await db.get(PeerEvaluation, eid)
    if not e: return {"error": "不存在"}
    await db.delete(e); await db.commit()
    return {"status": "ok"}


# ── 特色党建 — 党建品牌 ──────────────────────────────

class BrandCreate(BaseModel):
    name: str
    description: str | None = None
    cover_url: str | None = None
    status: str = "active"

class BrandUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    cover_url: str | None = None
    status: str | None = None

@sizheng_app.get("/special-brands")
async def list_brands(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpecialBrand).order_by(SpecialBrand.created_at.desc()))
    brands = result.scalars().all()
    return [{"id": b.id, "name": b.name, "description": b.description, "cover_url": b.cover_url,
             "status": b.status, "created_at": str(b.created_at), "updated_at": str(b.updated_at)} for b in brands]

@sizheng_app.post("/special-brands")
async def create_brand(req: BrandCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    b = SpecialBrand(**req.model_dump())
    db.add(b); await db.commit(); await db.refresh(b)
    return {"status": "ok", "id": b.id}

@sizheng_app.put("/special-brands/{bid}")
async def update_brand(bid: int, req: BrandUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    b = await db.get(SpecialBrand, bid)
    if not b: return {"error": "不存在"}
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(b, k, v)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/special-brands/{bid}")
async def delete_brand(bid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    b = await db.get(SpecialBrand, bid)
    if not b: return {"error": "不存在"}
    await db.delete(b); await db.commit()
    return {"status": "ok"}


# ── 特色党建 — 支部风采 ──────────────────────────────

class ShowcaseCreate(BaseModel):
    branch_id: int
    title: str
    content: str | None = None
    cover_url: str | None = None
    images: dict | None = None
    is_published: bool = False

class ShowcaseUpdate(BaseModel):
    branch_id: int | None = None
    title: str | None = None
    content: str | None = None
    cover_url: str | None = None
    images: dict | None = None
    is_published: bool | None = None

@sizheng_app.get("/branch-showcases")
async def list_showcases(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(BranchShowcase, Branch.name)
        .join(Branch, BranchShowcase.branch_id == Branch.id, isouter=True)
        .order_by(BranchShowcase.created_at.desc())
    )
    rows = result.all()
    return [{"id": s.id, "branch_id": s.branch_id, "branch_name": branch_name, "title": s.title,
             "content": s.content, "cover_url": s.cover_url, "images": s.images,
             "is_published": s.is_published, "created_at": str(s.created_at), "updated_at": str(s.updated_at)}
            for s, branch_name in rows]

@sizheng_app.post("/branch-showcases")
async def create_showcase(req: ShowcaseCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = BranchShowcase(**req.model_dump())
    db.add(s); await db.commit(); await db.refresh(s)
    return {"status": "ok", "id": s.id}

@sizheng_app.put("/branch-showcases/{sid}")
async def update_showcase(sid: int, req: ShowcaseUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = await db.get(BranchShowcase, sid)
    if not s: return {"error": "不存在"}
    for k, v in req.model_dump(exclude_none=True).items():
        setattr(s, k, v)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/branch-showcases/{sid}")
async def delete_showcase(sid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    s = await db.get(BranchShowcase, sid)
    if not s: return {"error": "不存在"}
    await db.delete(s); await db.commit()
    return {"status": "ok"}


# ── 特色党建 — 特色活动 ──────────────────────────────

class ActivityCreate(BaseModel):
    title: str
    description: str | None = None
    cover_url: str | None = None
    activity_date: str | None = None
    location: str | None = None
    status: str = "upcoming"

class ActivityUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    cover_url: str | None = None
    activity_date: str | None = None
    location: str | None = None
    status: str | None = None

@sizheng_app.get("/special-activities")
async def list_activities(admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SpecialActivity).order_by(SpecialActivity.activity_date.desc()))
    acts = result.scalars().all()
    return [{"id": a.id, "title": a.title, "description": a.description, "cover_url": a.cover_url,
             "activity_date": str(a.activity_date) if a.activity_date else None, "location": a.location,
             "status": a.status, "created_at": str(a.created_at), "updated_at": str(a.updated_at)} for a in acts]

@sizheng_app.post("/special-activities")
async def create_activity(req: ActivityCreate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    d = req.model_dump()
    if d.get("activity_date"):
        d["activity_date"] = _parse_dt(d["activity_date"])
    a = SpecialActivity(**d)
    db.add(a); await db.commit(); await db.refresh(a)
    return {"status": "ok", "id": a.id}

@sizheng_app.put("/special-activities/{aid}")
async def update_activity(aid: int, req: ActivityUpdate, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(SpecialActivity, aid)
    if not a: return {"error": "不存在"}
    d = req.model_dump(exclude_none=True)
    if d.get("activity_date"):
        d["activity_date"] = _parse_dt(d["activity_date"])
    for k, v in d.items():
        setattr(a, k, v)
    await db.commit()
    return {"status": "ok"}

@sizheng_app.delete("/special-activities/{aid}")
async def delete_activity(aid: int, admin: AdminUser = Depends(get_current_admin), db: AsyncSession = Depends(get_db)):
    a = await db.get(SpecialActivity, aid)
    if not a: return {"error": "不存在"}
    await db.delete(a); await db.commit()
    return {"status": "ok"}


# ── 健康检查 ───────────────────────────────────────

@sizheng_app.get("/health")
async def health():
    return {"status": "ok"}
