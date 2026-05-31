import { useState, useEffect, useCallback } from 'react'
import { NavBar, List, Tag, DotLoading, Empty, InfiniteScroll } from 'antd-mobile'
import { getLearningRecords, parseDate } from '../api'
import { useNavigate } from 'react-router-dom'

const TYPE_MAP = { material: '材料', task: '任务', exam: '考试' }
const TYPE_COLORS = { material: 'primary', task: 'warning', exam: 'success' }

export default function LearningRecordsPage() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadMore = useCallback(async () => {
    try {
      const data = await getLearningRecords(null, page)
      const list = data.list || []
      setRecords(prev => [...prev, ...list])
      setHasMore(list.length >= 20)
      setPage(p => p + 1)
    } catch { setHasMore(false) }
    setLoading(false)
  }, [page])

  useEffect(() => { loadMore() }, [])

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>学习档案</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : records.length === 0 ? (
        <Empty description="暂无学习记录" style={{ marginTop: 60 }} />
      ) : (
        <>
          <div style={{ padding: '12px 12px 0', fontSize: 13, color: '#999' }}>
            共 {records.length} 条记录
          </div>
          <List style={{ margin: '12px 0' }}>
            {records.map((r, i) => (
              <List.Item key={i} clickable={false}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Tag color={TYPE_COLORS[r.type]} style={{ fontSize: 11, flexShrink: 0 }}>
                    {TYPE_MAP[r.type]}
                  </Tag>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{r.title}</span>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 4, marginLeft: 4 }}>
                  {r.detail} · {r.created_at ? parseDate(r.created_at).toLocaleString('zh-CN') : ''}
                </div>
              </List.Item>
            ))}
          </List>
          <InfiniteScroll loadMore={loadMore} hasMore={hasMore} />
        </>
      )}
    </div>
  )
}
