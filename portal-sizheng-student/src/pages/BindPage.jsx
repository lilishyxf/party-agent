import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { NavBar, Form, Input, Button, Dialog, Toast } from 'antd-mobile'
import { bindMember } from '../api'

export default function BindPage() {
  const navigate = useNavigate()
  const [studentId, setStudentId] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleBind = async () => {
    if (!studentId.trim() || !name.trim()) {
      Toast.show({ icon: 'fail', content: '请输入学号和姓名' })
      return
    }
    setLoading(true)
    try {
      const result = await bindMember(null, studentId.trim(), name.trim())
      if (result.status === 'ok') {
        Dialog.alert({ content: `绑定成功，欢迎你 ${result.name}！` })
        navigate('/profile')
      } else {
        Toast.show({ icon: 'fail', content: result.message || '绑定失败' })
      }
    } catch (e) {
      Toast.show({ icon: 'fail', content: '网络错误，请重试' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>身份绑定</NavBar>

      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: '#333', marginBottom: 8 }}>绑定党员身份</div>
        <div style={{ fontSize: 13, color: '#999', lineHeight: 1.6 }}>
          输入你的学号和姓名，绑定后可记录学习数据、查看积分和成绩。
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Form layout="horizontal" style={{ '--border-inner': 'none' }}>
          <Form.Item label="学号/工号">
            <Input
              placeholder="请输入学号或工号"
              value={studentId}
              onChange={setStudentId}
              clearable
            />
          </Form.Item>
          <Form.Item label="姓名">
            <Input
              placeholder="请输入姓名"
              value={name}
              onChange={setName}
              clearable
            />
          </Form.Item>
        </Form>
        <Button
          block
          color="danger"
          size="large"
          loading={loading}
          onClick={handleBind}
          style={{ marginTop: 24, borderRadius: 8 }}
        >
          确认绑定
        </Button>
      </div>
    </div>
  )
}
