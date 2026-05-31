import { useState, useEffect } from 'react'
import { Card, DatePicker, Button, Statistic, Row, Col, Table, message, Breadcrumb } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { fetchBriefing } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

export default function Briefing() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()])
  const [data, setData] = useState(null)

  const load = async () => {
    if (!dateRange || !dateRange[0] || !dateRange[1]) return
    setLoading(true)
    try {
      const res = await fetchBriefing({
        startDate: dateRange[0].format('YYYY-MM-DD'),
        endDate: dateRange[1].format('YYYY-MM-DD'),
      })
      setData(res)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const topColumns = [
    { title: '排名', key: 'rank', width: 60, render: (_, __, i) => i + 1 },
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '学号', dataIndex: 'student_id', key: 'student_id' },
    { title: '学习次数', dataIndex: 'activity_count', key: 'activity_count', align: 'center' },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '学习简报' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DatePicker.RangePicker value={dateRange} onChange={v => setDateRange(v)} style={{ width: 260 }} />
          <Button type="primary" icon={<ReloadOutlined />} onClick={load} loading={loading}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
            生成简报
          </Button>
        </div>
      </Card>

      {data && (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
            <Col span={6}>
              <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title="学习人次" value={data.learning_count} suffix="次" />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title="完成任务" value={data.task_count} suffix="个" />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title="考试通过率" value={data.pass_rate} suffix="%" precision={1} />
              </Card>
            </Col>
            <Col span={6}>
              <Card style={{ borderRadius: 10, textAlign: 'center' }}>
                <Statistic title="新增材料" value={data.new_materials} suffix="份" />
              </Card>
            </Col>
          </Row>

          <Card title="最活跃党员 Top 5" style={{ borderRadius: 10 }}>
            <Table columns={topColumns} dataSource={data.top_learners || []} rowKey="name" loading={loading}
              pagination={false} size="middle" />
          </Card>
        </>
      )}
    </div>
  )
}
