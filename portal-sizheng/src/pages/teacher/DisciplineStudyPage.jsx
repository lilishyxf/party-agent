import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, DatePicker, Popconfirm, message, Breadcrumb, Space } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchDisciplineStudy, createDisciplineStudy, updateDisciplineStudy, deleteDisciplineStudy } from '../../services/api'
import dayjs from 'dayjs'

export default function DisciplineStudyPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => { setLoading(true); try { setData(await fetchDisciplineStudy()) } catch { message.error('加载失败') }; setLoading(false) }
  useEffect(() => { load() }, [])

  const openCreate = () => { setEditing(null); form.resetFields(); form.setFieldsValue({ study_date: dayjs() }); setModalOpen(true) }
  const openEdit = (r) => { setEditing(r); form.setFieldsValue({ ...r, study_date: r.study_date ? dayjs(r.study_date) : null }); setModalOpen(true) }

  const handleDelete = async (id) => { try { await deleteDisciplineStudy(id); message.success('已删除'); load() } catch { message.error('删除失败') } }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields(); setSaving(true)
      const payload = { ...values, study_date: values.study_date ? values.study_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateDisciplineStudy(editing.id, payload); message.success('已更新') }
      else { await createDisciplineStudy(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '日期', dataIndex: 'study_date', width: 110 },
    { title: '组织者', dataIndex: 'organizer', width: 100 },
    { title: '参与人员', dataIndex: 'attendees', width: 150, ellipsis: true },
    { title: '学习内容', dataIndex: 'content', ellipsis: true },
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '监督中心' }, { title: '党风党纪学习' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>党风党纪学习记录</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增记录</Button>
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle" pagination={{ pageSize: 20 }} />
      </Card>

      <Modal title={editing ? '编辑学习记录' : '新增学习记录'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="标题" rules={[{ required: true }]}><Input placeholder="如：学习《中国共产党纪律处分条例》" /></Form.Item>
          <Form.Item name="study_date" label="日期" rules={[{ required: true }]}><DatePicker style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="organizer" label="组织者"><Input placeholder="主讲人/组织者" /></Form.Item>
          <Form.Item name="attendees" label="参与人员"><Input.TextArea rows={2} placeholder="参与党员名单" /></Form.Item>
          <Form.Item name="content" label="学习内容"><Input.TextArea rows={3} placeholder="学习文件、讨论要点等" /></Form.Item>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
