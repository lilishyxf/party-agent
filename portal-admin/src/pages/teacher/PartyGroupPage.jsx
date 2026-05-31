import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchPartyGroups, createPartyGroup, updatePartyGroup, deletePartyGroup, fetchBranches, fetchMembers } from '../../services/api'

export default function PartyGroupPage() {
  const [data, setData] = useState([])
  const [branches, setBranches] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [groups, brs, mems] = await Promise.all([
        fetchPartyGroups(),
        fetchBranches(),
        fetchMembers({}),
      ])
      setData(groups || [])
      setBranches(brs || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deletePartyGroup(id); message.success('已删除'); load() }
    catch (e) { message.error(e.message || '删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updatePartyGroup(editing.id, values)
        message.success('已更新')
      } else {
        await createPartyGroup(values)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '党小组名称', dataIndex: 'name', width: 180 },
    { title: '所属支部', dataIndex: 'branch_name', width: 180 },
    { title: '组长', dataIndex: 'leader_name', width: 120, render: v => v || '未指定' },
    { title: '成员人数', dataIndex: 'member_count', width: 100, align: 'center',
      render: v => <Tag color="blue">{v}</Tag> },
    { title: '简介', dataIndex: 'description', ellipsis: true },
    { title: '操作', key: 'ops', width: 160,
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
        items={[{ title: '党务中心' }, { title: '党小组设置' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>党小组列表</span>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
            新增党小组
          </Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={false} />
      </Card>

      <Modal title={editing ? '编辑党小组' : '新增党小组'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={520} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="党小组名称" rules={[{ required: true }]}>
            <Input placeholder="例：第一党小组" />
          </Form.Item>
          <Form.Item name="branch_id" label="所属支部" rules={[{ required: true }]}>
            <Select placeholder="选择支部"
              options={branches.map(b => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="leader_id" label="组长">
            <Select placeholder="选择组长" allowClear showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || '无学号'})` }))} />
          </Form.Item>
          <Form.Item name="description" label="简介">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
