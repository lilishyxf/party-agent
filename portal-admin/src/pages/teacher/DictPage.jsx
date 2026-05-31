import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, Popconfirm, message, Breadcrumb, Space, Tag, Tabs } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchDataDicts, createDataDict, updateDataDict, deleteDataDict } from '../../services/api'
import { useAuth } from '../../services/AuthContext'

export default function DictPage() {
  const { user: me } = useAuth()
  const isSuper = me?.role === '超级管理员'
  const [data, setData] = useState({})
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [activeType, setActiveType] = useState('')
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchDataDicts()
      setData(res)
      if (!activeType && Object.keys(res).length) setActiveType(Object.keys(res)[0])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ dict_type: activeType, sort_order: 0 })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ dict_type: r.dict_type, dict_key: r.dict_key, dict_value: r.dict_value, sort_order: r.sort_order, description: r.description })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteDataDict(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) { await updateDataDict(editing.id, values); message.success('已更新') }
      else { await createDataDict(values); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const currentItems = data[activeType] || []
  const types = Object.keys(data)

  const columns = [
    { title: '键', dataIndex: 'dict_key', width: 150 },
    { title: '值', dataIndex: 'dict_value', width: 200 },
    { title: '排序', dataIndex: 'sort_order', width: 70 },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    { title: '状态', dataIndex: 'is_active', width: 70, render: v => v ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag> },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '系统管理' }, { title: '数据字典' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>字典数据</span>
          {isSuper && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>添加条目</Button>
          )}
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Tabs activeKey={activeType} onChange={setActiveType}
          items={types.map(t => ({ key: t, label: t, children: null }))} />
        <Table columns={columns} dataSource={currentItems} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30 }} />
      </Card>

      <Modal title={editing ? '编辑字典项' : '添加字典项'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="dict_type" label="字典类型" rules={[{ required: true }]}>
            <Input placeholder="如：party_status" />
          </Form.Item>
          <Form.Item name="dict_key" label="键" rules={[{ required: true }]}>
            <Input placeholder="如：正式党员" />
          </Form.Item>
          <Form.Item name="dict_value" label="显示值" rules={[{ required: true }]}>
            <Input placeholder="如：正式党员" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="description" label="说明"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
