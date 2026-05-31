import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Select, DatePicker, Input, Tag, message, Breadcrumb, Space, Steps, Timeline, Drawer } from 'antd'
import { ArrowRightOutlined, HistoryOutlined } from '@ant-design/icons'
import { fetchDevelopment, fetchDevelopmentHistory, advanceDevelopment, fetchMeetings } from '../../services/api'
import { useLocation } from 'react-router-dom'
import dayjs from 'dayjs'

const STAGE_COLORS = {
  申请人: 'default',
  积极分子: 'orange',
  发展对象: 'volcano',
  预备党员: 'blue',
  正式党员: 'green',
}

const STAGE_ORDER = ['申请人', '积极分子', '发展对象', '预备党员', '正式党员']

const PATH_TO_STATUS = { applicant: '申请人', activist: '积极分子', candidate: '发展对象', probationary: '预备党员' }

export default function DevelopmentPage() {
  const location = useLocation()
  const pathSeg = location.pathname.split('/').filter(Boolean).pop()
  const defaultFilter = PATH_TO_STATUS[pathSeg] || ''

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState(defaultFilter)
  const [meetings, setMeetings] = useState([])

  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advancing, setAdvancing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [advanceForm] = Form.useForm()

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyData, setHistoryData] = useState(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [dev, mts] = await Promise.all([
        fetchDevelopment({ search, status: filterStatus }),
        fetchMeetings({ page_size: 200 }),
      ])
      setData(dev || [])
      setMeetings(mts?.items || mts || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterStatus])

  const openAdvance = (member) => {
    setAdvancing(member)
    advanceForm.resetFields()
    const currentIdx = STAGE_ORDER.indexOf(member.party_status)
    const next = currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
      ? STAGE_ORDER[currentIdx + 1] : null
    advanceForm.setFieldsValue({ to_status: next, meeting_date: null })
    setAdvanceOpen(true)
  }

  const handleAdvance = async () => {
    try {
      const values = await advanceForm.validateFields()
      setSaving(true)
      const payload = {
        member_id: advancing.id,
        to_status: values.to_status,
        meeting_id: values.meeting_id,
        meeting_date: values.meeting_date ? values.meeting_date.format('YYYY-MM-DD') : '',
        decision: values.decision || '',
        notes: values.notes || '',
      }
      const result = await advanceDevelopment(payload)
      if (result.error) { message.error(result.error); setSaving(false); return }
      message.success(`已推进: ${result.from} → ${result.to}`)
      setAdvanceOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const openHistory = async (member) => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const res = await fetchDevelopmentHistory(member.id)
      setHistoryData(res)
    } catch { message.error('加载历程失败') }
    setHistoryLoading(false)
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '学号', dataIndex: 'student_id', width: 110 },
    {
      title: '当前阶段', dataIndex: 'party_status', width: 120,
      render: v => <Tag color={STAGE_COLORS[v] || 'default'}>{v}</Tag>,
    },
    {
      title: '最近变动', dataIndex: 'latest_record', width: 200,
      render: rec => rec
        ? <span style={{ fontSize: 12 }}>
            {rec.from_status} → {rec.to_status}
            {rec.meeting_date && <span style={{ color: '#999', marginLeft: 8 }}>{rec.meeting_date}</span>}
          </span>
        : <span style={{ color: '#ccc' }}>尚无记录</span>,
    },
    {
      title: '入党日期', dataIndex: 'join_party_date', width: 110,
      render: v => v || '-',
    },
    {
      title: '操作', key: 'ops', width: 140, fixed: 'right',
      render: (_, r) => {
        const isFormal = r.party_status === '正式党员'
        return (
          <Space>
            {!isFormal && (
              <Button type="primary" size="small" icon={<ArrowRightOutlined />}
                style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 4 }}
                onClick={() => openAdvance(r)}>推进</Button>
            )}
            <Button type="link" size="small" icon={<HistoryOutlined />}
              onClick={() => openHistory(r)}>历程</Button>
          </Space>
        )
      },
    },
  ]

  const currentIdx = advancing ? STAGE_ORDER.indexOf(advancing.party_status) : 0
  const nextStage = currentIdx >= 0 && currentIdx < STAGE_ORDER.length - 1
    ? STAGE_ORDER[currentIdx + 1] : null

  const historyMember = historyData?.member
  const historyRecords = historyData?.records || []

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '党务中心' }, { title: '发展党员' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索姓名或学号"
              value={search} onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="当前阶段" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 130 }} allowClear
              disabled={!!defaultFilter}
              options={STAGE_ORDER.map(v => ({ value: v, label: v }))} />
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
          size="middle" pagination={{ pageSize: 30, showTotal: t => `共 ${t} 人` }}
          scroll={{ x: 800 }} />
      </Card>

      <Modal title="推进发展流程" open={advanceOpen}
        onCancel={() => setAdvanceOpen(false)} onOk={handleAdvance}
        confirmLoading={saving} okText="确认推进" cancelText="取消"
        width={560} destroyOnClose>
        {advancing && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ marginBottom: 8, fontWeight: 500, color: '#333' }}>
              {advancing.name}（{advancing.student_id}）
            </div>
            <Steps current={currentIdx} size="small" style={{ marginBottom: 16 }}
              items={STAGE_ORDER.map((s, i) => ({
                title: s,
                status: i < currentIdx ? 'finish' : i === currentIdx ? 'process' : 'wait',
              }))} />
            <div style={{ background: '#fff7e6', padding: '10px 14px', borderRadius: 6, fontSize: 13, color: '#ad6800' }}>
              当前阶段：<Tag color={STAGE_COLORS[advancing.party_status]}>{advancing.party_status}</Tag>
              {nextStage ? (
                <span> → 下一步：<Tag color={STAGE_COLORS[nextStage]}>{nextStage}</Tag></span>
              ) : (
                <span>（已是最终阶段，无法继续推进）</span>
              )}
            </div>
          </div>
        )}
        <Form form={advanceForm} layout="vertical">
          <Form.Item name="to_status" label="目标阶段" rules={[{ required: true }]}>
            <Select disabled
              options={nextStage ? [{ value: nextStage, label: nextStage }] : []} />
          </Form.Item>
          <Form.Item name="meeting_id" label="关联会议">
            <Select placeholder="选择相关会议（可选）" allowClear showSearch
              optionFilterProp="label"
              options={meetings.map(m => ({
                value: m.id,
                label: `${m.title || m.name || ''} (${m.meeting_date || m.date || ''})`,
              }))} />
          </Form.Item>
          <Form.Item name="meeting_date" label="会议日期">
            <DatePicker style={{ width: '100%' }} placeholder="选择会议日期（可选）" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="decision" label="决议结果">
              <Input placeholder="如：全票通过" />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <Input placeholder="其他说明" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Drawer title="发展历程" open={historyOpen} onClose={() => setHistoryOpen(false)}
        width={480} loading={historyLoading}>
        {historyMember && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>{historyMember.name}</div>
            <Tag color={STAGE_COLORS[historyMember.party_status]} style={{ marginTop: 8 }}>
              当前：{historyMember.status_label}
            </Tag>
          </div>
        )}
        {historyRecords.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#ccc', padding: 40 }}>尚无发展记录</div>
        ) : (
          <Timeline items={historyRecords.map(r => ({
            color: 'red',
            children: (
              <div>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>
                  <Tag color={STAGE_COLORS[r.from_status] || 'default'}>{r.from_label}</Tag>
                  <ArrowRightOutlined style={{ margin: '0 4px', fontSize: 11, color: '#999' }} />
                  <Tag color={STAGE_COLORS[r.to_status] || 'default'}>{r.to_label}</Tag>
                </div>
                {r.meeting_date && <div style={{ fontSize: 12, color: '#999' }}>会议日期：{r.meeting_date}</div>}
                {r.decision && <div style={{ fontSize: 12, color: '#666' }}>决议：{r.decision}</div>}
                {r.notes && <div style={{ fontSize: 12, color: '#999' }}>备注：{r.notes}</div>}
                {r.created_at && (
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
                    {dayjs(r.created_at).format('YYYY-MM-DD HH:mm')}
                  </div>
                )}
              </div>
            ),
          }))} />
        )}
      </Drawer>
    </div>
  )
}
