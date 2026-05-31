import { useState, useEffect } from 'react'
import { NavBar, List, Tag, DotLoading, Empty } from 'antd-mobile'
import { getExamHistory, parseDate } from '../api'
import { useNavigate } from 'react-router-dom'

export default function ExamHistoryPage() {
  const navigate = useNavigate()
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getExamHistory().then(data => {
      setExams(data.exams || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>考试历史</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : exams.length === 0 ? (
        <Empty description="暂无考试记录" style={{ marginTop: 60 }} />
      ) : (
        <List style={{ margin: '12px 0' }}>
          {exams.map(e => (
            <List.Item key={e.assignment_id}
              clickable={false}
              extra={
                <span style={{ fontWeight: 600, fontSize: 16, color: e.passed ? '#2e7d32' : '#d32f2f' }}>
                  {e.score ?? '-'}分
                </span>
              }>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 500 }}>{e.title}</span>
                <Tag color={e.passed ? 'success' : 'danger'} style={{ fontSize: 11 }}>
                  {e.passed ? '通过' : '未通过'}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                {e.submitted_at ? parseDate(e.submitted_at).toLocaleString('zh-CN') : ''} · {e.question_count}题 · 及格线{e.pass_score}分
              </div>
            </List.Item>
          ))}
        </List>
      )}
    </div>
  )
}
