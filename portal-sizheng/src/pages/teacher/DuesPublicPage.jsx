import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchDuesPublic, createDuesPublic, updateDuesPublic, deleteDuesPublic } from '../../services/api'
import dayjs from 'dayjs'

const CAT_COLORS = { 活动经费: 'blue', 慰问: 'orange', 学习材料: 'green', 其他: 'default' }
const STATUS_COLORS = { 公示中: 'processing', 已结束: 'default' }

export default function DuesPublicPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchDuesPublic({ search, category: filterCat, status: filterStatus })
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterCat, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ category: '活动经费', status: '公示中', date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, date: r.date ? dayjs(r.date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteDuesPublic(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, date: values.date ? values.date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateDuesPublic(editing.id, payload); message.success('已更新') }
      else { await createDuesPublic(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const cats = ['活动经费', '慰问', '学习材料', '其他']

  const columns = [
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    { title: '金额', dataIndex: 'amount', width: 100, render: v => `¥${v}` },
    { title: '用途分类', dataIndex: 'category', width: 100, render: v => <Tag color={CAT_COLORS[v]}>{v}</Tag> },
    { title: '日期', dataIndex: 'date', width: 100 },
    { title: '说明', dataIndex: 'description', width: 200, ellipsis: true, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '操作', key: 'ops', width: 120, fixed: 'right',
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '党费管理' }, { title: '党费使用公示' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索标题" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)}
              style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="用途分类" value={filterCat || undefined}
              onChange={v => setFilterCat(v || '')} style={{ width: 120 }} allowClear
              options={cats.map(v => ({ value: v, label: v }))} />
            <Select placeholder="状态" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 100 }} allowClear
              options={['公示中', '已结束'].map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增公示</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} scroll={{ x: 800 }} />
      </Card>

      <Modal title={editing ? '编辑公示' : '新增公示'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="2026年第一季度党费支出明细" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="amount" label="金额">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
            <Form.Item name="category" label="用途分类">
              <Select options={cats.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="date" label="日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={['公示中', '已结束'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} placeholder="支出详细说明..." />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
