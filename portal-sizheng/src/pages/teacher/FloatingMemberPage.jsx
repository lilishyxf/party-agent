import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchFloatingMembers, createFloatingMember, updateFloatingMember, deleteFloatingMember, fetchMembers } from '../../services/api'
import dayjs from 'dayjs'

const TYPE_COLORS = { 流出: 'orange', 流入: 'green' }
const STATUS_COLORS = { 在流动中: 'processing', 已返回: 'success', 失联: 'error' }

export default function FloatingMemberPage() {
  const [data, setData] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [floats, mems] = await Promise.all([
        fetchFloatingMembers({ search, float_type: filterType, status: filterStatus }),
        fetchMembers({}),
      ])
      setData(floats || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterType, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ float_type: '流出', status: '在流动中', depart_date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      depart_date: r.depart_date ? dayjs(r.depart_date) : null,
      expected_return_date: r.expected_return_date ? dayjs(r.expected_return_date) : null,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteFloatingMember(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        depart_date: values.depart_date ? values.depart_date.format('YYYY-MM-DD') : '',
        expected_return_date: values.expected_return_date ? values.expected_return_date.format('YYYY-MM-DD') : '',
      }
      if (editing) {
        await updateFloatingMember(editing.id, payload)
        message.success('已更新')
      } else {
        await createFloatingMember(payload)
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
    { title: '流动类型', dataIndex: 'float_type', width: 90,
      render: v => <Tag color={TYPE_COLORS[v]}>{v}</Tag> },
    { title: '流向地/单位', dataIndex: 'destination', width: 160, ellipsis: true },
    { title: '流出日期', dataIndex: 'depart_date', width: 100 },
    { title: '预计返回', dataIndex: 'expected_return_date', width: 100, render: v => v || '-' },
    { title: '流动证编号', dataIndex: 'certificate_number', width: 120, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '联系方式', dataIndex: 'contact_record', width: 120, ellipsis: true, render: v => v || '-' },
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
        items={[{ title: '党员管理' }, { title: '流动党员管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索党员或学号" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="流动类型" value={filterType || undefined}
              onChange={v => setFilterType(v || '')} style={{ width: 110 }} allowClear
              options={['流出', '流入'].map(v => ({ value: v, label: v }))} />
            <Select placeholder="状态" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 130 }} allowClear
              options={['在流动中', '已返回', '失联'].map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
            新增登记
          </Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          scroll={{ x: 1200 }} />
      </Card>

      <Modal title={editing ? '编辑流动党员' : '新增流动党员登记'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={600} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || '无学号'})` }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="float_type" label="流动类型">
              <Select options={['流出', '流入'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="destination" label="流向地/单位" rules={[{ required: true }]}>
              <Input placeholder="省/市/单位名称" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="depart_date" label="流出日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="expected_return_date" label="预计返回日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="certificate_number" label="流动党员证编号">
              <Input placeholder="选填" />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={['在流动中', '已返回', '失联'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <Form.Item name="contact_record" label="联系记录">
            <Input.TextArea rows={2} placeholder="最近一次联系情况" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
