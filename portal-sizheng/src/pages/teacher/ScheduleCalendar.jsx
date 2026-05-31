import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Table, Modal, Form, Input, Select, DatePicker, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchSchedules, createSchedule, updateSchedule, deleteSchedule } from '../../services/api'
import dayjs from 'dayjs'

const TYPE_MAP = { meeting: { label: '会议', color: 'blue' }, activity: { label: '活动', color: 'green' }, other: { label: '其他', color: 'default' } }

export default function ScheduleCalendar() {
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
    try { const r = await fetchSchedules({ search: s, page: p }); setData(r.items || []); setTotal(r.total || 0); setPage(p) }
    catch { message.error('加载失败') }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ event_type: 'other', start_time: dayjs() }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue({ ...r, start_time: r.start_time ? dayjs(r.start_time) : null, end_time: r.end_time ? dayjs(r.end_time) : null }); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteSchedule(id); message.success('已删除'); load(page, search) }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values,
        start_time: values.start_time.toISOString(),
        end_time: values.end_time ? values.end_time.toISOString() : '' }
      if (editing) { await updateSchedule(editing.id, payload); message.success('已更新') }
      else { await createSchedule(payload); message.success('已创建') }
      setModalOpen(false); load(page, search)
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '时间', dataIndex: 'start_time', width: 160, render: v => v ? dayjs(v).format('M月D日 HH:mm') : '' },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'event_type', width: 80,
      render: v => <Tag color={TYPE_MAP[v]?.color}>{TYPE_MAP[v]?.label}</Tag> },
    { title: '地点', dataIndex: 'location', width: 140, ellipsis: true },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '办公中心' }, { title: '日程安排' }]} />
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Input.Search placeholder="搜索标题" allowClear style={{ width: 260 }} onSearch={v => { setSearch(v); load(1, v) }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f' }}>新建日程</Button>
        </div>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, showTotal: t => `共 ${t} 条`, onChange: p => load(p, search) }} />
      </Card>
      <Modal title={editing ? '编辑日程' : '新建日程'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving}
        okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="start_time" label="开始时间" rules={[{ required: true }]}>
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="end_time" label="结束时间">
            <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="location" label="地点"><Input /></Form.Item>
          <Form.Item name="event_type" label="类型">
            <Select options={[{ value: 'meeting', label: '会议' }, { value: 'activity', label: '活动' }, { value: 'other', label: '其他' }]} /></Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
