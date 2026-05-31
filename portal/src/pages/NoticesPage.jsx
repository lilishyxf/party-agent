import { useState, useEffect } from 'react'
import { NavBar, List, DotLoading, Empty, InfiniteScroll } from 'antd-mobile'
import { fetchPortalNotices, parseDate } from '../api'
import { useNavigate } from 'react-router-dom'

export default function NoticesPage() {
  const navigate = useNavigate()
  const [notices, setNotices] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const loadMore = async () => {
    try {
      const data = await fetchPortalNotices(page)
      const items = data.items || []
      setNotices(prev => [...prev, ...items])
      setHasMore(items.length >= 20)
      setPage(p => p + 1)
    } catch { setHasMore(false) }
    setLoading(false)
  }

  useEffect(() => { loadMore() }, [])

  if (selected) {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={() => setSelected(null)} style={{ background: '#d32f2f', color: '#fff' }}>通知详情</NavBar>
        <div style={{ padding: 16 }}>
          <h2 style={{ fontSize: 18, color: '#333', marginBottom: 8 }}>{selected.title}</h2>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>
            {selected.published_at ? parseDate(selected.published_at).toLocaleString('zh-CN') : ''}
          </div>
          <div style={{ fontSize: 14, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>通知公告</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : notices.length === 0 ? (
        <Empty description="暂无通知" style={{ marginTop: 60 }} />
      ) : (
        <List style={{ margin: '12px 0' }}>
          {notices.map(n => (
            <List.Item key={n.id} onClick={() => setSelected(n)} clickable
              arrow={null} extra={<span style={{ fontSize: 22, color: '#ccc' }}>›</span>}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {n.published_at ? parseDate(n.published_at).toLocaleString('zh-CN') : ''}
              </div>
            </List.Item>
          ))}
          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
        </List>
      )}
    </div>
  )
}
