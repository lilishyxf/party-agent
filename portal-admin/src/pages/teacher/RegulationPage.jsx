import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchRegulations, createRegulation, updateRegulation, deleteRegulation } from '../../services/api'
import dayjs from 'dayjs'

const CAT_COLORS = { 党章: 'red', 准则: 'volcano', 条例: 'orange', 规定: 'blue', 办法: 'green', 细则: 'cyan', 其他: 'default' }

export default function RegulationPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchRegulations({ search, category: filterCat })
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterCat])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ category: '条例' })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, publish_date: r.publish_date ? dayjs(r.publish_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteRegulation(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, publish_date: values.publish_date ? values.publish_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateRegulation(editing.id, payload); message.success('已更新') }
      else { await createRegulation(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const cats = ['党章', '准则', '条例', '规定', '办法', '细则', '其他']

  const columns = [
    { title: '标题', dataIndex: 'title', width: 260, ellipsis: true },
    { title: '分类', dataIndex: 'category', width: 90, render: v => <Tag color={CAT_COLORS[v]}>{v}</Tag> },
    { title: '发文机关', dataIndex: 'issuing_authority', width: 160, ellipsis: true, render: v => v || '-' },
    { title: '发布日期', dataIndex: 'publish_date', width: 110, render: v => v || '-' },
    { title: '内容摘要', dataIndex: 'content', width: 200, ellipsis: true, render: v => v ? v.slice(0, 60) + (v.length > 60 ? '...' : '') : '-' },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '公文文件' }, { title: '制度汇编' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索标题或发文机关" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)}
              style={{ width: 240, borderRadius: 6 }} allowClear />
            <Select placeholder="分类筛选" value={filterCat || undefined}
              onChange={v => setFilterCat(v || '')} style={{ width: 110 }} allowClear
              options={cats.map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增制度</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} scroll={{ x: 900 }} />
      </Card>

      <Modal title={editing ? '编辑制度' : '新增制度'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="例：中国共产党章程" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="category" label="分类">
              <Select options={cats.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="issuing_authority" label="发文机关">
              <Input placeholder="例：中国共产党中央委员会" />
            </Form.Item>
          </div>
          <Form.Item name="publish_date" label="发布日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="content" label="内容摘要">
            <Input.TextArea rows={5} placeholder="制度主要内容摘要..." />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
