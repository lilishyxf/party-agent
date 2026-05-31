import { useState, useEffect } from 'react'
import { Card, Table, Tag, message, Breadcrumb } from 'antd'
import { fetchActivities, parseDate } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const TYPE_COLOR = { learning: 'blue', exam: 'orange' }
const TYPE_LABEL = { learning: '浏览材料', exam: '完成考试' }

export default function LearningActivities() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetchActivities({ page: p })
      setData(res.items || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const columns = [
    { title: '成员', dataIndex: 'member_name', key: 'member_name', width: 100 },
    { title: '类型', dataIndex: 'type', key: 'type', width: 100,
      render: v => <Tag color={TYPE_COLOR[v] || 'default'}>{TYPE_LABEL[v] || v}</Tag> },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '时间', dataIndex: 'time', key: 'time', width: 170,
      render: v => v ? parseDate(v).toLocaleString('zh-CN') : '-' },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '学习动态管理' }]} />

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey={(_, i) => i} loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 30, onChange: p => load(p), showTotal: t => `共 ${t} 条` }} />
      </Card>
    </div>
  )
}
