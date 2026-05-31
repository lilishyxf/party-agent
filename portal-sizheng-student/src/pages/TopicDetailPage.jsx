import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NavBar, Card, DotLoading, Tag, Toast, Button } from 'antd-mobile'
import { FileOutline, TextOutline } from 'antd-mobile-icons'
import { fetchTopicDetail, signOffTask } from '../api'


const typeLabel = { text: '文章', video: '视频', file: '文件', reading: '阅读' }

export default function TopicDetailPage() {
  const navigate = useNavigate()
  const { topicId } = useParams()
  const [topic, setTopic] = useState(null)
  const [loading, setLoading] = useState(true)
  const [signingId, setSigningId] = useState(null)

  useEffect(() => {
    fetchTopicDetail(topicId)
      .then(data => { setTopic(data); setLoading(false) })
      .catch(() => { Toast.show({ icon: 'fail', content: '加载失败' }); setLoading(false) })
  }, [topicId])

  const handleSign = async (taskId) => {
    setSigningId(taskId)
    try {
      const res = await signOffTask(taskId, null)
      if (res.status === 'ok') {
        Toast.show({ icon: 'success', content: '签收成功' })
      } else {
        Toast.show({ icon: 'fail', content: res.message || '操作失败' })
      }
    } catch {
      Toast.show({ icon: 'fail', content: '网络错误' })
    } finally { setSigningId(null) }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#fff' }}>专题详情</NavBar>
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      </div>
    )
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 24 }}>
      <NavBar onBack={() => navigate('/topics')} style={{ background: '#fff' }}>{topic?.title || '专题详情'}</NavBar>

      {topic?.description && (
        <Card style={{ margin: '12px', borderRadius: 10 }}>
          <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6 }}>{topic.description}</div>
        </Card>
      )}

      {topic?.items?.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 60 }}>暂无内容</div>
      ) : (
        <div style={{ padding: '0 12px' }}>
          {topic?.items?.map((item, i) => (
            <Card key={item.id} style={{ borderRadius: 10, marginBottom: 8, background: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Tag color={item.item_type === 'material' ? 'primary' : 'warning'} style={{ flexShrink: 0 }}>
                  {item.item_type === 'material' ? '材料' : '任务'}
                </Tag>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ fontSize: 15, fontWeight: 600, color: '#333',
                      cursor: item.item_type === 'material' && item.url ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (item.item_type === 'material' && item.url) window.open(item.url)
                    }}
                  >
                    {item.title}
                  </div>
                  {item.description && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.description}
                    </div>
                  )}
                </div>
                {item.item_type === 'material' && item.type && (
                  <Tag style={{ fontSize: 11 }}>{typeLabel[item.type] || item.type}</Tag>
                )}
                {item.item_type === 'task' && (
                  <Button size="small" color="primary" loading={signingId === item.item_id}
                    onClick={() => handleSign(item.item_id)} style={{ borderRadius: 6, fontSize: 12, flexShrink: 0 }}>
                    签收
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
