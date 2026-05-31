"""Sizheng portal models — all tables prefixed with sizheng_"""
from datetime import datetime
from sqlalchemy import (
    BigInteger, Boolean, Date, DateTime, ForeignKey, Integer, JSON, String, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base, beijing_now


class SizhengBranch(Base):
    __tablename__ = "sizheng_branch"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    parent_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="SET NULL"), nullable=True)
    secretary_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    members: Mapped[list["SizhengMember"]] = relationship(back_populates="branch", foreign_keys="SizhengMember.branch_id")


class SizhengPartyGroup(Base):
    __tablename__ = "sizheng_partygroup"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    leader_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)

    branch: Mapped[SizhengBranch | None] = relationship(foreign_keys=[branch_id])
    leader: Mapped["SizhengMember | None"] = relationship(foreign_keys=[leader_id])


class SizhengMember(Base):
    __tablename__ = "sizheng_member"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    id_card: Mapped[str | None] = mapped_column(String(18), unique=True)
    phone: Mapped[str | None] = mapped_column(String(20))
    student_id: Mapped[str | None] = mapped_column(String(20))
    wechat_openid: Mapped[str | None] = mapped_column(String(64), unique=True)
    gender: Mapped[str | None] = mapped_column(String(10))
    birth_date: Mapped[datetime | None] = mapped_column(Date)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="RESTRICT"))
    party_group_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_partygroup.id", ondelete="SET NULL"))
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

    branch: Mapped[SizhengBranch | None] = relationship(back_populates="members", foreign_keys=[branch_id])
    party_group: Mapped[SizhengPartyGroup | None] = relationship(foreign_keys=[party_group_id])


class SizhengLearningMaterial(Base):
    __tablename__ = "sizheng_learningmaterial"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    content_url: Mapped[str | None] = mapped_column(String(255))
    file_path: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="RESTRICT"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengLearningRecord(Base):
    __tablename__ = "sizheng_learningrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_learningmaterial.id", ondelete="RESTRICT"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    duration: Mapped[int | None] = mapped_column(Integer)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengLearningTask(Base):
    __tablename__ = "sizheng_learningtask"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="SET NULL"), nullable=True)
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengTaskMaterial(Base):
    __tablename__ = "sizheng_taskmaterial"

    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_learningtask.id", ondelete="CASCADE"), primary_key=True)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_learningmaterial.id", ondelete="CASCADE"), primary_key=True)


class SizhengTaskAssignment(Base):
    __tablename__ = "sizheng_taskassignment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    task_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_learningtask.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengQuestion(Base):
    __tablename__ = "sizheng_question"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(32), nullable=False)
    options: Mapped[str | None] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(32), default="medium")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengAnswerRecord(Base):
    __tablename__ = "sizheng_answerrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_question.id", ondelete="RESTRICT"), nullable=False)
    exam_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_exam.id", ondelete="SET NULL"))
    user_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_spent: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengExam(Base):
    __tablename__ = "sizheng_exam"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="RESTRICT"), nullable=False)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    pass_score: Mapped[int] = mapped_column(Integer, default=60)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengExamQuestion(Base):
    __tablename__ = "sizheng_examquestion"

    exam_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_exam.id", ondelete="CASCADE"), primary_key=True)
    question_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_question.id", ondelete="CASCADE"), primary_key=True)


