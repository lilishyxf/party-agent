import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Popconfirm, message, Breadcrumb, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchInspections, createInspection, updateInspection, deleteInspection } from '../../services/api'
import dayjs from 'dayjs'

const STATUS_OPTIONS = ['待整改', '整改中', '已完成']
const STATUS_COLORS = { 待整改: 'orange', 整改中: 'blue', 已完成: 'green' }

export default function InspectionPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => { setLoading(true); try { setData(await fetchInspections()) } catch { message.error('加载失败') }; setLoading(false) }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ inspect_date: dayjs(), rectification_status: '待整改' }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue({ ...r, inspect_date: r.inspect_date ? dayjs(r.inspect_date) : null }); setModalOpen(true) }

  const handleDelete = async (id) => { try { await deleteInspection(id); message.success('已删除'); load() } catch { message.error('删除失败') } }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields(); setSaving(true)
      const payload = { ...values, inspect_date: values.inspect_date ? values.inspect_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateInspection(editing.id, payload); message.success('已更新') }
      else { await createInspection(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '检查日期', dataIndex: 'inspect_date', width: 110 },
    { title: '检查人', dataIndex: 'inspector', width: 100 },
    { title: '检查范围', dataIndex: 'scope', width: 180, ellipsis: true },
    { title: '发现问题', dataIndex: 'finding', ellipsis: true },
    { title: '整改状态', dataIndex: 'rectification_status', width: 90, render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '整改备注', dataIndex: 'rectification_notes', ellipsis: true },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '监督中心' }, { title: '监督检查记录' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>监督检查记录</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增记录</Button>
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} />
      </Card>

      <Modal title={editing ? '编辑检查记录' : '新增检查记录'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="inspect_date" label="检查日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="inspector" label="检查人" rules={[{ required: true }]}><Input placeholder="检查人姓名" /></Form.Item>
          </div>
          <Form.Item name="scope" label="检查范围"><Input.TextArea rows={2} placeholder="如：检查第三季度党费收缴情况" /></Form.Item>
          <Form.Item name="finding" label="发现问题"><Input.TextArea rows={3} placeholder="发现的具体问题" /></Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="rectification_status" label="整改状态"><Select options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} /></Form.Item>
            <Form.Item name="rectification_notes" label="整改备注"><Input placeholder="整改措施及完成情况" /></Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  )
}
