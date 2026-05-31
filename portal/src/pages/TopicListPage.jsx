import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Card, DotLoading, Tag } from 'antd-mobile'
import { RightOutline } from 'antd-mobile-icons'
import { fetchTopics } from '../api'

export default function TopicListPage() {
  const navigate = useNavigate()
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTopics()
      .then(data => { setTopics(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 24 }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>专题学习</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : topics.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 60 }}>暂无专题</div>
      ) : (
        <div style={{ padding: 12 }}>
          {topics.map(t => (
            <Card
              key={t.id}
              style={{ borderRadius: 10, marginBottom: 10, cursor: 'pointer', background: '#fff' }}
              onClick={() => navigate('/topics/' + t.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 10, background: '#d32f2f',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 20, fontWeight: 700, flexShrink: 0,
                }}>
                  {t.title.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.description || '暂无简介'}
                  </div>
                </div>
                <RightOutline style={{ color: '#ccc', fontSize: 14 }} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
