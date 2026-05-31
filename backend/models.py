from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base, beijing_now


class Branch(Base):
    __tablename__ = "branch"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="SET NULL"), nullable=True)
    secretary_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    members: Mapped[list["Member"]] = relationship(back_populates="branch", foreign_keys="Member.branch_id")


class PartyGroup(Base):
    """党小组"""
    __tablename__ = "partygroup"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    leader_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    branch: Mapped[Branch | None] = relationship(foreign_keys=[branch_id])
    leader: Mapped["Member | None"] = relationship(foreign_keys=[leader_id])


class Member(Base):
    __tablename__ = "member"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    id_card: Mapped[str | None] = mapped_column(String(18), unique=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    student_id: Mapped[str | None] = mapped_column(String(20))
    wechat_openid: Mapped[str | None] = mapped_column(String(64), unique=True)
    gender: Mapped[str | None] = mapped_column(String(10))
    birth_date: Mapped[datetime | None] = mapped_column(Date)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="RESTRICT"))
    party_group_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("partygroup.id", ondelete="SET NULL"))
    join_party_date: Mapped[datetime | None] = mapped_column(Date)
    party_status: Mapped[str] = mapped_column(String(32), default="正式党员")
    role: Mapped[str] = mapped_column(String(32), default="党员")
    position: Mapped[str | None] = mapped_column(String(100))
    duty_description: Mapped[str | None] = mapped_column(String(255))
    appointment_date: Mapped[datetime | None] = mapped_column(Date)
    education: Mapped[str | None] = mapped_column(String(32))
    ethnicity: Mapped[str | None] = mapped_column(String(32))
    title: Mapped[str | None] = mapped_column(String(64))
    student_status: Mapped[str | None] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    branch: Mapped[Branch | None] = relationship(back_populates="members", foreign_keys=[branch_id])
    party_group: Mapped[PartyGroup | None] = relationship(foreign_keys=[party_group_id])


class LearningMaterial(Base):
    __tablename__ = "learningmaterial"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    content_url: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="RESTRICT"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class LearningRecord(Base):
    __tablename__ = "learningrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("learningmaterial.id", ondelete="RESTRICT"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    duration: Mapped[int | None] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class LearningTask(Base):
    __tablename__ = "learningtask"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class TaskMaterial(Base):
    __tablename__ = "taskmaterial"

    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("learningtask.id", ondelete="CASCADE"), primary_key=True)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("learningmaterial.id", ondelete="CASCADE"), primary_key=True)


class TaskAssignment(Base):
    __tablename__ = "taskassignment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("learningtask.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Question(Base):
    __tablename__ = "question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    options: Mapped[str | None] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="medium")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class AnswerRecord(Base):
    __tablename__ = "answerrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("question.id", ondelete="RESTRICT"), nullable=False)
    exam_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("exam.id", ondelete="SET NULL"))
    user_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_spent: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Exam(Base):
    __tablename__ = "exam"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="RESTRICT"), nullable=False)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    pass_score: Mapped[int] = mapped_column(Integer, default=60)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class ExamQuestion(Base):
    __tablename__ = "examquestion"

    exam_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("exam.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("question.id", ondelete="CASCADE"), primary_key=True)


class ExamAssignment(Base):
    __tablename__ = "examassignment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("exam.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    score: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class WritingTemplate(Base):
    __tablename__ = "writingtemplate"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    outline: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class WritingRecord(Base):
    __tablename__ = "writingrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    template_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("writingtemplate.id", ondelete="SET NULL"))
    user_input: Mapped[str] = mapped_column(Text, nullable=False)
    ai_draft: Mapped[str | None] = mapped_column(Text)
    final_content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class QuizProgress(Base):
    __tablename__ = "quizprogress"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class PointRecord(Base):
    __tablename__ = "pointrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Topic(Base):
    __tablename__ = "topic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    order_num: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class TopicItem(Base):
    __tablename__ = "topicitem"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("topic.id", ondelete="CASCADE"), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)  # "material" | "task"
    item_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    order_num: Mapped[int] = mapped_column(Integer, default=0)


