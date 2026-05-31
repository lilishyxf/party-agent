import { useNavigate } from 'react-router-dom'
import { NavBar, Card, Space } from 'antd-mobile'
import { MessageFill, CheckCircleOutline, EditSOutline, TeamOutline, AppOutline, UnorderedListOutline } from 'antd-mobile-icons'

const features = [
  {
    key: 'qa',
    title: '智能问答',
    desc: '输入党务问题，AI 基于党建知识库即时作答，支持引用原文出处。',
    icon: <MessageFill style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'learning',
    title: '学习资源',
    desc: '书记推送的党章党纪、时政方针、党史等分类学习材料，随时查阅。',
    icon: <AppOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'topics',
    title: '专题学习',
    desc: '书记打包的专题学习路径，按顺序浏览材料、完成学习任务。',
    icon: <AppOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'test',
    title: '自测练习',
    desc: '按专题随机出题、计时作答、错题回顾，巩固党务应知应会知识。',
    icon: <CheckCircleOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'writing',
    title: '写作辅助',
    desc: '思想汇报、年度总结等党建材料 AI 辅助撰写，提供模板与智能润色。',
    icon: <EditSOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'tasks',
    title: '任务中心',
    desc: '查看书记下发的学习任务，确认签收，按时完成。',
    icon: <UnorderedListOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
  {
    key: 'notices',
    title: '通知公告',
    desc: '查看党支部发布的通知公告，及时了解支部动态。',
    icon: <MessageFill style={{ fontSize: 32, color: '#1976d2' }} />,
    color: '#f5f8ff',
  },
  {
    key: 'profile',
    title: '个人中心',
    desc: '查看学习记录、积分统计与历史问答，掌握自己的学习进度。',
    icon: <TeamOutline style={{ fontSize: 32, color: '#d32f2f' }} />,
    color: '#fff5f5',
  },
]

export default function HomePage() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      {/* 头部 */}
      <div style={{
        background: 'linear-gradient(135deg, #c62828, #d32f2f)',
        padding: '32px 20px 28px',
        color: '#fff',
        textAlign: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 12px', fontSize: 28,
        }}>
          <TeamOutline style={{ fontSize: 28 }} />
        </div>
        <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: 1 }}>党务 AI 助手</div>
        <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>计算机科学与工程学院</div>
      </div>

      {/* 功能卡片 */}
      <div style={{ padding: '16px 12px' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#333', marginBottom: 12, paddingLeft: 4 }}>
          请选择您需要的服务
        </div>
        <Space direction="vertical" block style={{ gap: 12 }}>
          {features.map(f => (
            <Card
              key={f.key}
              onClick={() => navigate('/' + f.key)}
              style={{ borderRadius: 12, cursor: 'pointer', background: f.color }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {f.icon}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 4 }}>{f.title}</div>
                  <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>{f.desc}</div>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      </div>

      {/* 底部 */}
      <div style={{ textAlign: 'center', padding: 24, fontSize: 12, color: '#bbb' }}>
        西安工业大学 · 计算机科学与工程学院
      </div>
    </div>
  )
}
