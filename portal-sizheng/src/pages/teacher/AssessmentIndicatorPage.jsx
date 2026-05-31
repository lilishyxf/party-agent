import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Select, Input, InputNumber, Tag, message, Breadcrumb, Space, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchIndicators, createIndicator, updateIndicator, deleteIndicator } from '../../services/api'

const CATEGORIES = ['共性指标', '个性指标']
const CATEGORY_COLORS = { '共性指标': 'blue', '个性指标': 'orange' }

export default function AssessmentIndicatorPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [filterCategory, setFilterCategory] = useState('')
  const [filterYear, setFilterYear] = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterCategory) params.category = filterCategory
      if (filterYear) params.year = filterYear
      const res = await fetchIndicators(params)
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [filterCategory, filterYear])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ category: '共性指标', max_score: 100, year: new Date().getFullYear() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }

  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateIndicator(editing.id, values)
        message.success('已更新')
      } else {
        await createIndicator(values)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    await deleteIndicator(id)
    message.success('已删除')
    load()
  }

  const columns = [
    { title: '指标名称', dataIndex: 'name', width: 200 },
    {
      title: '类别', dataIndex: 'category', width: 100,
      render: v => <Tag color={CATEGORY_COLORS[v] || 'default'}>{v}</Tag>,
    },
    { title: '满分', dataIndex: 'max_score', width: 80 },
    { title: '年度', dataIndex: 'year', width: 80 },
    { title: '说明', dataIndex: 'description', ellipsis: true },
    {
      title: '操作', key: 'ops', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const years = [...new Set(data.map(r => r.year))].sort((a, b) => b - a)

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '学习中心' }, { title: '考核指标' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Select placeholder="指标类别" value={filterCategory || undefined}
              onChange={v => setFilterCategory(v || '')} style={{ width: 130 }} allowClear
              options={CATEGORIES.map(v => ({ value: v, label: v }))} />
            <Select placeholder="年度" value={filterYear || undefined}
              onChange={v => setFilterYear(v || 0)} style={{ width: 100 }} allowClear
              options={years.map(v => ({ value: v, label: String(v) }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增指标</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          size="middle" pagination={{ pageSize: 20 }} scroll={{ x: 700 }} />
      </Card>

      <Modal title={editing ? '编辑指标' : '新增指标'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSave}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="指标名称" rules={[{ required: true }]}>
            <Input placeholder="如：政治理论学习" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="类别" rules={[{ required: true }]}>
              <Select options={CATEGORIES.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="max_score" label="满分" rules={[{ required: true }]}>
              <InputNumber min={1} max={200} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="year" label="年度" rules={[{ required: true }]}>
            <InputNumber min={2020} max={2030} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="description" label="说明">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
