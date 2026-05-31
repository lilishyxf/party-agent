import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Badge, Avatar, Dropdown, Modal, Form, Input, message, Popover, List, Button } from 'antd'
import {
  BellOutlined, UserOutlined, QuestionCircleOutlined,
  RobotOutlined, ClusterOutlined, IdcardOutlined,
  ScheduleOutlined, ReadOutlined, FolderOutlined,
  PayCircleOutlined, SolutionOutlined, AimOutlined,
  PieChartOutlined, SettingOutlined, TrophyOutlined,
} from '@ant-design/icons'
import HelpDrawer from '../components/HelpDrawer'
import { useAuth } from '../services/AuthContext'
import { changeAdminPassword, fetchOperationLogs, fetchUnreadCount, markLogRead, markAllLogsRead } from '../services/api'

const { Header, Sider, Content } = Layout

const TABS = [
  { key: 'ai',          label: 'AI 助手',   icon: <RobotOutlined /> },
  { key: 'org',         label: '组织架构',   icon: <ClusterOutlined /> },
  { key: 'members',     label: '党员管理',   icon: <IdcardOutlined /> },
  { key: 'org-life',    label: '组织生活',   icon: <ScheduleOutlined /> },
  { key: 'learning',    label: '学习教育',   icon: <ReadOutlined /> },
  { key: 'documents',   label: '公文文件',   icon: <FolderOutlined /> },
  { key: 'dues',        label: '党费管理',   icon: <PayCircleOutlined /> },
  { key: 'development', label: '发展党员',   icon: <SolutionOutlined /> },
  { key: 'tasks',       label: '任务考核',   icon: <AimOutlined /> },
  { key: 'special',     label: '特色党建',   icon: <TrophyOutlined /> },
  { key: 'stats',       label: '数据统计',   icon: <PieChartOutlined /> },
  { key: 'system',      label: '系统管理',   icon: <SettingOutlined /> },
]

const SIDE_MENUS = {
  org: [
    { key: 'structure', label: '支部委员会' },
    { key: 'groups', label: '党小组设置' },
    { key: 'duty', label: '职责分工' },
  ],
  members: [
    { key: 'roster', label: '党员名册' },
    { key: 'info', label: '信息维护' },
    { key: 'transfer', label: '组织关系转接' },
    { key: 'floating', label: '流动党员管理' },
  ],
  'org-life': [
    { key: 'three-one', label: '三会一课' },
    { key: 'theme-activity', label: '主题党日' },
    { key: 'life-meeting', label: '组织生活会' },
    { key: 'democratic', label: '民主评议党员' },
  ],
  learning: [
    { key: 'materials', label: '学习资料库' },
    { key: 'exams', label: '在线测试' },
    { key: 'records', label: '学时统计' },
    { key: 'lessons', label: '专题学习' },
    { key: 'questions', label: '题库管理' },
  ],
  documents: [
    { key: 'notices', label: '通知公告' },
    { key: 'inout', label: '文件收发' },
    { key: 'rules', label: '制度汇编' },
    { key: 'archive', label: '归档管理' },
  ],
  dues: [
    { key: 'collect', label: '收缴记录' },
    { key: 'receipt', label: '票据管理' },
    { key: 'public', label: '党费使用公示' },
  ],
  development: [
    { key: 'applicant', label: '入党申请' },
    { key: 'activist', label: '积极分子' },
    { key: 'candidate', label: '发展对象' },
    { key: 'probationary', label: '预备党员' },
  ],
  tasks: [
    { key: 'assign', label: '任务分配' },
    { key: 'progress', label: '完成进度' },
    { key: 'assess', label: '考核指标' },
    { key: 'evaluate', label: '自评互评' },
  ],
  special: [
    { key: 'brands', label: '党建品牌' },
    { key: 'showcase', label: '支部风采' },
    { key: 'activities', label: '特色活动' },
  ],
  stats: [
    { key: 'structure-stats', label: '党员结构分析' },
    { key: 'participation', label: '活动参与率' },
    { key: 'dues-rate', label: '党费收缴率' },
  ],
  system: [
    { key: 'users', label: '账户权限' },
    { key: 'roles', label: '角色管理' },
    { key: 'logs', label: '日志审计' },
    { key: 'config', label: '系统配置' },
  ],
}

