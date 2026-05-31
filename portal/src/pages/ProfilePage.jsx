import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Card, DotLoading, Button, Toast } from 'antd-mobile'
import { TeamOutline, StarOutline, CheckCircleOutline } from 'antd-mobile-icons'
import { getMemberStats, unbindMember, parseDate } from '../api'

export default function ProfilePage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    getMemberStats().then(data => {
      if (data && !data.error) {
        setStats(data)
      }
      setLoading(false)
    }).catch(() => {
      setFetchError(true)
      setLoading(false)
    })
  }, [])

  const handleUnbind = async () => {
    if (!window.confirm('确定要退出并解绑当前身份吗？')) return
    try {
      const res = await unbindMember()
      if (res.status === 'ok') {
        localStorage.removeItem('portal_openid')
        setStats(null)
        setFetchError(false)
        Toast.show({ icon: 'success', content: '已退出' })
      } else {
        Toast.show({ icon: 'fail', content: res.message || '操作失败' })
      }
    } catch { Toast.show({ icon: 'fail', content: '网络错误' }) }
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>个人中心</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : stats && !stats.error ? (
        <>
          {/* 个人信息卡片 */}
          <div style={{ background: 'linear-gradient(135deg, #c62828, #d32f2f)', padding: '24px 20px', color: '#fff' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10,
            }}>
              <TeamOutline style={{ fontSize: 24 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{stats.name}</div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>{stats.branch}</div>
          </div>

          {/* 数据概览 */}
          <div style={{ display: 'flex', margin: '12px 12px', gap: 10 }}>
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
              <StarOutline style={{ fontSize: 22, color: '#d32f2f' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#d32f2f', margin: '4px 0' }}>{stats.total_points}</div>
              <div style={{ fontSize: 12, color: '#999' }}>总积分</div>
            </div>
            <div style={{ flex: 1, background: '#fff', borderRadius: 10, padding: '14px 10px', textAlign: 'center' }}>
              <CheckCircleOutline style={{ fontSize: 22, color: '#d32f2f' }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: '#d32f2f', margin: '4px 0' }}>{stats.learn_count}</div>
              <div style={{ fontSize: 12, color: '#999' }}>学习次数</div>
            </div>
          </div>

          {/* 快捷入口 */}
          <div style={{ padding: '0 12px', marginTop: 12 }}>
            <Card style={{ borderRadius: 10, marginBottom: 10 }}
              onClick={() => navigate('/learning-records')}
              bodyStyle={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>学习档案</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>查看全部学习记录</div>
              </div>
              <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
            </Card>
            <Card style={{ borderRadius: 10, marginBottom: 10 }}
              onClick={() => navigate('/exam-history')}
              bodyStyle={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>考试记录</div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>查看历史考试成绩</div>
              </div>
              <span style={{ color: '#bbb', fontSize: 18 }}>›</span>
            </Card>
          </div>

          {/* 最近学习记录 */}
          <div style={{ padding: '0 12px' }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 8 }}>最近学习</div>
            {stats.recent.length > 0 ? stats.recent.map((r, i) => (
              <Card key={i} style={{ borderRadius: 8, marginBottom: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, color: '#333' }}>{r.action}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{r.detail}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#bbb' }}>
                    {parseDate(r.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </Card>
            )) : (
              <div style={{ textAlign: 'center', color: '#ccc', padding: 20 }}>暂无学习记录</div>
            )}
          </div>
          {/* 退出解绑 */}
          <div style={{ padding: '0 12px', marginTop: 20, marginBottom: 30 }}>
            <Button block color="default" onClick={handleUnbind}>
              退出解绑
            </Button>
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 40 }}>
          {fetchError ? (
            <>
              <div style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>加载失败，请检查网络</div>
              <Button color="default" onClick={() => { setFetchError(false); setLoading(true); getMemberStats().then(d => { if (d && !d.error) setStats(d); setLoading(false); }).catch(() => { setFetchError(true); setLoading(false); }) }}>重试</Button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 14, color: '#999', marginBottom: 20 }}>尚未绑定党员身份</div>
              <Button color="danger" onClick={() => navigate('/bind')}>去绑定</Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
