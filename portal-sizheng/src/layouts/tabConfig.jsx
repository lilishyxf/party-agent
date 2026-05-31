import {
  RobotOutlined, DashboardOutlined, FlagOutlined, ReadOutlined,
  SoundOutlined, CalendarOutlined, HeartOutlined,
  SafetyOutlined, AppstoreOutlined, SettingOutlined,
} from '@ant-design/icons'

// 10 tab definitions — used by both the horizontal nav and router
export const TABS = [
  { key: 'ai',       label: 'AI 助手',   icon: <RobotOutlined /> },
  { key: 'dashboard', label: '可视化',    icon: <DashboardOutlined /> },
  { key: 'party',    label: '党务中心',   icon: <FlagOutlined /> },
  { key: 'learning', label: '学习中心',   icon: <ReadOutlined /> },
  { key: 'promotion',label: '宣传中心',   icon: <SoundOutlined /> },
  { key: 'activity', label: '活动中心',   icon: <CalendarOutlined /> },
  { key: 'service',  label: '服务中心',   icon: <HeartOutlined /> },
  { key: 'supervision', label: '监督中心', icon: <SafetyOutlined /> },
  { key: 'office',   label: '办公中心',   icon: <AppstoreOutlined /> },
  { key: 'system',   label: '系统',       icon: <SettingOutlined /> },
]

// Secondary sidebar menus for each tab
export const SIDE_MENUS = {
  party: [
    { key: 'members', label: '党员信息' },
    { key: 'development', label: '发展党员' },
    { key: 'cadres', label: '干部管理' },
    { key: 'contact', label: '党员联系' },
    { key: 'org-structure', label: '党组织架构' },
  ],
  learning: [
    { key: 'lessons', label: '专题学习' },
    { key: 'records', label: '学习档案管理' },
    { key: 'progress', label: '学习动态管理' },
    { key: 'questions', label: '题库管理' },
    { key: 'exams', label: '考试中心' },
    { key: 'notes', label: '学习笔记' },
    { key: 'briefing', label: '学习简报' },
  ],
  promotion: [
    { key: 'articles', label: '党建文章发布' },
    { key: 'images', label: '党建图片库' },
    { key: 'videos', label: '视频资料库' },
  ],
  activity: [
    { key: 'meetings', label: '会议管理' },
    { key: 'theme-activity', label: '主题党日活动' },
    { key: 'three-one', label: '三会一课' },
    { key: 'life-meeting', label: '组织生活会' },
    { key: 'democratic', label: '民主评议党员' },
  ],
  service: [
    { key: 'party-service', label: '党员服务' },
    { key: 'dues', label: '党费收缴' },
    { key: 'assistance', label: '困难党员帮扶' },
    { key: 'volunteer', label: '志愿服务记录' },
  ],
  supervision: [
    { key: 'discipline-study', label: '党风党纪学习' },
    { key: 'warning-edu', label: '廉政警示教育' },
    { key: 'reports', label: '问题线索' },
    { key: 'inspection', label: '监督检查记录' },
  ],
  office: [
    { key: 'notices', label: '通知公告' },
    { key: 'todos', label: '工作待办' },
    { key: 'documents', label: '公文流转' },
    { key: 'schedule', label: '日程安排' },
  ],
  system: [
    { key: 'users', label: '用户管理' },
    { key: 'roles', label: '角色权限' },
    { key: 'logs', label: '操作日志' },
    { key: 'config', label: '系统配置' },
    { key: 'dict', label: '数据字典' },
  ],
}

export const TAB_LABELS = {
  party: '党务中心',
  learning: '学习中心',
  promotion: '宣传中心',
  activity: '活动中心',
  service: '服务中心',
  supervision: '监督中心',
  office: '办公中心',
  system: '系统',
}