export default function TeacherLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [pwdModalOpen, setPwdModalOpen] = useState(false)
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdForm] = Form.useForm()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [helpOpen, setHelpOpen] = useState(false)

  const pathParts = location.pathname.split('/').filter(Boolean)
  const activeTab = pathParts[0] || 'ai'
  const activeSub = pathParts[1] || null

  const sideItems = SIDE_MENUS[activeTab]
  const showSidebar = sideItems && sideItems.length > 0

  const loadNotifications = () => {
    if (!user) return
    Promise.all([
      fetchOperationLogs({ page_size: 12 }),
      fetchUnreadCount(),
    ]).then(([logs, unread]) => {
      setNotifications(logs.list || [])
      setUnreadCount(unread.count || 0)
    }).catch(() => {})
  }

  useEffect(() => { loadNotifications() }, [user, pwdModalOpen])

  const handleReadOne = async (id) => {
    try { await markLogRead(id); setUnreadCount(c => Math.max(0, c - 1)); setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n)) } catch {}
  }

  const handleReadAll = async () => {
    try { await markAllLogsRead(); setUnreadCount(0); setNotifications(prev => prev.map(n => ({ ...n, is_read: true }))) } catch {}
  }

  const handleMenuClick = ({ key }) => {
    if (key === 'logout') { logout(); navigate('/login') }
    if (key === 'password') { pwdForm.resetFields(); setPwdModalOpen(true) }
  }

  const handleChangePwd = async () => {
    try {
      const values = await pwdForm.validateFields()
      setPwdSaving(true)
      await changeAdminPassword(values)
      message.success('密码已修改')
      setPwdModalOpen(false)
    } catch (e) { if (e.errorFields) return; message.error('修改失败') }
    setPwdSaving(false)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        height: 60, background: 'linear-gradient(135deg, #c62828, #d32f2f)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1, overflow: 'hidden' }}>
          <span style={{
            color: '#fff', fontWeight: 700, fontSize: 16, whiteSpace: 'nowrap',
            marginRight: 24, letterSpacing: 1,
          }}>
            <span style={{ marginRight: 6 }}>☭</span>
            智慧党建 · 思政工作平台
          </span>

          <Menu
            mode="horizontal"
            selectedKeys={[activeTab]}
            onClick={({ key }) => navigate(`/${key}`)}
            items={TABS.map(t => ({ key: t.key, label: t.label, icon: t.icon }))}
            style={{
              background: 'transparent', borderBottom: 'none', flex: 1,
              minWidth: 0, fontSize: 13, userSelect: 'none',
            }}
            theme="dark"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexShrink: 0, marginLeft: 12, userSelect: 'none' }}>
          <Popover
            trigger="click"
            placement="bottomRight"
            content={
              <div style={{ width: 320 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontWeight: 600 }}>通知</span>
                  {unreadCount > 0 && (
                    <Button type="link" size="small" onClick={handleReadAll}>全部已读</Button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 24 }}>暂无通知</div>
                ) : (
                  <List size="small" dataSource={notifications.slice(0, 12)} style={{ maxHeight: 360, overflow: 'auto' }}
                    renderItem={n => (
                      <List.Item onClick={() => !n.is_read && handleReadOne(n.id)}
                        style={{ cursor: n.is_read ? 'default' : 'pointer', opacity: n.is_read ? 0.6 : 1, padding: '8px 0' }}>
                        <div style={{ width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {!n.is_read && <div style={{ width: 6, height: 6, borderRadius: 3, background: '#d32f2f', flexShrink: 0 }} />}
                            <span style={{ fontSize: 13, flex: 1 }}>{n.detail || n.action}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#999', marginTop: 2, marginLeft: 12 }}>
                            {n.username} · {n.created_at ? n.created_at.slice(0, 19).replace('T', ' ') : ''}
                          </div>
                        </div>
                      </List.Item>
                    )} />
                )}
              </div>
            }
          >
            <Badge count={unreadCount} size="small" overflowCount={99}>
              <BellOutlined style={{ fontSize: 18, color: '#fff', cursor: 'pointer' }} />
            </Badge>
          </Popover>
          <QuestionCircleOutlined
            onClick={() => setHelpOpen(true)}
            style={{ fontSize: 18, color: '#fff', cursor: 'pointer' }}
            title="使用帮助"
          />
          <Dropdown menu={{
            onClick: handleMenuClick,
            items: [
              { key: 'password', label: '修改密码' },
              { key: 'logout', label: '退出登录' },
            ],
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              <Avatar size={28} icon={<UserOutlined />} style={{ background: 'rgba(255,255,255,0.3)' }} />
              <span style={{ color: '#fff', fontSize: 13 }}>{user?.real_name || user?.username || '管理员'}</span>
            </div>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        {showSidebar && (
          <Sider
            width={220}
            collapsedWidth={60}
            collapsible
            collapsed={sidebarCollapsed}
            onCollapse={setSidebarCollapsed}
            theme="light"
            style={{
              borderRight: '1px solid #f0f0f0',
              background: '#fff',
            }}
          >
            <Menu
              mode="inline"
              selectedKeys={activeSub ? [activeSub] : []}
              onClick={({ key }) => navigate(`/${activeTab}/${key}`)}
              items={sideItems.map(m => ({ key: m.key, label: m.label }))}
              style={{ borderInlineEnd: 'none', marginTop: 8 }}
            />
          </Sider>
        )}

        <Content style={{
          background: '#f5f5f5', padding: 16, overflow: 'auto',
          minHeight: 'calc(100vh - 60px)',
        }}>
          <Outlet />
        </Content>
      </Layout>

      <HelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} pathname={location.pathname} />

      <Modal title="修改密码" open={pwdModalOpen}
        onCancel={() => setPwdModalOpen(false)} onOk={handleChangePwd}
        confirmLoading={pwdSaving} okText="确认" cancelText="取消" destroyOnClose>
        <Form form={pwdForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="new_password" label="新密码" rules={[{ required: true, min: 6 }]}>
            <Input.Password placeholder="至少6位" />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  )
}
