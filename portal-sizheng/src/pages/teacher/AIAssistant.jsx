import { useState, useRef, useEffect } from 'react'
import { Card, Input, Button, Tag, Space, message as antMsg } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  EditOutlined, QuestionCircleOutlined, FolderOpenOutlined,
  TeamOutlined, FileTextOutlined, CheckCircleOutlined,
  BarChartOutlined, BellOutlined, ScheduleOutlined, MessageOutlined,
  SendOutlined, CopyOutlined, ClearOutlined,
} from '@ant-design/icons'
import { aiChat, fetchChatHistory } from '../../services/api'

const { TextArea } = Input

const WELCOME_MSG = {
  role: 'assistant',
  content: '您好！我是党务 AI 助手，可以帮您：\n• 撰写思想汇报、年度总结等党建材料\n• 解答党章党纪等党务知识问题\n• 管理学习材料、安排学习任务\n• 辅助支部日常工作（会议记录、活动策划等）',
}

export default function AIAssistant() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState([WELCOME_MSG])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [history, setHistory] = useState([])
  const msgEndRef = useRef(null)

  useEffect(() => { loadHistory() }, [])

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadHistory = async () => {
    try {
      const data = await fetchChatHistory()
      setHistory(data.conversations || [])
    } catch { /* ignore */ }
  }

  const handleSend = async () => {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const data = await aiChat(q, conversationId)
      setMessages(prev => [...prev, { role: 'assistant', content: data.answer || '抱歉，未能生成回答。' }])
      if (data.conversation_id) setConversationId(data.conversation_id)
      loadHistory()
    } catch {
      antMsg.error('请求失败，请稍后重试')
    }
    setLoading(false)
  }

  const handleNewChat = () => {
    setMessages([WELCOME_MSG])
    setConversationId(null)
  }

  const handleCopy = (text) => {
    navigator.clipboard?.writeText(text)
    antMsg.success('已复制')
  }

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* ── 左栏：对话历史 ──────────────────────── */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card size="small" style={{ borderRadius: 10, background: 'linear-gradient(135deg, #c62828, #d32f2f)', border: 'none' }}>
          <div style={{ color: '#fff' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              党务 AI 助手
            </div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              支持写作、问答、支部工作等
            </div>
          </div>
        </Card>

        <Card size="small" title="对话历史" extra={<Button size="small" type="link" onClick={handleNewChat} icon={<ClearOutlined />} style={{ fontSize: 11 }}>新对话</Button>}
          style={{ borderRadius: 10, flex: 1, overflow: 'auto' }}
          bodyStyle={{ padding: '4px 0' }}>
          {history.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#ccc', padding: 20, fontSize: 12 }}>暂无历史对话</div>
          ) : (
            history.map((conv, i) => {
              const firstMsg = conv.messages.find(m => m.role === 'user')
              const preview = firstMsg ? (firstMsg.content.length > 18 ? firstMsg.content.slice(0, 18) + '...' : firstMsg.content) : '对话'
              return (
                <div key={i} style={{
                  padding: '8px 12px', cursor: 'pointer', borderRadius: 6,
                  transition: 'background 0.2s',
                  background: conv.conversation_id === conversationId ? '#fff2f0' : 'transparent',
                }}
                  onMouseEnter={e => { if (conv.conversation_id !== conversationId) e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseLeave={e => { if (conv.conversation_id !== conversationId) e.currentTarget.style.background = 'transparent' }}
                  onClick={() => {
                    setConversationId(conv.conversation_id)
                    setMessages(conv.messages.map(m => ({ role: m.role, content: m.content })))
                  }}
                >
                  <div style={{ fontSize: 13, color: '#333' }}>{preview}</div>
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                    {conv.messages.length} 条消息
                  </div>
                </div>
              )
            })
          )}
        </Card>
      </div>

      {/* ── 主区：对话 ──────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Card style={{ borderRadius: 10, flex: 1, display: 'flex', flexDirection: 'column' }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 16 }}>
          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', marginBottom: 12 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 16,
              }}>
                {m.role === 'assistant' && (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', background: '#d32f2f',
                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 600, flexShrink: 0, marginRight: 8, marginTop: 4,
                  }}>AI</div>
                )}
                <div style={{ maxWidth: '75%' }}>
                  <div style={{
                    background: m.role === 'user' ? '#d32f2f' : '#f5f5f5',
                    color: m.role === 'user' ? '#fff' : '#333',
                    borderRadius: m.role === 'user' ? '10px 4px 10px 10px' : '4px 10px 10px 10px',
                    padding: '10px 14px', fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  }}>{m.content}</div>
                  {m.role === 'assistant' && m !== messages[0] && (
                    <Button size="small" type="link" icon={<CopyOutlined />}
                      onClick={() => handleCopy(m.content)}
                      style={{ fontSize: 11, color: '#bbb', padding: 0, marginTop: 2 }}>
                      复制
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>

          {/* Input */}
          <div style={{ display: 'flex', gap: 10 }}>
            <TextArea
              rows={2}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="输入您的问题，例如：请帮我起草一份主题党日活动方案"
              onPressEnter={e => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
              style={{ borderRadius: 8 }}
            />
            <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={handleSend}
              style={{ height: 'auto', borderRadius: 8, background: '#d32f2f', borderColor: '#d32f2f', padding: '8px 20px' }}>
              发送
            </Button>
          </div>
        </Card>
      </div>

      {/* ── 右栏：快捷入口 ──────────────────────── */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card size="small" title="快捷入口" style={{ borderRadius: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px 0', textAlign: 'center' }}>
            {[
              { icon: <EditOutlined />, label: '撰写材料', path: '/writing' },
              { icon: <QuestionCircleOutlined />, label: '知识问答', path: '/ai' },
              { icon: <FolderOpenOutlined />, label: '材料管理', path: '/learning/lessons' },
              { icon: <TeamOutlined />, label: '学习档案', path: '/learning/records' },
              { icon: <FileTextOutlined />, label: '学习简报', path: '/learning/briefing' },
              { icon: <BarChartOutlined />, label: '数据大屏', path: '/dashboard' },
            ].map((e, i) => (
              <div key={i} onClick={() => navigate(e.path)} style={{ cursor: 'pointer', padding: '6px 0' }}>
                <div style={{ fontSize: 20, color: '#d32f2f', marginBottom: 2 }}>{e.icon}</div>
                <div style={{ fontSize: 11, color: '#666' }}>{e.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card size="small" title="常用提问" style={{ borderRadius: 10, flex: 1 }}
          bodyStyle={{ padding: '4px 0' }}>
          {[
            '如何撰写思想汇报？',
            '发展党员有哪些流程？',
            '三会一课具体指什么？',
            '民主评议党员如何开展？',
            '主题党日活动方案模板',
          ].map((q, i) => (
            <div key={i} onClick={() => { setInput(q) }} style={{
              padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: '#555',
              borderBottom: i < 4 ? '1px solid #f5f5f5' : 'none',
              transition: 'background 0.2s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              {q}
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
