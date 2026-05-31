import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Table, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchNotices, createNotice, updateNotice, deleteNotice } from '../../services/api'

const STATUS_MAP = { draft: { label: '草稿', color: 'default' }, published: { label: '已发布', color: 'green' } }

export default function NoticeBoard() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async (p = 1, s = '') => {
    setLoading(true)
    try { const r = await fetchNotices({ search: s, page: p }); setData(r.items || []); setTotal(r.total || 0); setPage(p) }
    catch { message.error('加载失败') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'draft' }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteNotice(id); message.success('已删除'); load(page, search) }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) { await updateNotice(editing.id, values); message.success('已更新') }
      else { await createNotice(values); message.success('已创建') }
      setModalOpen(false); load(page, search)
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag> },
    { title: '发布时间', dataIndex: 'published_at', width: 170, render: v => v?.split('T')[0] },
    { title: '操作', key: 'ops', width: 120,
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '办公中心' }, { title: '通知公告' }]} />
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索标题" allowClear style={{ width: 260 }} onSearch={v => { setSearch(v); load(1, v) }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f' }}>新建公告</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, showTotal: t => `共 ${t} 条`, onChange: p => load(p, search) }} />
      </Card>
      <Modal title={editing ? '编辑公告' : '新建公告'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving}
        okText="保存" cancelText="取消" width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'draft', label: '草稿' }, { value: 'published', label: '发布' }]} /></Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
