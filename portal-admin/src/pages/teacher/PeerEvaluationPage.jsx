import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Select, Input, InputNumber, Tag, message, Breadcrumb, Space, Popconfirm } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchEvaluations, createEvaluation, updateEvaluation, deleteEvaluation, fetchMembers } from '../../services/api'

const EVAL_TYPES = ['自评', '互评']
const EVAL_COLORS = { '自评': 'blue', '互评': 'green' }

export default function PeerEvaluationPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [filterType, setFilterType] = useState('')
  const [filterYear, setFilterYear] = useState(0)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const params = {}
      if (filterType) params.eval_type = filterType
      if (filterYear) params.year = filterYear
      if (search) params.search = search
      const res = await fetchEvaluations(params)
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  const loadMembers = async () => {
    try {
      const res = await fetchMembers({ page_size: 500 })
      setMembers(res?.items || res || [])
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [filterType, filterYear, search])
  useEffect(() => { loadMembers() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ eval_type: '自评', year: new Date().getFullYear(), score: 80 })
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
      const payload = {
        ...values,
        target_member_id: values.eval_type === '互评' ? values.target_member_id : null,
      }
      if (editing) {
        await updateEvaluation(editing.id, payload)
        message.success('已更新')
      } else {
        await createEvaluation(payload)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    await deleteEvaluation(id)
    message.success('已删除')
    load()
  }

  const evalType = Form.useWatch('eval_type', form)
  const isMutual = evalType === '互评'

  const columns = [
    { title: '评价人', dataIndex: 'member_name', width: 100 },
    {
      title: '类型', dataIndex: 'eval_type', width: 80,
      render: v => <Tag color={EVAL_COLORS[v] || 'default'}>{v}</Tag>,
    },
    { title: '评价对象', dataIndex: 'target_name', width: 100, render: v => v || '-' },
    { title: '年度', dataIndex: 'year', width: 80 },
    { title: '得分', dataIndex: 'score', width: 80 },
    { title: '评语', dataIndex: 'comment', ellipsis: true },
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
  const otherMembers = members.filter(m => {
    const selfId = form.getFieldValue('member_id')
    return m.id !== selfId
  })

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '学习中心' }, { title: '自评互评' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索评价人" value={search}
              onChange={e => setSearch(e.target.value)} onSearch={v => setSearch(v)}
              style={{ width: 180, borderRadius: 6 }} allowClear />
            <Select placeholder="评价类型" value={filterType || undefined}
              onChange={v => setFilterType(v || '')} style={{ width: 110 }} allowClear
              options={EVAL_TYPES.map(v => ({ value: v, label: v }))} />
            <Select placeholder="年度" value={filterYear || undefined}
              onChange={v => setFilterYear(v || 0)} style={{ width: 100 }} allowClear
              options={years.map(v => ({ value: v, label: String(v) }))} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增评价</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          size="middle" pagination={{ pageSize: 20 }} scroll={{ x: 700 }} />
      </Card>

      <Modal title={editing ? '编辑评价' : '新增评价'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSave}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="评价人" rules={[{ required: true }]}>
            <Select placeholder="选择评价人" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name}（${m.student_id || ''}）` }))} />
          </Form.Item>
          <Form.Item name="eval_type" label="评价类型" rules={[{ required: true }]}>
            <Select options={EVAL_TYPES.map(v => ({ value: v, label: v }))} />
          </Form.Item>
          {isMutual && (
            <Form.Item name="target_member_id" label="评价对象" rules={[{ required: true }]}>
              <Select placeholder="选择评价对象" showSearch optionFilterProp="label"
                options={otherMembers.map(m => ({ value: m.id, label: `${m.name}（${m.student_id || ''}）` }))} />
            </Form.Item>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="year" label="年度" rules={[{ required: true }]}>
              <InputNumber min={2020} max={2030} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="score" label="得分" rules={[{ required: true }]}>
              <InputNumber min={0} max={200} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="comment" label="评语">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
