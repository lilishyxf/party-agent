import { useLocation, useNavigate } from 'react-router-dom'
import { Breadcrumb, Card, Empty } from 'antd'

const SUB_ITEMS = [
  { key: 'overview', label: '总览' },
  { key: 'structure', label: '党员结构' },
  { key: 'study-data', label: '学习数据' },
  { key: 'activity-data', label: '活动数据' },
]

export default function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const subKey = pathParts[1] || 'overview'

  const activeItem = SUB_ITEMS.find(s => s.key === subKey) || SUB_ITEMS[0]

  // Route to first sub-item on mount
  if (!pathParts[1]) {
    navigate('/dashboard/overview', { replace: true })
    return null
  }

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '可视化' }, { title: activeItem.label }]} />

      <Card style={{ borderRadius: 10 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          padding: 12,
        }}>
          {/* Placeholder charts */}
          {[
            { title: '学历结构（雷达图）', color: '#d32f2f' },
            { title: '年龄结构（柱状图）', color: '#e65100' },
            { title: '党员分布（饼图）', color: '#c62828' },
            { title: '学习时长趋势（折线图）', color: '#6a1b9a' },
          ].map((c, i) => (
            <Card key={i} size="small" style={{ borderRadius: 8, background: '#fafafa' }}
              title={<span style={{ fontSize: 13, color: '#666' }}>{c.title}</span>}>
              <div style={{
                height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: c.color, fontSize: 48, fontWeight: 100, opacity: 0.3,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#999', marginBottom: 4 }}>Mock 数据</div>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', border: `3px solid ${c.color}`, margin: '0 auto', opacity: 0.5 }} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div style={{ marginTop: 12 }}>
          <Card size="small" style={{ borderRadius: 8, background: '#fafafa' }}
            title={<span style={{ fontSize: 13, color: '#666' }}>活动参与率（柱状图）</span>}>
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              <Empty description="Mock 数据 — 后续接入 recharts" />
            </div>
          </Card>
        </div>
      </Card>
    </div>
  )
}
