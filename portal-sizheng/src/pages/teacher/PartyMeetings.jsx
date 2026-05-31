import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Table, Modal, Form, Input, Select, DatePicker, Space, message, Popconfirm, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchMeetings, fetchMeetingStats, createMeeting, updateMeeting, deleteMeeting } from '../../services/api'
import dayjs from 'dayjs'

const TYPE_MAP = {
  party_member_congress: '党员大会',
  branch_committee: '支委会',
  party_group: '党小组会',
  party_lecture: '党课',
  theme_party_day: '主题党日活动',
  org_life_meeting: '组织生活会',
  democratic_evaluation: '民主评议党员',
  theory_study: '理论学习',
  dev_activist: '确定入党积极分子',
  dev_candidate: '确定发展对象',
  dev_probationary: '吸收预备党员',
  probationary_full: '预备党员转正',
  committee_report: '支委会报告工作',
  member_report: '党员汇报',
  talk_heart: '谈心谈话',
}

const TYPE_COLORS = {
  party_member_congress: '#d32f2f',
  branch_committee: '#1976d2',
  party_group: '#388e3c',
  party_lecture: '#7b1fa2',
  theme_party_day: '#e65100',
  org_life_meeting: '#c62828',
  democratic_evaluation: '#6a1b9a',
  theory_study: '#00695c',
  dev_activist: '#bf360c',
  dev_candidate: '#4a148c',
  dev_probationary: '#b71c1c',
  probationary_full: '#880e4f',
  committee_report: '#0d47a1',
  member_report: '#1b5e20',
  talk_heart: '#78909c',
}

const COMPLIANCE = [
  { type: 'branch_committee', label: '支委会', period: '本月', scope: 'month', min: 1 },
  { type: 'party_member_congress', label: '党员大会', period: '本季', scope: 'quarter', min: 1 },
  { type: 'party_lecture', label: '党课', period: '本季', scope: 'quarter', min: 1 },
  { type: 'theme_party_day', label: '主题党日', period: '本月', scope: 'month', min: 1 },
  { type: 'party_group', label: '党小组会', period: '本月', scope: 'month', min: 1, suggest: true },
]

const COMMON_FIELDS = [
  { name: 'title', label: '会议标题', rules: [{ required: true }] },
  { name: 'meeting_date', label: '会议日期', type: 'date', rules: [{ required: true }] },
  { name: 'location', label: '地点', rules: [{ required: true }] },
  { name: 'host', label: '主持人', rules: [{ required: true }] },
  { name: 'recorder', label: '记录人', rules: [{ required: true }] },
  { name: 'attendees', label: '出席人员', type: 'textarea', rules: [{ required: true }], hint: '一行一个姓名' },
  { name: 'observers', label: '列席人员', type: 'textarea', hint: '一行一个姓名，含职务标注' },
  { name: 'absentees', label: '缺席人员', type: 'textarea', hint: '一行一个姓名+原因' },
  { name: 'topic', label: '会议主题', type: 'textarea', rules: [{ required: true }] },
  { name: 'content', label: '会议内容', type: 'textarea' },
]

export default function PartyMeetings({ filterType = '', filterTypes = [], pageTitle = '会议管理', parentTitle = '活动中心' }) {
  const typeParam = filterTypes.length > 0 ? filterTypes.join(',') : filterType
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [currentType, setCurrentType] = useState(filterType)
  const [stats, setStats] = useState(null)

  const loadStats = async () => {
    try { setStats(await fetchMeetingStats()) } catch { /* silently fail */ }
  }

  const load = async (p = 1, s = '', t = null) => {
    setLoading(true)
    try {
      const res = await fetchMeetings({ type: t ?? typeParam, search: s, page: p, page_size: 20 })
      setData(res.items || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch { message.error('加载会议列表失败') }
    setLoading(false)
  }

  useEffect(() => { load(1, '', typeParam); loadStats() }, [typeParam])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ meeting_type: filterType || 'party_member_congress',
      meeting_date: dayjs(), attendees: '', observers: '', absentees: '', topic: '', content: '' })
    setCurrentType(filterType)
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue({ ...record, meeting_date: record.meeting_date ? dayjs(record.meeting_date) : null })
    setCurrentType(record.meeting_type)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteMeeting(id); message.success('已删除'); load(page, search); loadStats() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, meeting_date: values.meeting_date.format('YYYY-MM-DD') }
      if (editing) {
        await updateMeeting(editing.id, payload)
        message.success('已更新')
      } else {
        await createMeeting(payload)
        message.success('已创建')
      }
      setModalOpen(false)
      load(page, search)
      loadStats()
    } catch (e) {
      if (e.errorFields) return
      message.error('保存失败')
    }
    setSaving(false)
  }

  const columns = [
    { title: '日期', dataIndex: 'meeting_date', width: 110, render: v => v?.split('T')[0] },
    { title: '类型', dataIndex: 'meeting_type', width: 130,
      render: v => <Tag color={TYPE_COLORS[v]}>{TYPE_MAP[v] || v}</Tag> },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '主持人', dataIndex: 'host', width: 90 },
    { title: '地点', dataIndex: 'location', width: 120, ellipsis: true },
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
        items={[{ title: parentTitle }, { title: pageTitle }]} />

      {/* Compliance Dashboard */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
          {COMPLIANCE.map(c => {
            const count = stats[c.scope]?.[c.type] || 0
            const met = count >= c.min
            const color = met ? '#389e0d' : (c.suggest ? '#d48806' : '#d32f2f')
            const status = met ? '✓ 达标' : (c.suggest ? '⚠ 建议' : '✗ 未达标')
            return (
              <div key={c.type} style={{
                background: '#fff', borderRadius: 8, padding: '14px 16px',
                borderLeft: `4px solid ${color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
              }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 4 }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#333' }}>
                  {count} <span style={{ fontSize: 13, fontWeight: 400, color: '#999' }}>/ {c.min} 次</span>
                </div>
                <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{c.period}</div>
                <div style={{ fontSize: 12, marginTop: 4, color, fontWeight: 500 }}>{status}</div>
              </div>
            )
          })}
        </div>
      )}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Select placeholder="会议类型" allowClear style={{ width: 160 }}
              value={currentType || undefined}
              onChange={v => { setCurrentType(v || ''); setPage(1) }}
              options={Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v }))} />
            <Input.Search placeholder="搜索标题" allowClear style={{ width: 240 }}
              onSearch={v => { setSearch(v); load(1, v) }} />
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f' }}>
            新建会议
          </Button>
        </div>

        <Table rowKey="id" columns={columns} dataSource={data}
          loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, showTotal: t => `共 ${t} 条`,
            onChange: p => load(p, search) }} />
      </Card>

      <Modal title={editing ? '编辑会议' : '新建会议'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={640} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="meeting_type" label="会议类型" rules={[{ required: true }]}>
            <Select options={Object.entries(TYPE_MAP).map(([k, v]) => ({ value: k, label: v }))}
              onChange={v => setCurrentType(v)} />
          </Form.Item>
          {COMMON_FIELDS.map(f => (
            <Form.Item key={f.name} name={f.name} label={f.label} rules={f.rules || []}
              extra={f.hint ? <span style={{ fontSize: 11, color: '#999' }}>{f.hint}</span> : undefined}>
              {f.type === 'date'
                ? <DatePicker style={{ width: '100%' }} />
                : f.type === 'textarea'
                  ? <Input.TextArea rows={f.name === 'content' ? 5 : 3} />
                  : <Input placeholder={f.label} />}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </div>
  )
}