class SizhengExamAssignment(Base):
    __tablename__ = "sizheng_examassignment"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    exam_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_exam.id", ondelete="CASCADE"), nullable=False)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending")
    score: Mapped[int | None] = mapped_column(Integer)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengWritingTemplate(Base):
    __tablename__ = "sizheng_writingtemplate"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    prompt_template: Mapped[str] = mapped_column(Text, nullable=False)
    outline: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengWritingRecord(Base):
    __tablename__ = "sizheng_writingrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    template_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_writingtemplate.id", ondelete="SET NULL"))
    user_input: Mapped[str] = mapped_column(Text, nullable=False)
    ai_draft: Mapped[str | None] = mapped_column(Text)
    final_content: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengQuizProgress(Base):
    __tablename__ = "sizheng_quizprogress"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False)
    current_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengPointRecord(Base):
    __tablename__ = "sizheng_pointrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    points: Mapped[int] = mapped_column(Integer, nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    source_type: Mapped[str] = mapped_column(String(32), nullable=False)
    source_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengTopic(Base):
    __tablename__ = "sizheng_topic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    order_num: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengTopicItem(Base):
    __tablename__ = "sizheng_topicitem"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_topic.id", ondelete="CASCADE"), nullable=False)
    item_type: Mapped[str] = mapped_column(String(32), nullable=False)
    item_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    order_num: Mapped[int] = mapped_column(Integer, default=0)


