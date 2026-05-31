import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchShowcases, createShowcase, updateShowcase, deleteShowcase, fetchBranches } from '../../services/api'

export default function BranchShowcasePage() {
  const [data, setData] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [showcases, brs] = await Promise.all([fetchShowcases(), fetchBranches()])
      setData(showcases || [])
      setBranches(brs || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ is_published: false }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteShowcase(id); message.success('已删除'); load() } catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) { await updateShowcase(editing.id, values); message.success('已更新') }
      else { await createShowcase(values); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const branchMap = Object.fromEntries(branches.map(b => [b.id, b.name]))

  const columns = [
    { title: '标题', dataIndex: 'title', width: 200 },
    { title: '所属支部', dataIndex: 'branch_id', width: 150, render: v => branchMap[v] || '-' },
    { title: '内容', dataIndex: 'content', ellipsis: true, render: v => v ? v.slice(0, 80) : '-' },
    { title: '状态', dataIndex: 'is_published', width: 80,
      render: v => <Tag color={v ? 'green' : 'default'}>{v ? '已发布' : '草稿'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', width: 170, render: v => v?.slice(0, 19).replace('T', ' ') || '-' },
    { title: '操作', key: 'ops', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ]

  return (
    <div>
      <Breadcrumb items={[{ title: '特色党建' }, { title: '支部风采' }]} style={{ marginBottom: 12 }} />
      <Card title="支部风采" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建风采</Button>}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 800 }} />
      </Card>

      <Modal title={editing ? '编辑风采' : '新建风采'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="branch_id" label="所属支部" rules={[{ required: true }]}>
            <Select placeholder="选择支部" options={branches.map(b => ({ label: b.name, value: b.id }))} />
          </Form.Item>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="如：支部主题党日活动纪实" />
          </Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={4} placeholder="风采展示内容..." /></Form.Item>
          <Form.Item name="cover_url" label="封面图 URL"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="is_published" label="发布状态">
            <Select options={[{ label: '已发布', value: true }, { label: '草稿', value: false }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
