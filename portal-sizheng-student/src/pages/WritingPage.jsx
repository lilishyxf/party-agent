import { useNavigate } from 'react-router-dom'
import { NavBar, Card } from 'antd-mobile'
import {
  ContentOutline, StarOutline, UserOutline,
  EditSOutline, HeartOutline, AppOutline, RightOutline,
} from 'antd-mobile-icons'

export const WRITING_TYPES = [
  {
    key: 'thought_report',
    title: '思想汇报',
    icon: <HeartOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '定期向党组织汇报个人思想动态、学习感悟和实际表现。',
    outline: ['思想政治学习情况', '对党的路线方针政策的认识', '本人在学习/工作中的表现', '存在不足与改进方向'],
    tips: '结合近期参加的党内活动、学习内容来写，要有具体事例，避免空话套话。',
  },
  {
    key: 'annual_summary',
    title: '年度总结',
    icon: <ContentOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '对一年来思想政治、学习工作进行全面回顾和总结。',
    outline: ['思想政治表现', '履行党员义务情况', '学业/工作成绩', '先锋模范作用发挥', '存在不足及努力方向'],
    tips: '用数据和事实说话，既要肯定成绩也要敢于剖析问题。',
  },
  {
    key: 'self_review',
    title: '民主评议自评',
    icon: <UserOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '民主评议党员时对自己的全面评价和党性分析。',
    outline: ['思想政治学习收获', '遵守党纪法规情况', '发挥先锋模范作用', '主要差距和不足', '今后努力方向'],
    tips: '对照党员标准和入党誓词逐条检查，不回避问题。',
  },
  {
    key: 'party_application',
    title: '入党申请书',
    icon: <StarOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '向党组织表达入党意愿和决心的正式文书。',
    outline: ['对党的认识和入党动机', '个人经历和成长过程', '对自身优缺点的认识', '入党后的决心和态度'],
    tips: '态度要诚恳，对党的认识要真实，不能照搬党章条文。',
  },
  {
    key: 'lesson_reflection',
    title: '党课心得',
    icon: <EditSOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '参加党课学习后的心得体会，深化理论认识。',
    outline: ['党课主题及主要内容', '个人的理解和感悟', '联系实际工作/学习的思考', '今后如何践行所学'],
    tips: '不要复述党课内容，重点是"你的感悟"和"你将怎么做"。',
  },
  {
    key: 'work_report',
    title: '述职报告',
    icon: <AppOutline style={{ fontSize: 36, color: '#d32f2f' }} />,
    desc: '支部书记或支委向党员大会报告履职情况。',
    outline: ['履职基本情况', '主要工作成效', '存在的主要问题', '下一步工作思路'],
    tips: '围绕岗位职责来写，突出党建工作的重点和亮点。',
  },
]

export default function WritingPage() {
  const navigate = useNavigate()
  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 24 }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>写作辅助</NavBar>

      <div style={{ padding: '16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingLeft: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>请选择写作类型</div>
          <span onClick={() => navigate('/writing-drafts')} style={{ fontSize: 13, color: '#d32f2f', cursor: 'pointer' }}>查看草稿 ›</span>
        </div>
        <div style={{ fontSize: 13, color: '#999', marginBottom: 14, paddingLeft: 4 }}>
          AI 将根据你提供的要点，按模板结构生成初稿
        </div>

        {WRITING_TYPES.map(t => (
          <Card key={t.key} style={{ borderRadius: 12, marginBottom: 12, background: '#fff' }}>
            <div onClick={() => navigate('/writing/' + t.key)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                {t.icon}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 600, color: '#333' }}>{t.title}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{t.desc}</div>
                </div>
                <RightOutline style={{ color: '#ccc' }} />
              </div>
              <div style={{ background: '#fafafa', borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>模板大纲</div>
                {t.outline.map((o, i) => (
                  <div key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.8, paddingLeft: 8 }}>
                    {i + 1}. {o}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: '#c62828', background: '#fff5f5', borderRadius: 6, padding: '8px 10px' }}>
                💡 {t.tips}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
