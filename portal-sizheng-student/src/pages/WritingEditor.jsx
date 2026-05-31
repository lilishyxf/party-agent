import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { NavBar, Button, TextArea, Card, SpinLoading, Toast } from 'antd-mobile'
import { sendMessage, saveWritingDraft, generateWriting } from '../api'
import { WRITING_TYPES } from './WritingPage'

export default function WritingEditor() {
  const navigate = useNavigate()
  const { type } = useParams()
  const writingType = WRITING_TYPES.find(t => t.key === type)

  if (!writingType) {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={() => navigate('/writing')} style={{ background: '#d32f2f', color: '#fff' }}>写作辅助</NavBar>
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>未知写作类型</div>
      </div>
    )
  }
  const [userInput, setUserInput] = useState('')
  const [aiDraft, setAiDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    if (!userInput.trim()) {
      Toast.show({ icon: 'fail', content: '请先填写要点' })
      return
    }
    setLoading(true)
    try {
      const draft = await generateWriting(writingType.key, userInput)
      setAiDraft(draft)
    } catch (e) {
      Toast.show({ icon: 'fail', content: e.message || '生成失败，请重试' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!aiDraft.trim()) return
    setSaving(true)
    try {
      await saveWritingDraft(null, writingType.key, userInput, aiDraft)
      Toast.show({ icon: 'success', content: '已保存草稿' })
    } catch {
      Toast.show({ icon: 'fail', content: '保存失败' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 24 }}>
      <NavBar onBack={() => navigate('/writing')} style={{ background: '#d32f2f', color: '#fff' }}>
        {writingType.title}
      </NavBar>

      <div style={{ padding: '12px 12px' }}>
        {/* 大纲参考 */}
        <Card style={{ borderRadius: 10, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            {writingType.icon}
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>{writingType.title}</div>
              <div style={{ fontSize: 12, color: '#999' }}>{writingType.desc}</div>
            </div>
          </div>
          <div style={{ background: '#fafafa', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>模板大纲（参考）</div>
            {writingType.outline.map((o, i) => (
              <div key={i} style={{ fontSize: 13, color: '#555', lineHeight: 1.8, paddingLeft: 8 }}>
                {i + 1}. {o}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: '#c62828', background: '#fff5f5', borderRadius: 6, padding: '8px 10px', marginTop: 10 }}>
            {writingType.tips}
          </div>
        </Card>

        {/* 输入区 */}
        <Card style={{ borderRadius: 10, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8 }}>
            输入你的要点
          </div>
          <TextArea
            placeholder="把你的想法、要点、具体事例写在这里，AI 会据此生成初稿..."
            rows={5}
            value={userInput}
            onChange={setUserInput}
            style={{ fontSize: 14, lineHeight: 1.6 }}
          />
          <Button
            block
            color="danger"
            onClick={handleGenerate}
            loading={loading}
            style={{ borderRadius: 8, marginTop: 12, height: 40 }}
          >
            {loading ? 'AI 生成中...' : 'AI 生成初稿'}
          </Button>
        </Card>

        {/* 生成结果 */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 30 }}>
            <SpinLoading color="#d32f2f" style={{ '--size': '36px' }} />
            <div style={{ fontSize: 13, color: '#999', marginTop: 10 }}>AI 正在撰写，请稍候...</div>
          </div>
        )}

        {aiDraft && (
          <Card style={{ borderRadius: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>AI 初稿</div>
              <Button
                size="small"
                color="danger"
                fill="none"
                onClick={handleSave}
                loading={saving}
              >
                保存草稿
              </Button>
            </div>
            <div style={{
              background: '#fafafa', borderRadius: 8, padding: 12,
              fontSize: 14, color: '#333', lineHeight: 1.8,
              whiteSpace: 'pre-wrap', maxHeight: 400, overflowY: 'auto',
            }}>
              {aiDraft}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
