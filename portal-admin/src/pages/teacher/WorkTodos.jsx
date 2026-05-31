import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Table, Modal, Form, Input, Select, DatePicker, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchTodos, createTodo, updateTodo, deleteTodo } from '../../services/api'
import dayjs from 'dayjs'

const PRIO_MAP = { high: { label: '高', color: 'red' }, medium: { label: '中', color: 'orange' }, low: { label: '低', color: 'default' } }
const STATUS_MAP = { pending: { label: '待办', color: 'default' }, in_progress: { label: '进行中', color: 'processing' }, completed: { label: '已完成', color: 'green' } }

export default function WorkTodos() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async (p = 1, s = '', st = filterStatus) => {
    setLoading(true)
    try { const r = await fetchTodos({ search: s, status: st, page: p }); setData(r.items || []); setTotal(r.total || 0); setPage(p) }
    catch { message.error('加载失败') }
    setLoading(false)
  }
  useEffect(() => { load() }, [filterStatus])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ priority: 'medium', status: 'pending' }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue({ ...r, deadline: r.deadline ? dayjs(r.deadline) : null }); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteTodo(id); message.success('已删除'); load(page, search) }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null }
      if (editing) { await updateTodo(editing.id, payload); message.success('已更新') }
      else { await createTodo(payload); message.success('已创建') }
      setModalOpen(false); load(page, search)
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '负责人', dataIndex: 'assignee', width: 90 },
    { title: '优先级', dataIndex: 'priority', width: 80,
      render: v => <Tag color={PRIO_MAP[v]?.color}>{PRIO_MAP[v]?.label}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_MAP[v]?.color}>{STATUS_MAP[v]?.label}</Tag> },
    { title: '截止日期', dataIndex: 'deadline', width: 110, render: v => v?.split('T')[0] },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '办公中心' }, { title: '工作待办' }]} />
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Select placeholder="状态" allowClear style={{ width: 120 }}
              value={filterStatus || undefined} onChange={v => { setFilterStatus(v || ''); setPage(1) }}
              options={[{ value: 'pending', label: '待办' }, { value: 'in_progress', label: '进行中' }, { value: 'completed', label: '已完成' }]} />
            <Input.Search placeholder="搜索标题" allowClear style={{ width: 260 }} onSearch={v => { setSearch(v); load(1, v) }} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f' }}>新建待办</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, showTotal: t => `共 ${t} 条`, onChange: p => load(p, search) }} />
      </Card>
      <Modal title={editing ? '编辑待办' : '新建待办'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving}
        okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="assignee" label="负责人"><Input /></Form.Item>
          <Form.Item name="priority" label="优先级"><Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ value: 'pending', label: '待办' }, { value: 'in_progress', label: '进行中' }, { value: 'completed', label: '已完成' }]} /></Form.Item>
          <Form.Item name="deadline" label="截止日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
