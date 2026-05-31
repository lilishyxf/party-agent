import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, message, Breadcrumb, Space } from 'antd'
import { EditOutlined, SearchOutlined } from '@ant-design/icons'
import { fetchCadres, fetchBranches, updateMember } from '../../services/api'
import dayjs from 'dayjs'

const ROLE_COLORS = { 支部书记: 'red', 支委委员: 'blue', 干部: 'purple' }
const STATUS_COLORS = { 申请人: 'default', 积极分子: 'orange', 发展对象: 'volcano', 预备党员: 'blue', 正式党员: 'green' }

export default function CadrePage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [branches, setBranches] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [cadres, brs] = await Promise.all([fetchCadres({ search }), fetchBranches()])
      setData(cadres || [])
      setBranches(brs || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, appointment_date: r.appointment_date ? dayjs(r.appointment_date) : null })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await updateMember(editing.id, {
        ...values,
        appointment_date: values.appointment_date ? values.appointment_date.format('YYYY-MM-DD') : '',
      })
      message.success('已更新')
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '学号', dataIndex: 'student_id', width: 110 },
    { title: '所属支部', dataIndex: 'branch_name', width: 160, ellipsis: true },
    { title: '角色', dataIndex: 'role', width: 100,
      render: v => <Tag color={ROLE_COLORS[v]}>{v}</Tag> },
    { title: '职务', dataIndex: 'position', width: 120, render: v => v || '未指定' },
    { title: '政治面貌', dataIndex: 'party_status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '任职日期', dataIndex: 'appointment_date', width: 110, render: v => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 120 },
    { title: '操作', key: 'ops', width: 80,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '党务中心' }, { title: '干部管理' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space>
          <Input.Search placeholder="搜索姓名或学号" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)}
            onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
        </Space>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30, showTotal: t => `共 ${t} 人` }} />
      </Card>

      <Modal title="编辑干部信息" open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="position" label="职务">
              <Input placeholder="如：支部书记" />
            </Form.Item>
            <Form.Item name="appointment_date" label="任职日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="role" label="角色">
            <Select options={[
              { value: '支部书记', label: '支部书记' },
              { value: '支委委员', label: '支委委员' },
              { value: '干部', label: '干部' },
            ]} />
          </Form.Item>
          <Form.Item name="party_status" label="政治面貌">
            <Select options={[
              { value: '申请人', label: '申请人' }, { value: '积极分子', label: '积极分子' },
              { value: '发展对象', label: '发展对象' }, { value: '预备党员', label: '预备党员' },
              { value: '正式党员', label: '正式党员' },
            ]} />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