class SizhengLearningNote(Base):
    __tablename__ = "sizheng_learningnote"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="RESTRICT"), nullable=False)
    material_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_learningmaterial.id", ondelete="CASCADE"), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengChatHistory(Base):
    __tablename__ = "sizheng_chathistory"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    openid: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    conversation_id: Mapped[str | None] = mapped_column(String(64))
    role: Mapped[str] = mapped_column(String(16), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengMeeting(Base):
    __tablename__ = "sizheng_meeting"

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
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="RESTRICT"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengNotice(Base):
    __tablename__ = "sizheng_notice"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="draft")
    branch_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="RESTRICT"))
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengTodo(Base):
    __tablename__ = "sizheng_todo"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    assignee: Mapped[str | None] = mapped_column(String(100))
    deadline: Mapped[datetime | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(16), default="medium")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengDocument(Base):
    __tablename__ = "sizheng_document"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    doc_type: Mapped[str] = mapped_column(String(16), default="receipt")
    doc_number: Mapped[str | None] = mapped_column(String(100))
    sender: Mapped[str | None] = mapped_column(String(100))
    receiver: Mapped[str | None] = mapped_column(String(100))
    status: Mapped[str] = mapped_column(String(16), default="draft")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengSchedule(Base):
    __tablename__ = "sizheng_schedule"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_time: Mapped[datetime | None] = mapped_column(DateTime)
    location: Mapped[str | None] = mapped_column(String(200))
    event_type: Mapped[str] = mapped_column(String(32), default="other")
    created_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengDevelopmentRecord(Base):
    __tablename__ = "sizheng_developmentrecord"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    from_status: Mapped[str] = mapped_column(String(32), nullable=False)
    to_status: Mapped[str] = mapped_column(String(32), nullable=False)
    meeting_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_meeting.id", ondelete="SET NULL"))
    meeting_date: Mapped[datetime | None] = mapped_column(Date)
    decision: Mapped[str | None] = mapped_column(String(255))
    operator_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengMemberContact(Base):
    __tablename__ = "sizheng_membercontact"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    contact_name: Mapped[str] = mapped_column(String(100), nullable=False)
    contact_phone: Mapped[str | None] = mapped_column(String(20))
    contact_type: Mapped[str] = mapped_column(String(32), default="群众")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengDues(Base):
    __tablename__ = "sizheng_dues"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(16), default="未缴")
    paid_date: Mapped[datetime | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengAssistance(Base):
    __tablename__ = "sizheng_assistance"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    assistance_type: Mapped[str] = mapped_column(String(32), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    reason: Mapped[str | None] = mapped_column(Text)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="已完成")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengVolunteer(Base):
    __tablename__ = "sizheng_volunteer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    activity_name: Mapped[str] = mapped_column(String(200), nullable=False)
    hours: Mapped[float] = mapped_column(nullable=False, default=0)
    date: Mapped[datetime] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengAdminUser(Base):
    __tablename__ = "sizheng_adminuser"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    real_name: Mapped[str] = mapped_column(String(64), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[str] = mapped_column(String(32), default="普通管理员")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengOperationLog(Base):
    __tablename__ = "sizheng_operationlog"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    admin_user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_adminuser.id", ondelete="SET NULL"))
    username: Mapped[str] = mapped_column(String(64), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    target_type: Mapped[str] = mapped_column(String(64), nullable=False)
    target_id: Mapped[int | None] = mapped_column(BigInteger)
    detail: Mapped[str | None] = mapped_column(Text)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengSystemConfig(Base):
    __tablename__ = "sizheng_systemconfig"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    config_value: Mapped[str] = mapped_column(Text, default="")
    description: Mapped[str | None] = mapped_column(String(255))
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengDataDict(Base):
    __tablename__ = "sizheng_datadict"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    dict_type: Mapped[str] = mapped_column(String(64), nullable=False)
    dict_key: Mapped[str] = mapped_column(String(100), nullable=False)
    dict_value: Mapped[str] = mapped_column(String(255), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    description: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SizhengDisciplineStudy(Base):
    __tablename__ = "sizheng_disciplinestudy"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    study_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    attendees: Mapped[str | None] = mapped_column(Text)
    organizer: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengWarningEdu(Base):
    __tablename__ = "sizheng_warningedu"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    edu_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    edu_type: Mapped[str] = mapped_column(String(32), nullable=False, default="案例通报")
    content: Mapped[str | None] = mapped_column(Text)
    attendees: Mapped[str | None] = mapped_column(Text)
    organizer: Mapped[str | None] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengPartyTransfer(Base):
    __tablename__ = "sizheng_partytransfer"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
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


class SizhengFloatingMember(Base):
    __tablename__ = "sizheng_floatingmember"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
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


class SizhengRegulation(Base):
    __tablename__ = "sizheng_regulation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="条例")
    issuing_authority: Mapped[str | None] = mapped_column(String(200))
    publish_date: Mapped[datetime | None] = mapped_column(Date)
    content: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengArchive(Base):
    __tablename__ = "sizheng_archive"

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


class SizhengDuesReceipt(Base):
    __tablename__ = "sizheng_duesreceipt"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    receipt_number: Mapped[str] = mapped_column(String(100), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False, default=0)
    issue_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="已开具")
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengDuesPublic(Base):
    __tablename__ = "sizheng_duespublic"

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


class SizhengAssessmentIndicator(Base):
    __tablename__ = "sizheng_assessmentindicator"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(32), nullable=False, default="共性指标")
    max_score: Mapped[int] = mapped_column(Integer, default=100)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengPeerEvaluation(Base):
    __tablename__ = "sizheng_peerevaluation"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    member_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"), nullable=False)
    eval_type: Mapped[str] = mapped_column(String(16), nullable=False, default="自评")
    target_member_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("sizheng_member.id", ondelete="CASCADE"))
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    score: Mapped[int] = mapped_column(Integer, default=0)
    comment: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengInspection(Base):
    __tablename__ = "sizheng_inspection"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    inspect_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    inspector: Mapped[str] = mapped_column(String(100), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text)
    finding: Mapped[str | None] = mapped_column(Text)
    rectification_status: Mapped[str] = mapped_column(String(32), default="待整改")
    rectification_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


# ── 特色党建 ──────────────────────────────────────

class SizhengSpecialBrand(Base):
    __tablename__ = "sizheng_special_brand"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengBranchShowcase(Base):
    __tablename__ = "sizheng_branch_showcase"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    branch_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("sizheng_branch.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    images: Mapped[dict | None] = mapped_column(JSON)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)


class SizhengSpecialActivity(Base):
    __tablename__ = "sizheng_special_activity"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    cover_url: Mapped[str | None] = mapped_column(String(255))
    activity_date: Mapped[datetime | None] = mapped_column(Date)
    location: Mapped[str | None] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20), default="upcoming")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=beijing_now)
