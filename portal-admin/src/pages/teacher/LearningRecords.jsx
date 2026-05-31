import { useState, useEffect } from 'react'
import { Card, Table, Button, Input, message, Breadcrumb, Space, Tag } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import { fetchLearningRecords, exportLearningRecords } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function LearningRecords() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const load = async (p = 1, s = search) => {
    setLoading(true)
    try {
      const res = await fetchLearningRecords({ page: p, search: s })
      setData(res.items || [])
      setTotal(res.total || 0)
      setPage(p)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onSearch = () => load(1)

  const columns = [
    { title: '姓名', dataIndex: 'name', key: 'name', width: 100 },
    { title: '学号', dataIndex: 'student_id', key: 'student_id', width: 100 },
    { title: '浏览材料', dataIndex: 'material_count', key: 'material_count', width: 90, align: 'center' },
    { title: '完成任务', dataIndex: 'task_count', key: 'task_count', width: 90, align: 'center' },
    { title: '考试次数', dataIndex: 'exam_count', key: 'exam_count', width: 90, align: 'center' },
    { title: '考试均分', dataIndex: 'avg_score', key: 'avg_score', width: 90, align: 'center',
      render: v => v != null ? v : '-' },
    { title: '通过率', dataIndex: 'pass_rate', key: 'pass_rate', width: 80, align: 'center',
      render: v => v != null ? <Tag color={v >= 60 ? 'green' : 'red'}>{v}%</Tag> : '-' },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '学习档案管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Input.Search placeholder="搜索姓名..." prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)}
            onSearch={onSearch} style={{ width: 220, borderRadius: 6 }} allowClear />
          <Button onClick={() => { setSearch(''); load(1, '') }}>重置</Button>
          <Button icon={<DownloadOutlined />} onClick={() => exportLearningRecords().catch(() => message.error('导出失败'))}>导出 Excel</Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="member_id" loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, onChange: p => load(p), showTotal: t => `共 ${t} 人` }} />
      </Card>
    </div>
  )
}
