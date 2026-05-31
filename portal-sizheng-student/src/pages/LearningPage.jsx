import { useState, useEffect } from 'react'
import { NavBar, DotLoading, Tag, Toast, Button, Popup, TextArea } from 'antd-mobile'
import { FileOutline, VideoOutline, TextOutline, EditFill } from 'antd-mobile-icons'
import { learnMaterial, fetchNotes, createNote, parseDate } from '../api'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_URL ?? ''


const typeIcon = {
  text: <TextOutline style={{ fontSize: 24, color: '#d32f2f' }} />,
  video: <VideoOutline style={{ fontSize: 24, color: '#d32f2f' }} />,
  file: <FileOutline style={{ fontSize: 24, color: '#d32f2f' }} />,
  reading: <TextOutline style={{ fontSize: 24, color: '#d32f2f' }} />,
}

const typeLabel = {
  text: '文章',
  video: '视频',
  file: '文件',
  reading: '阅读',
}

const categoryLabel = {
  charter: '党章党纪',
  policy: '时政方针',
  history: '党史学习',
  education: '党性教育',
  general: '综合',
}

export default function LearningPage() {
  const navigate = useNavigate()
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(true)

  const [noteMaterial, setNoteMaterial] = useState(null)
  const [notes, setNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [notesLoading, setNotesLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/sizheng/learning-materials`)
      .then(r => r.json())
      .then(data => {
        setMaterials(data.items || data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const openNotes = async (m) => {
    setNoteMaterial(m)
    setNoteText('')
    setNotesLoading(true)
    try {
      const res = await fetchNotes(m.id, null)
      setNotes(res || [])
    } catch { setNotes([]) }
    setNotesLoading(false)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim()) { Toast.show({ content: '请输入笔记内容' }); return }
    setSaving(true)
    try {
      await createNote(noteMaterial.id, noteText, null)
      Toast.show({ icon: 'success', content: '笔记已保存' })
      setNoteText('')
      // 重新加载笔记列表
      const res = await fetchNotes(noteMaterial.id, null)
      setNotes(res || [])
    } catch { Toast.show({ icon: 'fail', content: '保存失败' }) }
    setSaving(false)
  }

  const grouped = {}
  materials.forEach(m => {
    const cat = m.category || 'general'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(m)
  })

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', paddingBottom: 24 }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>学习资源</NavBar>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><DotLoading color="#d32f2f" /></div>
      ) : materials.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#999', padding: 60 }}>暂无学习资源，敬请期待</div>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ padding: '12px 12px 0' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#666', marginBottom: 8, paddingLeft: 4 }}>
              {categoryLabel[cat] || cat}
            </div>
            {items.map(m => (
              <div key={m.id} style={{
                background: '#fff', borderRadius: 10, marginBottom: 8, padding: '12px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                {/* 材料信息 */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                  {typeIcon[m.type] || typeIcon.text}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#333' }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>
                      {m.description || '暂无简介'}
                    </div>
                  </div>
                  <Tag color="danger" style={{ fontSize: 11, flexShrink: 0 }}>{typeLabel[m.type] || m.type}</Tag>
                </div>

                {/* 操作按钮 */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <Button block size="small" color="primary" fill="solid"
                    style={{ borderRadius: 6, '--background-color': '#d32f2f', fontSize: 13 }}
                    onClick={() => {
                      learnMaterial(m.id)
                      if (m.content_url) window.open(m.content_url)
                    }}>
                    阅读原文
                  </Button>
                  <Button block size="small" fill="outline"
                    style={{ borderRadius: 6, borderColor: '#d32f2f', color: '#d32f2f', fontSize: 13 }}
                    onClick={() => openNotes(m)}>
                    <EditFill style={{ fontSize: 13, marginRight: 4 }} />
                    笔记 {m._noteCount ? `(${m._noteCount})` : ''}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ))
      )}

      {/* 笔记底部面板 */}
      <Popup
        visible={!!noteMaterial}
        onClose={() => setNoteMaterial(null)}
        closeOnMaskClick
        bodyStyle={{
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          display: 'flex', flexDirection: 'column',
          height: '70vh',
        }}
      >
        {noteMaterial && (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* 面板头部 */}
            <div style={{ flexShrink: 0, padding: '16px 16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#333', flex: 1, marginRight: 12 }}
                  className="one-line">
                  {noteMaterial.title}
                </div>
                <Button size="mini" fill="none" style={{ color: '#d32f2f', fontSize: 12, flexShrink: 0 }}
                  onClick={() => {
                    learnMaterial(noteMaterial.id)
                    if (noteMaterial.content_url) window.open(noteMaterial.content_url)
                  }}>
                  阅读原文
                </Button>
              </div>
              <div style={{ fontSize: 12, color: '#999' }}>
                {notes.length} 条笔记
              </div>
            </div>

            {/* 笔记列表 */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
              {notesLoading ? (
                <div style={{ textAlign: 'center', padding: 30 }}><DotLoading color="#d32f2f" /></div>
              ) : notes.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#ccc', padding: 30, fontSize: 13 }}>
                  暂无笔记，在下方写一条吧
                </div>
              ) : (
                notes.map(n => (
                  <div key={n.id} style={{
                    background: '#f9f9f9', borderRadius: 8, padding: '10px 12px',
                    marginBottom: 8, fontSize: 13, color: '#333', lineHeight: 1.6,
                  }}>
                    {n.content}
                    <div style={{ fontSize: 11, color: '#bbb', marginTop: 6 }}>
                      {parseDate(n.created_at).toLocaleString('zh-CN')}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 底部输入区 */}
            <div style={{ flexShrink: 0, padding: '8px 16px 16px', borderTop: '1px solid #f0f0f0' }}>
              <TextArea
                placeholder="写笔记..."
                value={noteText}
                onChange={setNoteText}
                rows={2}
                style={{ marginBottom: 8, fontSize: 13 }}
              />
              <Button block color="primary" loading={saving} onClick={handleSaveNote}
                style={{ borderRadius: 8, '--background-color': '#d32f2f', fontSize: 14 }}>
                保存笔记
              </Button>
            </div>
          </div>
        )}
      </Popup>
    </div>
  )
}
