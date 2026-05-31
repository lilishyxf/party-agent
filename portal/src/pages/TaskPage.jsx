import { useState, useEffect } from 'react'
import { NavBar, Card, Button, Tag, Toast, DotLoading, Space } from 'antd-mobile'
import { getMyTasks, signOffTask, parseDate } from '../api'
import ExamPage from './ExamPage'
import { useNavigate } from 'react-router-dom'


const statusMap = {
  pending: { text: '待完成', color: '#ff6b35' },
  completed: { text: '已完成', color: '#52c41a' },
}

export default function TaskPage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [signingId, setSigningId] = useState(null)
  const [activeExamId, setActiveExamId] = useState(null)
  const [reviewExamId, setReviewExamId] = useState(null)

  const fetchTasks = async () => {
    setLoading(true)
    try {
      const data = await getMyTasks(null)
      setTasks(Array.isArray(data) ? data : [])
    } catch { setTasks([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTasks() }, [])

  const handleSign = async (assignmentId) => {
    setSigningId(assignmentId)
    try {
      const res = await signOffTask(assignmentId, null)
      if (res.status === 'ok') {
        Toast.show({ icon: 'success', content: '签收成功' })
        setTasks(prev => prev.map(t =>
          t.assignment_id === assignmentId ? { ...t, status: 'completed', completed_at: new Date().toISOString() } : t
        ))
      } else {
        Toast.show({ icon: 'fail', content: res.message || '操作失败' })
      }
    } catch {
      Toast.show({ icon: 'fail', content: '网络错误，请重试' })
    } finally { setSigningId(null) }
  }

  const handleStartExam = (examId) => { setActiveExamId(examId) }
  const handleViewResult = (examId) => { setReviewExamId(examId) }

  if (activeExamId) {
    return <ExamPage onBack={() => { setActiveExamId(null); fetchTasks() }} examId={activeExamId} />
  }

  if (reviewExamId) {
    return <ExamPage onBack={() => { setReviewExamId(null); fetchTasks() }} examId={reviewExamId} reviewMode />
  }

  const pendingTasks = tasks.filter(t => t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed')

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>任务中心</NavBar>

      <div style={{ padding: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <DotLoading color="primary" />
            <div style={{ color: '#999', marginTop: 8, fontSize: 13 }}>加载中...</div>
          </div>
        ) : tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#999', fontSize: 13 }}>
            暂无任务
          </div>
        ) : (
          <Space direction="vertical" block style={{ gap: 10 }}>
            {pendingTasks.length > 0 && (
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', paddingLeft: 4 }}>
                待完成 ({pendingTasks.length})
              </div>
            )}
            {pendingTasks.map(t => (
              <Card key={`${t.type || 'task'}-${t.assignment_id}`} style={{ borderRadius: 10, background: '#fff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, marginRight: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 6 }}>
                      {t.title}
                    </div>
                    {t.description && (
                      <div style={{ fontSize: 13, color: '#666', marginBottom: 8, lineHeight: 1.5 }}>
                        {t.description}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <Tag color={statusMap[t.status]?.color} style={{ fontSize: 11 }}>
                        {statusMap[t.status]?.text || t.status}
                      </Tag>
                      {t.deadline && (
                        <span style={{ fontSize: 11, color: '#999' }}>
                          截止: {parseDate(t.deadline).toLocaleDateString('zh-CN')}
                        </span>
                      )}
                    </div>
                  </div>
                  {t.type === 'exam' ? (
                    <Button
                      size="small"
                      color="danger"
                      onClick={() => handleStartExam(t.ref_id)}
                      style={{ borderRadius: 6, fontSize: 12, flexShrink: 0 }}
                    >去考试</Button>
                  ) : (
                    <Button
                      size="small"
                      color="primary"
                      loading={signingId === t.assignment_id}
                      onClick={() => handleSign(t.assignment_id)}
                      style={{ borderRadius: 6, fontSize: 12, flexShrink: 0 }}
                    >签收</Button>
                  )}
                </div>
              </Card>
            ))}

            {completedTasks.length > 0 && (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#333', paddingLeft: 4, marginTop: 8 }}>
                  已完成 ({completedTasks.length})
                </div>
                {completedTasks.map(t => (
                  <Card key={`${t.type || 'task'}-${t.assignment_id}`} style={{ borderRadius: 10, background: '#f9fff9' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, marginRight: 12 }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: '#999', marginBottom: 6 }}>
                          {t.title}
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <Tag color={statusMap.completed.color} style={{ fontSize: 11 }}>
                            已完成
                          </Tag>
                          {t.type === 'exam' && t.score !== undefined && (
                            <Tag color={t.score >= 60 ? 'success' : 'danger'} style={{ fontSize: 11 }}>
                              {t.score}分
                            </Tag>
                          )}
                          {t.completed_at && (
                            <span style={{ fontSize: 11, color: '#999' }}>
                              完成于: {parseDate(t.completed_at).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </div>
                      </div>
                      {t.type === 'exam' && (
                        <Button
                          size="small"
                          fill="outline"
                          onClick={() => handleViewResult(t.ref_id)}
                          style={{ borderRadius: 6, fontSize: 12, flexShrink: 0 }}
                        >查看成绩</Button>
                      )}
                    </div>
                  </Card>
                ))}
              </>
            )}
          </Space>
        )}
      </div>
    </div>
  )
}
