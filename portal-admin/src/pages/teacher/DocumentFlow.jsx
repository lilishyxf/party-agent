import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Table, Modal, Form, Input, Select, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchDocuments, createDocument, updateDocument, deleteDocument } from '../../services/api'

const TYPE_MAP = { receipt: { label: '收文', color: 'blue' }, issuance: { label: '发文', color: 'green' } }
const STATUS_MAP = { draft: { label: '草稿', color: 'default' }, review: { label: '审批中', color: 'processing' }, approved: { label: '已批准', color: 'green' }, archived: { label: '已归档', color: 'default' } }

export default function DocumentFlow() {
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
    try { const r = await fetchDocuments({ search: s, page: p }); setData(r.items || []); setTotal(r.total || 0); setPage(p) }
    catch { message.error('加载失败') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ doc_type: 'receipt', status: 'draft' }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteDocument(id); message.success('已删除'); load(page, search) }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) { await updateDocument(editing.id, values); message.success('已更新') }
      else { await createDocument(values); message.success('已创建') }
      setModalOpen(false); load(page, search)
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '文号', dataIndex: 'doc_number', width: 140 },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'doc_type', width: 80,
      render: v => <Tag color={TYPE_MAP[v]?.color}>{TYPE_MAP[v]?.label}</Tag> },
    { title: '发文方', dataIndex: 'sender', width: 120, ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag> },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '办公中心' }, { title: '公文流转' }]} />
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索标题" allowClear style={{ width: 260 }} onSearch={v => { setSearch(v); load(1, v) }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f' }}>新建公文</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, showTotal: t => `共 ${t} 条`, onChange: p => load(p, search) }} />
      </Card>
      <Modal title={editing ? '编辑公文' : '新建公文'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving}
        okText="保存" cancelText="取消" width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="doc_type" label="类型"><Select options={[{ value: 'receipt', label: '收文' }, { value: 'issuance', label: '发文' }]} /></Form.Item>
            <Form.Item name="doc_number" label="文号"><Input /></Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="sender" label="发文方"><Input /></Form.Item>
            <Form.Item name="receiver" label="收文方"><Input /></Form.Item>
          </div>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'draft', label: '草稿' }, { value: 'review', label: '审批中' }, { value: 'approved', label: '已批准' }, { value: 'archived', label: '已归档' }]} /></Form.Item>
          <Form.Item name="content" label="内容"><Input.TextArea rows={6} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
