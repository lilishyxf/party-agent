import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchBrands, createBrand, updateBrand, deleteBrand } from '../../services/api'

export default function SpecialBrandPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try { setData(await fetchBrands() || []) } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ status: 'active' }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true) }

  const handleDelete = async (id) => {
    try { await deleteBrand(id); message.success('已删除'); load() } catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) { await updateBrand(editing.id, values); message.success('已更新') }
      else { await createBrand(values); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '品牌名称', dataIndex: 'name', width: 200 },
    { title: '描述', dataIndex: 'description', ellipsis: true, render: v => v || '-' },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v === 'active' ? '启用' : '停用'}</Tag> },
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
      <Breadcrumb items={[{ title: '特色党建' }, { title: '党建品牌' }]} style={{ marginBottom: 12 }} />
      <Card title="党建品牌" extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建品牌</Button>}>
        <Table rowKey="id" columns={columns} dataSource={data} loading={loading} scroll={{ x: 700 }} />
      </Card>

      <Modal title={editing ? '编辑品牌' : '新建品牌'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit} confirmLoading={saving} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="品牌名称" rules={[{ required: true }]}>
            <Input placeholder="如：红色先锋工程" />
          </Form.Item>
          <Form.Item name="description" label="描述"><Input.TextArea rows={3} placeholder="品牌介绍..." /></Form.Item>
          <Form.Item name="cover_url" label="封面图 URL"><Input placeholder="https://..." /></Form.Item>
          <Form.Item name="status" label="状态"><Select options={[{ label: '启用', value: 'active' }, { label: '停用', value: 'inactive' }]} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
