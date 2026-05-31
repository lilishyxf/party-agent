import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Breadcrumb, Space, Tag, Switch } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../../services/api'
import { useAuth } from '../../services/AuthContext'

const ROLE_OPTIONS = ['超级管理员', '普通管理员', '只读用户']

export default function UsersPage() {
  const { user: me } = useAuth()
  const isSuper = me?.role === '超级管理员'
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await fetchAdminUsers()) } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ role: '普通管理员' })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ real_name: r.real_name, phone: r.phone, role: r.role, is_active: r.is_active })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try {
      const res = await deleteAdminUser(id)
      if (res.status === 'error') { message.error(res.message); return }
      message.success('已删除'); load()
    } catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateAdminUser(editing.id, values)
        message.success('已更新')
      } else {
        await createAdminUser(values)
        message.success('已创建')
      }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '姓名', dataIndex: 'real_name', width: 100 },
    { title: '电话', dataIndex: 'phone', width: 120, render: v => v || '-' },
    { title: '角色', dataIndex: 'role', width: 110, render: v => <Tag color={v === '超级管理员' ? 'red' : v === '普通管理员' ? 'blue' : 'default'}>{v}</Tag> },
    { title: '状态', dataIndex: 'is_active', width: 80, render: v => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: v => v ? v.slice(0, 19).replace('T', ' ') : '-' },
    { title: '操作', key: 'ops', width: 120,
      render: (_, r) => isSuper ? (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) : <span style={{ color: '#999' }}>—</span> },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '系统管理' }, { title: '用户管理' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>管理员账号</span>
          {isSuper && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>添加用户</Button>
          )}
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20 }} />
      </Card>

      <Modal title={editing ? '编辑用户' : '添加用户'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {!editing && <>
            <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
              <Input placeholder="登录账号" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password placeholder="设置密码" />
            </Form.Item>
          </>}
          {editing && <Form.Item name="password" label="新密码（留空不修改）"><Input.Password placeholder="留空则不修改密码" /></Form.Item>}
          <Form.Item name="real_name" label="姓名" rules={[{ required: true }]}>
            <Input placeholder="真实姓名" />
          </Form.Item>
          <Form.Item name="phone" label="电话"><Input placeholder="手机号" /></Form.Item>
          <Form.Item name="role" label="角色"><Select options={ROLE_OPTIONS.map(v => ({ value: v, label: v }))} /></Form.Item>
          {editing && <Form.Item name="is_active" label="启用" valuePropName="checked"><Switch /></Form.Item>}
        </Form>
      </Modal>
    </div>
  )
}
