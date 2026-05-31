import { Card, Row, Col, Breadcrumb } from 'antd'
import { DollarOutlined, HeartOutlined, TeamOutlined, FileProtectOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

const SERVICES = [
  { key: 'dues', label: '党费收缴', icon: <DollarOutlined style={{ fontSize: 32 }} />, color: '#d32f2f', desc: '记录党员每月党费缴纳情况，支持按年/月筛选' },
  { key: 'assistance', label: '困难党员帮扶', icon: <HeartOutlined style={{ fontSize: 32 }} />, color: '#e65100', desc: '记录对困难党员的慰问帮扶信息' },
  { key: 'volunteer', label: '志愿服务记录', icon: <TeamOutlined style={{ fontSize: 32 }} />, color: '#1976d2', desc: '记录党员参与的志愿活动及服务时长' },
]

export default function PartyServicePage() {
  const navigate = useNavigate()

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '服务中心' }, { title: '党员服务' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <FileProtectOutlined style={{ fontSize: 28, color: '#d32f2f' }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>服务中心</span>
        </div>
        <Row gutter={[16, 16]}>
          {SERVICES.map(s => (
            <Col span={8} key={s.key}>
              <Card hoverable onClick={() => navigate(`/service/${s.key}`)} style={{ borderRadius: 10, height: '100%' }}>
                <div style={{ textAlign: 'center', color: s.color, marginBottom: 12 }}>{s.icon}</div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#333', marginBottom: 8, textAlign: 'center' }}>{s.label}</div>
                <div style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>{s.desc}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>
    </div>
  )
}
