import { useState, useEffect } from 'react'
import { NavBar, List, DotLoading, Empty, Tag } from 'antd-mobile'
import { listWritingDrafts, parseDate } from '../api'
import { useNavigate } from 'react-router-dom'

const TEMPLATE_LABELS = {
  thought_report: '思想汇报',
  annual_summary: '年度总结',
  self_review: '自我评价',
  party_application: '入党申请书',
  lesson_reflection: '党课心得',
  work_report: '工作总结',
}

export default function WritingDraftsPage() {
  const navigate = useNavigate()
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    listWritingDrafts().then(data => {
      setDrafts(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  if (selected) {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={() => setSelected(null)} style={{ background: '#d32f2f', color: '#fff' }}>草稿详情</NavBar>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            {selected.created_at ? parseDate(selected.created_at).toLocaleString('zh-CN') : ''}
          </div>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 16, background: '#fff', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 500, marginBottom: 6 }}>你的输入</div>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.user_input}</div>
          </div>
          {selected.ai_draft && (
            <div style={{ background: '#fff', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 500, marginBottom: 6, color: '#d32f2f' }}>AI 生成</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{selected.ai_draft}</div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>写作草稿</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : drafts.length === 0 ? (
        <Empty description="暂无写作草稿" style={{ marginTop: 60 }} />
      ) : (
        <List style={{ margin: '12px 0' }}>
          {drafts.map(d => (
            <List.Item key={d.id} onClick={() => setSelected(d)} clickable
              arrow={null} extra={<span style={{ fontSize: 22, color: '#ccc' }}>›</span>}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{d.user_input}</span>
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {d.created_at ? parseDate(d.created_at).toLocaleString('zh-CN') : ''}
                {d.status === 'draft' && <Tag color="default" style={{ marginLeft: 8, fontSize: 10 }}>草稿</Tag>}
              </div>
            </List.Item>
          ))}
        </List>
      )}
    </div>
  )
}
