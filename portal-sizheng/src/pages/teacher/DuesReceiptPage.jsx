import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchDuesReceipts, createDuesReceipt, updateDuesReceipt, deleteDuesReceipt, fetchMembers } from '../../services/api'
import dayjs from 'dayjs'

const STATUS_COLORS = { 已开具: 'success', 已作废: 'error' }

export default function DuesReceiptPage() {
  const [data, setData] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState(0)
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [recs, mems] = await Promise.all([
        fetchDuesReceipts({ search, year: filterYear, status: filterStatus }),
        fetchMembers({}),
      ])
      setData(recs || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterYear, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: '已开具', year: dayjs().year(), issue_date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, issue_date: r.issue_date ? dayjs(r.issue_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteDuesReceipt(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, issue_date: values.issue_date ? values.issue_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateDuesReceipt(editing.id, payload); message.success('已更新') }
      else { await createDuesReceipt(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '票据编号', dataIndex: 'receipt_number', width: 140 },
    { title: '党员', dataIndex: 'member_name', width: 80 },
    { title: '年度', dataIndex: 'year', width: 60 },
    { title: '月份', dataIndex: 'month', width: 60 },
    { title: '金额', dataIndex: 'amount', width: 80, render: v => `¥${v}` },
    { title: '开具日期', dataIndex: 'issue_date', width: 100 },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '备注', dataIndex: 'notes', ellipsis: true, width: 120, render: v => v || '-' },
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

  const currentYear = dayjs().year()

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '党费管理' }, { title: '票据管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索党员或票据编号" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)}
              style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="年度" value={filterYear || undefined}
              onChange={v => setFilterYear(v || 0)} style={{ width: 100 }} allowClear
              options={Array.from({length:5},(_,i)=>{const y=currentYear-i;return{value:y,label:y}})} />
            <Select placeholder="状态" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 100 }} allowClear
              options={['已开具', '已作废'].map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增票据</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} scroll={{ x: 900 }} />
      </Card>

      <Modal title={editing ? '编辑票据' : '新增票据'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || '无学号'})` }))} />
          </Form.Item>
          <Form.Item name="receipt_number" label="票据编号" rules={[{ required: true }]}>
            <Input placeholder="DJ-2026-001" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="year" label="年度">
              <InputNumber style={{ width: '100%' }} min={2000} max={2099} />
            </Form.Item>
            <Form.Item name="month" label="月份">
              <InputNumber style={{ width: '100%' }} min={1} max={12} />
            </Form.Item>
            <Form.Item name="amount" label="金额">
              <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="issue_date" label="开具日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={['已开具', '已作废'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
