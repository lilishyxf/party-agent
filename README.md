# 党务 Agent — 智慧党建管理系统

西安工业大学 计算机科学与工程学院 毕业设计项目（2027）

## 项目简介

面向高校基层党支部的智慧党建管理平台，集成 AI 问答、党费收缴、会议管理、党员发展、组织转接等全流程功能。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Python FastAPI + SQLAlchemy + PostgreSQL |
| AI 引擎 | Dify 工作流 + DeepSeek V4 |
| 前端 | React + Vite + Ant Design + Recharts |
| 部署 | Nginx + systemd + Ubuntu 22.04 |

## 项目结构

```
├── backend/                  # FastAPI 后端
│   ├── app.py                # 计算机学院 API
│   ├── app_sizheng.py        # 马克思主义学院 API
│   ├── models.py             # 计算机学院数据模型
│   ├── models_sizheng.py     # 马克思主义学院数据模型
│   └── database.py           # 数据库连接
├── portal-admin/             # 计算机学院教师端
├── portal/                   # 计算机学院学生端
├── portal-sizheng/           # 马克思主义学院教师端
├── portal-sizheng-student/   # 马克思主义学院学生端
├── docs/                     # 项目文档与设计资料
├── outputs/                  # 交付物（设计文档、测试报告、部署手册）
└── archive/                  # 历史版本归档
```

## 功能模块

- **仪表盘** — 党员结构可视化、活动参与统计、党费收缴概览
- **党务中心** — 党员管理、党组织架构、发展党员状态机、干部管理
- **服务中心** — 党费收缴（AI 智能导入）、会议管理、任务分配
- **监督中心** — 考核指标、民主评议、组织转接
- **系统管理** — 用户权限、操作日志、系统配置
- **AI 助手** — 党建知识问答、公文写作辅助

## 快速开始

### 后端

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # 编辑数据库连接等配置
uvicorn app:app --host 127.0.0.1 --port 8000
```

### 前端

```bash
cd portal-admin
npm install && npm run dev
```

## 部署

详见 `outputs/党务Agent_部署与维护手册_V1.docx`
