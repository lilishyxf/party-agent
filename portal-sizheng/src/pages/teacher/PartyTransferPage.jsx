import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchTransfers, createTransfer, updateTransfer, deleteTransfer, fetchMembers } from '../../services/api'
import dayjs from 'dayjs'

const TYPE_COLORS = { 系统内: 'blue', 省内跨党委: 'orange', 省外: 'purple' }
const STATUS_COLORS = { 办理中: 'processing', 已完成: 'success', 已退回: 'error' }

export default function PartyTransferPage() {
  const [data, setData] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [transfers, mems] = await Promise.all([
        fetchTransfers({ search, status: filterStatus }),
        fetchMembers({}),
      ])
      setData(transfers || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ transfer_type: '系统内', status: '办理中', apply_date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      apply_date: r.apply_date ? dayjs(r.apply_date) : null,
      complete_date: r.complete_date ? dayjs(r.complete_date) : null,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteTransfer(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        apply_date: values.apply_date ? values.apply_date.format('YYYY-MM-DD') : '',
        complete_date: values.complete_date ? values.complete_date.format('YYYY-MM-DD') : '',
      }
      if (editing) {
        await updateTransfer(editing.id, payload)
        message.success('已更新')
      } else {
        await createTransfer(payload)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '党员', dataIndex: 'member_name', width: 80 },
    { title: '学号/工号', dataIndex: 'student_id', width: 110 },
    { title: '转出组织', dataIndex: 'from_branch', width: 150, ellipsis: true },
    { title: '转入组织', dataIndex: 'to_branch', width: 150, ellipsis: true },
    { title: '转接类型', dataIndex: 'transfer_type', width: 110,
      render: v => <Tag color={TYPE_COLORS[v]}>{v}</Tag> },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '介绍信编号', dataIndex: 'letter_number', width: 120, render: v => v || '-' },
    { title: '申请日期', dataIndex: 'apply_date', width: 100 },
    { title: '完成日期', dataIndex: 'complete_date', width: 100, render: v => v || '-' },
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

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '党员管理' }, { title: '组织关系转接' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索党员或学号" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="状态筛选" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 130 }} allowClear
              options={['办理中', '已完成', '已退回'].map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
            新增转接
          </Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          scroll={{ x: 1400 }} />
      </Card>

      <Modal title={editing ? '编辑转接记录' : '新增转接记录'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={600} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || '无学号'})` }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="from_branch" label="转出组织" rules={[{ required: true }]}>
              <Input placeholder="原支部名称" />
            </Form.Item>
            <Form.Item name="to_branch" label="转入组织" rules={[{ required: true }]}>
              <Input placeholder="目标支部名称" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="transfer_type" label="转接类型">
              <Select options={['系统内', '省内跨党委', '省外'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={['办理中', '已完成', '已退回'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="letter_number" label="介绍信编号">
              <Input placeholder="选填" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="apply_date" label="申请日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="complete_date" label="完成日期">
              <DatePicker style={{ width: '100%' }} />
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
