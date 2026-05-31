import { useState, useEffect } from 'react'
import { Card, Table, Select, Breadcrumb, Tag } from 'antd'
import { fetchOperationLogs, fetchAdminUsers } from '../../services/api'

const ACTION_MAP = { 登录: 'green', 创建: 'blue', 更新: 'orange', 删除: 'red' }

export default function LogsPage() {
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [filterUser, setFilterUser] = useState(0)
  const [filterAction, setFilterAction] = useState('')
  const [admins, setAdmins] = useState([])

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchOperationLogs({ page, page_size: 25, admin_user_id: filterUser, action: filterAction })
      setData(res.list || [])
      setTotal(res.total || 0)
    } catch { }
    setLoading(false)
  }

  useEffect(() => { load() }, [page, filterUser, filterAction])
  useEffect(() => { fetchAdminUsers().then(setAdmins).catch(() => {}) }, [])

  const columns = [
    { title: '操作人', dataIndex: 'username', width: 100 },
    { title: '操作', dataIndex: 'action', width: 70, render: v => <Tag color={ACTION_MAP[v] || 'default'}>{v}</Tag> },
    { title: '对象类型', dataIndex: 'target_type', width: 110 },
    { title: '详情', dataIndex: 'detail', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', width: 170, render: v => v ? v.slice(0, 19).replace('T', ' ') : '-' },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '系统管理' }, { title: '操作日志' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Select placeholder="筛选操作人" allowClear style={{ width: 160 }}
            value={filterUser || undefined} onChange={v => { setFilterUser(v || 0); setPage(1) }}
            options={admins.map(a => ({ value: a.id, label: a.real_name }))} />
          <Select placeholder="筛选操作类型" allowClear style={{ width: 140 }}
            value={filterAction || undefined} onChange={v => { setFilterAction(v || ''); setPage(1) }}
            options={['登录', '创建', '更新', '删除'].map(v => ({ value: v, label: v }))} />
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ current: page, pageSize: 25, total, showTotal: t => `共 ${t} 条`, onChange: setPage }} />
      </Card>
    </div>
  )
}
