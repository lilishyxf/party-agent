import { useState, useEffect } from 'react'
import { Card, Table, Progress, Tag, Breadcrumb, Select, Space } from 'antd'
import { fetchTaskProgress, fetchMembers } from '../../services/api'

export default function TaskProgressPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState([])
  const [filterMember, setFilterMember] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [progress, m] = await Promise.all([
        fetchTaskProgress(),
        fetchMembers({ page_size: 500 }),
      ])
      setData(progress || [])
      setMembers(m?.items || m || [])
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = filterMember
    ? data.map(t => ({
        ...t,
        detail: (t.detail || []).filter(d => d.member_id === filterMember),
      })).filter(t => t.detail.length > 0)
    : data

  const expandedRowRender = (task) => (
    <Table
      dataSource={task.detail || []}
      rowKey="member_id"
      size="small"
      pagination={false}
      columns={[
        { title: '党员', dataIndex: 'member_name', width: 100 },
        {
          title: '状态', dataIndex: 'status', width: 100,
          render: v => v === 'completed'
            ? <Tag color="green">已完成</Tag>
            : <Tag color="default">未完成</Tag>,
        },
        { title: '完成时间', dataIndex: 'completed_at', width: 160, render: v => v || '-' },
      ]}
    />
  )

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '学习中心' }, { title: '学习动态管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Select placeholder="筛选党员" value={filterMember} onChange={setFilterMember}
            style={{ width: 180 }} allowClear showSearch optionFilterProp="label"
            options={members.map(m => ({ value: m.id, label: `${m.name}（${m.student_id || ''}）` }))} />
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table dataSource={filtered} rowKey="id" loading={loading}
          size="middle" pagination={{ pageSize: 20 }}
          expandable={{ expandedRowRender }}
          columns={[
            { title: '任务名称', dataIndex: 'title', width: 200 },
            { title: '截止日期', dataIndex: 'deadline', width: 110, render: v => v || '-' },
            {
              title: '完成进度', dataIndex: 'rate', width: 200,
              render: (v, r) => (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Progress percent={v} size="small" style={{ flex: 1, margin: 0 }}
                    strokeColor={v === 100 ? '#52c41a' : '#1677ff'} />
                  <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>
                    {r.completed}/{r.total_assigned}
                  </span>
                </div>
              ),
            },
          ]} />
      </Card>
    </div>
  )
}
