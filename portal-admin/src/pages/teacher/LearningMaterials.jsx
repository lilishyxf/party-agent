import { useState, useEffect } from 'react'
import { Card, Table, Button, Input, Select, Modal, Form, Tag, Popconfirm, message, Breadcrumb, Space, Upload } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, InboxOutlined } from '@ant-design/icons'
import { fetchMaterials, createMaterial, updateMaterial, deleteMaterial, uploadMaterial } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const { Dragger } = Upload

const TYPE_OPTIONS = [
  { label: '文章', value: 'text' },
  { label: '视频', value: 'video' },
  { label: '文件', value: 'file' },
  { label: '阅读', value: 'reading' },
]

const CATEGORY_OPTIONS = [
  { label: '党章党纪', value: 'charter' },
  { label: '时政方针', value: 'policy' },
  { label: '党史学习', value: 'history' },
  { label: '党性教育', value: 'education' },
  { label: '综合', value: 'general' },
]

const TYPE_COLOR = { text: 'blue', video: 'purple', file: 'orange', reading: 'green' }
const CAT_COLOR = { charter: 'red', policy: 'volcano', history: 'gold', education: 'green', general: 'default' }

export default function LearningMaterials() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  const load = async (p = 1, s = search, c = category) => {
    setLoading(true)
    try {
      const res = await fetchMaterials({ page: p, search: s, category: c })
      setData(res.items)
      setTotal(res.total)
      setPage(p)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSearch = () => load(1)
  const onReset = () => { setSearch(''); setCategory(''); load(1, '', '') }

  const openCreate = () => {
    setEditing(null)
    setFile(null)
    form.resetFields()
    form.setFieldsValue({ type: 'reading', category: 'general' })
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setFile(null)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteMaterial(id); message.success('已删除'); load(page) }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    setUploading(true)
    try {
      if (editing) {
        await updateMaterial(editing.id, values)
        message.success('已更新')
      } else if (file) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('title', values.title || file.name)
        fd.append('type', values.type)
        fd.append('category', values.category)
        if (values.description) fd.append('description', values.description)
        await uploadMaterial(fd)
        message.success('已上传')
      } else {
        await createMaterial(values)
        message.success('已添加')
      }
      setModalOpen(false)
      setFile(null)
      load(page)
    } catch { message.error('操作失败') }
    setUploading(false)
  }

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 220,
      render: (t, r) => <a onClick={() => window.open(r.content_url)}>{t}</a> },
    { title: '类型', dataIndex: 'type', key: 'type', width: 80,
      render: v => <Tag color={TYPE_COLOR[v] || 'default'}>{TYPE_OPTIONS.find(o => o.value === v)?.label || v}</Tag> },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: v => <Tag color={CAT_COLOR[v] || 'default'}>{CATEGORY_OPTIONS.find(o => o.value === v)?.label || v}</Tag> },
    { title: '链接', dataIndex: 'content_url', key: 'content_url', width: 160, ellipsis: true,
      render: v => v ? <a href={v} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{v}</a> : '-' },
    { title: '简介', dataIndex: 'description', key: 'description', ellipsis: true },
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
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '学习材料管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Space wrap>
            <Input.Search placeholder="搜索标题..." prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)}
              onSearch={onSearch} style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="分类筛选" value={category || undefined} onChange={v => { setCategory(v || ''); load(1, search, v || '') }}
              options={CATEGORY_OPTIONS} style={{ width: 130 }} allowClear />
            <Button onClick={onReset}>重置</Button>
          </Space>
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}
            onClick={openCreate}>新增材料</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 50, onChange: p => load(p), showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editing ? '编辑学习材料' : '新增学习材料'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => { setModalOpen(false); setFile(null) }} destroyOnClose width={560}
        confirmLoading={uploading}>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          {!editing && (
            <Form.Item label="上传文件（PDF / Word）">
              <Dragger
                accept=".pdf,.docx,.doc,.txt"
                maxCount={1}
                fileList={file ? [{ uid: '-1', name: file.name, status: 'done' }] : []}
                beforeUpload={f => { setFile(f); form.setFieldsValue({ title: form.getFieldValue('title') || f.name.replace(/\.[^.]+$/, '') }); return false }}
                onRemove={() => setFile(null)}
                style={{ borderRadius: 8 }}>
                <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                <p className="ant-upload-hint">仅支持 PDF、Word、TXT 文件</p>
              </Dragger>
            </Form.Item>
          )}
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="学习材料标题" />
          </Form.Item>
          <Space size={12}>
            <Form.Item name="type" label="类型" rules={[{ required: true }]}>
              <Select options={TYPE_OPTIONS} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="category" label="分类" rules={[{ required: true }]}>
              <Select options={CATEGORY_OPTIONS} style={{ width: 140 }} />
            </Form.Item>
          </Space>
          <Form.Item name="content_url" label="链接地址（或上传文件后自动生成）">
            <Input placeholder="https://... 或留空使用文件上传" />
          </Form.Item>
          <Form.Item name="description" label="简介">
            <Input.TextArea rows={3} placeholder="简要描述该学习材料..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
