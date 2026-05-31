import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, DatePicker, Tag, Popconfirm, message, Breadcrumb, Space, Select } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchVolunteers, createVolunteer, updateVolunteer, deleteVolunteer, fetchMembers } from '../../services/api'
import dayjs from 'dayjs'

export default function VolunteerPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [list, mems] = await Promise.all([fetchVolunteers({ search }), fetchMembers({})])
      setData(list || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ date: dayjs(), hours: 0 })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, date: r.date ? dayjs(r.date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteVolunteer(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, date: values.date ? values.date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateVolunteer(editing.id, payload); message.success('已更新') }
      else { await createVolunteer(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '党员', dataIndex: 'member_name', width: 100 },
    { title: '活动名称', dataIndex: 'activity_name', width: 200, ellipsis: true },
    { title: '服务时长', dataIndex: 'hours', width: 100, render: v => <Tag color="blue">{v} 小时</Tag> },
    { title: '日期', dataIndex: 'date', width: 110 },
    { title: '描述', dataIndex: 'description', ellipsis: true },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '服务中心' }, { title: '志愿服务记录' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Input.Search placeholder="搜索活动名称或党员" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)}
            onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增记录</Button>
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editing ? '编辑志愿记录' : '新增志愿记录'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || m.phone || ''})` }))} />
          </Form.Item>
          <Form.Item name="activity_name" label="活动名称" rules={[{ required: true }]}>
            <Input placeholder="如：社区清洁志愿活动" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="hours" label="服务时长（小时）">
              <InputNumber min={0} step={0.5} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="date" label="日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="description" label="活动描述"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
