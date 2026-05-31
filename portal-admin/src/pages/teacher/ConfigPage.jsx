import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Popconfirm, message, Breadcrumb, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchSystemConfigs, saveSystemConfig, deleteSystemConfig } from '../../services/api'
import { useAuth } from '../../services/AuthContext'

export default function ConfigPage() {
  const { user: me } = useAuth()
  const isSuper = me?.role === '超级管理员'
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingKey, setEditingKey] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await fetchSystemConfigs()) } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditingKey(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (key) => {
    setEditingKey(key)
    form.setFieldsValue({ config_key: key, config_value: data[key].value, description: data[key].description })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteSystemConfig(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await saveSystemConfig(values)
      message.success('已保存')
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const rows = Object.entries(data).map(([key, info]) => ({ key, value: info.value, description: info.description, id: info.id }))

  const columns = [
    { title: '配置键', dataIndex: 'key', width: 200 },
    { title: '配置值', dataIndex: 'value', width: 300, ellipsis: true },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '操作', key: 'ops', width: 120,
      render: (_, r) => isSuper ? (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r.key)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) : <span style={{ color: '#999' }}>—</span> },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '系统管理' }, { title: '系统配置' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>系统参数</span>
          {isSuper && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>添加配置</Button>
          )}
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={rows} rowKey="key" loading={loading} size="middle" />
      </Card>

      <Modal title={editingKey ? '编辑配置' : '添加配置'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="config_key" label="配置键" rules={[{ required: true }]}>
            <Input placeholder="如：site_name" disabled={!!editingKey} />
          </Form.Item>
          <Form.Item name="config_value" label="配置值"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="description" label="说明"><Input placeholder="这项配置的用途" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
