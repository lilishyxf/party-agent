import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchArchives, createArchive, updateArchive, deleteArchive } from '../../services/api'
import dayjs from 'dayjs'

const STATUS_COLORS = { 已归档: 'success', 已销毁: 'error' }

export default function ArchivePage() {
  const [data, setData] = useState([])
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
      const res = await fetchArchives({ search, status: filterStatus })
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: '已归档', archive_date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, archive_date: r.archive_date ? dayjs(r.archive_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteArchive(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, archive_date: values.archive_date ? values.archive_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateArchive(editing.id, payload); message.success('已更新') }
      else { await createArchive(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '标题', dataIndex: 'title', width: 220, ellipsis: true },
    { title: '归档日期', dataIndex: 'archive_date', width: 110 },
    { title: '档案盒号', dataIndex: 'box_number', width: 120, render: v => v || '-' },
    { title: '存放位置', dataIndex: 'storage_location', width: 150, ellipsis: true, render: v => v || '-' },
    { title: '保管年限', dataIndex: 'retention_years', width: 100, align: 'center', render: v => v ? `${v}年` : '-' },
    { title: '状态', dataIndex: 'status', width: 90, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '备注', dataIndex: 'notes', ellipsis: true, width: 150, render: v => v || '-' },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '公文文件' }, { title: '归档管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索标题或档案盒号" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)}
              style={{ width: 240, borderRadius: 6 }} allowClear />
            <Select placeholder="状态筛选" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 110 }} allowClear
              options={['已归档', '已销毁'].map(v => ({ value: v, label: v }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增归档</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }} scroll={{ x: 1000 }} />
      </Card>

      <Modal title={editing ? '编辑归档' : '新增归档'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}>
            <Input placeholder="归档文件标题" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="box_number" label="档案盒号">
              <Input placeholder="2026-DJ-001" />
            </Form.Item>
            <Form.Item name="archive_date" label="归档日期" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="storage_location" label="存放位置">
              <Input placeholder="档案室 A柜 3层" />
            </Form.Item>
            <Form.Item name="retention_years" label="保管年限">
              <InputNumber style={{ width: '100%' }} min={1} max={99} placeholder="年" />
            </Form.Item>
          </div>
          <Form.Item name="status" label="状态">
            <Select options={['已归档', '已销毁'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
