import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchSpecialActivities, createSpecialActivity, updateSpecialActivity, deleteSpecialActivity } from '../../services/api'
import dayjs from 'dayjs'

const STATUS_MAP = { upcoming: '未开始', ongoing: '进行中', completed: '已完成' }
const STATUS_COLORS = { upcoming: 'blue', ongoing: 'orange', completed: 'green' }

export default function SpecialActivityPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await fetchSpecialActivities() || []) } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'upcoming' }); setModalOpen(true) }
  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, activity_date: r.activity_date ? dayjs(r.activity_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteSpecialActivity(id); message.success('已删除'); load() } catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, activity_date: values.activity_date ? values.activity_date.format('YYYY-MM-DD') : null }
      if (editing) { await updateSpecialActivity(editing.id, payload); message.success('已更新') }
      else { await createSpecialActivity(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '活动标题', dataIndex: 'title', width: 200 },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: v => v || '-' },
    { title: '活动日期', dataIndex: 'activity_date', width: 110, render: v => v || '-' },
    { title: '地点', dataIndex: 'location', width: 120, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_COLORS[v]}>{STATUS_MAP[v] || v}</Tag> },
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
      <Breadcrumb items={[{ title: '特色党建' }, { title: '特色活动' }]} style={{ marginBottom: 12 }} />
      <Card title="特色活动" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建活动</Button>}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 900 }} />
      </Card>

      <Modal title={editing ? '编辑活动' : '新建活动'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="活动标题" rules={[{ required: true }]}>
            <Input placeholder="如：红色教育基地参观" />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} placeholder="活动介绍..." /></Form.Item>
          <Form.Item name="cover_url" label="封面图 URL"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="activity_date" label="活动日期"><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="location" label="地点"><Input placeholder="如：延安革命纪念馆" /></Form.Item>
          <Form.Item name="status" label="状态">
            <Select options={[
              { label: '未开始', value: 'upcoming' }, { label: '进行中', value: 'ongoing' }, { label: '已完成', value: 'completed' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