class LearningNote(Base):
    __tablename__ = "learningnote"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="RESTRICT"), nullable=False)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("learningmaterial.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class ChatHistory(Base):
    __tablename__ = "chathistory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


# ── 活动中心 · 会议记录 ────────────────────────────

MEETING_TYPES = [
    "party_member_congress",   # 党员大会
    "branch_committee",        # 支委会
    "party_group",             # 党小组会
    "party_lecture",           # 党课
    "theme_party_day",         # 主题党日活动
    "org_life_meeting",        # 组织生活会
    "democratic_evaluation",   # 民主评议党员
    "theory_study",            # 理论学习
    "dev_activist",            # 支委会确定入党积极分子
    "dev_candidate",           # 支委会确定发展对象
    "dev_probationary",        # 支部党员大会吸收预备党员
    "probationary_full",       # 预备党员转正
    "committee_report",        # 支委会报告工作
    "member_report",           # 党员汇报
    "talk_heart",              # 谈心谈话
]

class Meeting(Base):
    __tablename__ = "meeting"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    meeting_type: Mapped[str] = mapped_column(String(32), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    meeting_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    location: Mapped[str] = mapped_column(String(200), nullable=False)
    host: Mapped[str] = mapped_column(String(100), nullable=False)
    recorder: Mapped[str] = mapped_column(String(100), nullable=False)
    attendees: Mapped[str] = mapped_column(Text, nullable=False)
    observers: Mapped[str | None] = mapped_column(Text)
    absentees: Mapped[str | None] = mapped_column(Text)
    topic: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    extra_fields: Mapped[dict | None] = mapped_column(JSON)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


# ── 办公中心 ────────────────────────────────────────

class Notice(Base):
    __tablename__ = "notice"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("branch.id", ondelete="RESTRICT"))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Todo(Base):
    __tablename__ = "todo"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assignee: Mapped[str | None] = mapped_column(String(100))
    deadline: Mapped[datetime | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Document(Base):
    __tablename__ = "document"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    doc_type: Mapped[str] = mapped_column(String(16), default="receipt")
    doc_number: Mapped[str | None] = mapped_column(String(100))
    sender: Mapped[str | None] = mapped_column(String(100))
    receiver: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Schedule(Base):
    __tablename__ = "schedule"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    location: Mapped[str | None] = mapped_column(String(200))
    event_type: Mapped[str] = mapped_column(String(32), default="other")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class DevelopmentRecord(Base):
    """发展党员阶段流转记录 — 对应业务字段总录 §4 状态机"""
    __tablename__ = "developmentrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(32), nullable=False)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    meeting_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("meeting.id", ondelete="SET NULL"))
    meeting_date: Mapped[datetime | None] = mapped_column(Date)
    decision: Mapped[str | None] = mapped_column(String(255))
    operator_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class MemberContact(Base):
    """党员联系群众"""
    __tablename__ = "membercontact"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    contact_type: Mapped[str] = mapped_column(String(32), default="群众")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Dues(Base):
    """党费收缴"""
    __tablename__ = "dues"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), default="未缴")
    paid_date: Mapped[datetime | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Assistance(Base):
    """困难党员帮扶"""
    __tablename__ = "assistance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    assistance_type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    reason: Mapped[str | None] = mapped_column(Text)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="已完成")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Volunteer(Base):
    """志愿服务记录"""
    __tablename__ = "volunteer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    activity_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hours: Mapped[float] = mapped_column(nullable=False, default=0)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


# ── 系统管理 ────────────────────────────────────────

class AdminUser(Base):
    """教师端管理员账号"""
    __tablename__ = "adminuser"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    real_name: Mapped[str] = mapped_column(String(64), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(32), default="普通管理员")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class OperationLog(Base):
    """操作日志"""
    __tablename__ = "operationlog"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    admin_user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("adminuser.id", ondelete="SET NULL"))
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[int | None] = mapped_column(BigInteger)
    detail: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SystemConfig(Base):
    """系统配置"""
    __tablename__ = "systemconfig"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    config_value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class DataDict(Base):
    """数据字典"""
    __tablename__ = "datadict"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dict_type: Mapped[str] = mapped_column(String(64), nullable=False)
    dict_key: Mapped[str] = mapped_column(String(100), nullable=False)
    dict_value: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


# ── 监督中心 ────────────────────────────────────────

class DisciplineStudy(Base):
    """党风党纪学习"""
    __tablename__ = "disciplinestudy"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    study_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    attendees: Mapped[str | None] = mapped_column(Text)
    organizer: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class WarningEdu(Base):
    """廉政警示教育"""
    __tablename__ = "warningedu"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    edu_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    edu_type: Mapped[str] = mapped_column(String(32), nullable=False, default="案例通报")
    content: Mapped[str | None] = mapped_column(Text)
    attendees: Mapped[str | None] = mapped_column(Text)
    organizer: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class PartyTransfer(Base):
    """组织关系转接"""
    __tablename__ = "partytransfer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    from_branch: Mapped[str] = mapped_column(String(100), nullable=False)
    to_branch: Mapped[str] = mapped_column(String(100), nullable=False)
    transfer_type: Mapped[str] = mapped_column(String(32), nullable=False, default="系统内")
    status: Mapped[str] = mapped_column(String(32), default="办理中")
    letter_number: Mapped[str | None] = mapped_column(String(100))
    apply_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    complete_date: Mapped[datetime | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class FloatingMember(Base):
    """流动党员管理"""
    __tablename__ = "floatingmember"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    float_type: Mapped[str] = mapped_column(String(16), nullable=False, default="流出")
    destination: Mapped[str] = mapped_column(String(200), nullable=False)
    depart_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    expected_return_date: Mapped[datetime | None] = mapped_column(Date)
    certificate_number: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(32), default="在流动中")
    contact_record: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Regulation(Base):
    """制度汇编"""
    __tablename__ = "regulation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="条例")
    issuing_authority: Mapped[str | None] = mapped_column(String(200))
    publish_date: Mapped[datetime | None] = mapped_column(Date)
    content: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Archive(Base):
    """归档管理"""
    __tablename__ = "archive"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    archive_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    box_number: Mapped[str | None] = mapped_column(String(100))
    storage_location: Mapped[str | None] = mapped_column(String(200))
    retention_years: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default="已归档")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class DuesReceipt(Base):
    """党费票据管理"""
    __tablename__ = "duesreceipt"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    receipt_number: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    issue_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="已开具")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class DuesPublic(Base):
    """党费使用公示"""
    __tablename__ = "duespublic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="活动经费")
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), default="公示中")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class AssessmentIndicator(Base):
    """考核指标"""
    __tablename__ = "assessmentindicator"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="共性指标")
    max_score: Mapped[int] = mapped_column(Integer, default=100)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class PeerEvaluation(Base):
    """自评互评"""
    __tablename__ = "peerevaluation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"), nullable=False)
    eval_type: Mapped[str] = mapped_column(String(16), nullable=False, default="自评")
    target_member_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("member.id", ondelete="CASCADE"))
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class Inspection(Base):
    """监督检查记录"""
    __tablename__ = "inspection"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    inspect_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    inspector: Mapped[str] = mapped_column(String(100), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text)
    finding: Mapped[str | None] = mapped_column(Text)
    rectification_status: Mapped[str] = mapped_column(String(32), default="待整改")
    rectification_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
