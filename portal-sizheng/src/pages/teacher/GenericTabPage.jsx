import { useLocation, useNavigate } from 'react-router-dom'
import { Breadcrumb, Card, Empty, Button, Input } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { TABS, SIDE_MENUS, TAB_LABELS } from '../../layouts/tabConfig.jsx'

export default function GenericTabPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const pathParts = location.pathname.split('/').filter(Boolean)
  const tabKey = pathParts[0]
  const subKey = pathParts[1]

  const tab = TABS.find(t => t.key === tabKey)
  const tabLabel = TAB_LABELS[tabKey] || tab?.label || tabKey
  const menuItems = SIDE_MENUS[tabKey] || []
  const activeSub = menuItems.find(m => m.key === subKey)

  // If no sub-key selected, show placeholder (waiting for side-menu click)
  if (!subKey || !activeSub) {
    return (
      <div>
        <Breadcrumb style={{ marginBottom: 12 }}
          items={[{ title: tabLabel }]} />
        <Card style={{ borderRadius: 10 }}>
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Empty description={`${tabLabel} — 请从左侧菜单选择具体功能`} />
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      {/* Breadcrumb */}
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[
          { title: <a onClick={() => navigate(`/${tabKey}`)}>{tabLabel}</a> },
          { title: activeSub.label },
        ]} />

      {/* Toolbar */}
      <Card style={{ borderRadius: 10, marginBottom: 12 }}
        bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <Input.Search placeholder="搜索..." prefix={<SearchOutlined />}
              style={{ width: 240, borderRadius: 6 }} allowClear />
          </div>
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
            新增
          </Button>
        </div>
      </Card>

      {/* Content placeholder */}
      <Card style={{ borderRadius: 10 }}>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Empty description={
            <span>
              <strong>{activeSub.label}</strong> — 功能开发中
              <br />
              <span style={{ color: '#999', fontSize: 12 }}>
                当前为 UI 空壳，后续将接入真实数据和操作
              </span>
            </span>
          } />
        </div>
      </Card>
    </div>
  )
}
