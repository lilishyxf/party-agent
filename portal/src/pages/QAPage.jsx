import { useState, useRef, useEffect } from 'react'
import { NavBar, Input, Button, DotLoading, Toast } from 'antd-mobile'
import { sendMessage } from '../api'
import { useNavigate } from 'react-router-dom'

const QUICK_QUESTIONS = [
  '如何撰写思想汇报？',
  '发展党员有哪些流程？',
  '什么是"三会一课"？',
  '主题党日活动怎么开展？',
]

const WELCOME = { role: 'assistant', content: '你好！我是党务 AI 助手，请直接输入你想了解的党务问题，或点击下方快捷问题快速开始。' }

export default function QAPage() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const doSend = async (q) => {
    if (!q || loading) return
    setInput('')
    const now = new Date()
    setMessages(prev => [...prev, { role: 'user', content: q, time: now }])
    setLoading(true)
    try {
      const data = await sendMessage(q, conversationId)
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer, time: new Date() }])
      if (data.conversation_id) setConversationId(data.conversation_id)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，服务暂时不可用，请稍后再试。', time: new Date() }])
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text)
    Toast.show({ content: '已复制', duration: 1000 })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f5f5f5' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>
        智能问答
      </NavBar>
      <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column',
            alignItems: m.role === 'user' ? 'flex-end' : 'flex-start',
            marginBottom: 12,
          }}>
            <div style={{
              maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? '#d32f2f' : '#fff',
              color: m.role === 'user' ? '#fff' : '#333',
              fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-wrap',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              borderBottomRightRadius: m.role === 'user' ? 4 : 12,
              borderBottomLeftRadius: m.role === 'assistant' ? 4 : 12,
            }}>{m.content}</div>
            {m.time && (
              <div style={{ fontSize: 10, color: '#bbb', marginTop: 3, padding: '0 4px' }}>
                {m.time.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            {m.role === 'assistant' && m !== messages[0] && (
              <Button fill="none" size="mini"
                onClick={() => handleCopy(m.content)}
                style={{ fontSize: 10, color: '#bbb', padding: 0, marginTop: 2 }}>
                复制
              </Button>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', padding: 8 }}>
            <DotLoading color="#d32f2f" /> 思考中...
          </div>
        )}
      </div>

      {/* 快捷问题 */}
      {messages.length <= 1 && (
        <div style={{ padding: '0 12px 8px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {QUICK_QUESTIONS.map((q, i) => (
            <div key={i} onClick={() => doSend(q)} style={{
              background: '#fff', borderRadius: 14, padding: '5px 12px',
              fontSize: 12, color: '#d32f2f', border: '1px solid #ffcdd2',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}>{q}</div>
          ))}
        </div>
      )}

      <div style={{ padding: '8px 12px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', gap: 8 }}>
        <Input
          value={input}
          onChange={setInput}
          placeholder="输入党务问题..."
          onEnterPress={() => doSend(input)}
          style={{ flex: 1, '--font-size': '15px' }}
        />
        <Button color="danger" onClick={() => doSend(input)} loading={loading} style={{ borderRadius: 8 }}>发送</Button>
      </div>
    </div>
  )
}
