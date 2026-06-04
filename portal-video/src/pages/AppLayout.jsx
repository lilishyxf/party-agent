import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Button, Space, Dropdown, Avatar } from 'antd'
import { VideoCameraOutlined, PlusOutlined, HistoryOutlined, LogoutOutlined, UserOutlined } from '@ant-design/icons'
import { useAuth } from '../services/AuthContext'

const { Header, Content } = Layout

const MENU_ITEMS = [
  { key: '/create', icon: <PlusOutlined />, label: '创建视频' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史项目' },
]

export default function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  const currentPath = '/' + location.pathname.split('/')[1] || '/create'

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        padding: '0 24px', height: 56,
      }}>
        <Space style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <VideoCameraOutlined style={{ fontSize: 24, color: '#fff' }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: '#fff' }}>
            教学思政AI视频引擎
          </span>
        </Space>

        <Space>
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[currentPath]}
            items={MENU_ITEMS}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', borderBottom: 'none' }}
          />
          <Dropdown menu={{
            items: [
              { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', onClick: handleLogout },
            ]
          }}>
            <Space style={{ cursor: 'pointer', color: '#fff' }}>
              <Avatar size="small" icon={<UserOutlined />} />
              <span>{user?.username || '管理员'}</span>
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <Content style={{ padding: 24, maxWidth: 1400, margin: '0 auto', width: '100%' }}>
        <Outlet />
      </Content>
    </Layout>
  )
}
