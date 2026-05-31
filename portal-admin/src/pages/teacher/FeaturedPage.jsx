import { Card } from 'antd'
import { useNavigate } from 'react-router-dom'

export default function FeaturedPage() {
  const navigate = useNavigate()
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 600, color: '#333', marginBottom: 16 }}>
        特色党建
      </div>
      <Card style={{ borderRadius: 10 }}>
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <div style={{ fontSize: 16, marginBottom: 8 }}>特色党建板块</div>
          <div style={{ fontSize: 13 }}>具体内容待明确后完善</div>
        </div>
      </Card>
    </div>
  )
}
