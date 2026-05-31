import { useState, useEffect } from 'react'
import { Card, Row, Col, Statistic, Breadcrumb, Table, Tag, Spin, Button } from 'antd'
import { UserOutlined, BankOutlined, CalendarOutlined, PercentageOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { useLocation } from 'react-router-dom'
import { fetchDashboardStats } from '../../services/api'

const COLORS = ['#d32f2f', '#1976d2', '#e65100', '#2e7d32', '#7b1fa2', '#00838f', '#c62828', '#6a1b9a', '#4527a0', '#283593', '#1565c0', '#00897b', '#558b2f', '#f9a825', '#ef6c00']
const ACTION_MAP = { 登录: 'green', 创建: 'blue', 更新: 'orange', 删除: 'red' }

function ChartCard({ title, children, height = 300 }) {
  return (
    <Card title={title} style={{ borderRadius: 10, height: '100%' }}>
      <ResponsiveContainer width="100%" height={height}>
        {children}
      </ResponsiveContainer>
    </Card>
  )
}

function PieChartCard({ title, data, dataKey = 'value', nameKey = 'name', height = 280 }) {
  return (
    <ChartCard title={title} height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} cx="50%" cy="50%"
          outerRadius={90} label={({ name, value }) => `${name} ${value}人`}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ChartCard>
  )
}

function BarChartCard({ title, data, dataKey = 'value', nameKey = 'name', height = 280 }) {
  return (
    <ChartCard title={title} height={height}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={nameKey} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey={dataKey} fill="#d32f2f" name="人数" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Bar>
      </BarChart>
    </ChartCard>
  )
}

const BREADCRUMB_MAP = {
  'structure-stats': [{ title: '数据统计' }, { title: '党员结构分析' }],
  'participation': [{ title: '数据统计' }, { title: '活动参与率' }],
  'dues-rate': [{ title: '数据统计' }, { title: '党费收缴率' }],
}

export default function DashboardPage() {
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)
  const subView = pathParts[1] || null

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [duesYear, setDuesYear] = useState(new Date().getFullYear())

  useEffect(() => {
    setLoading(true)
    fetchDashboardStats(duesYear).then(s => { setStats(s); setLoading(false) }).catch(() => setLoading(false))
  }, [duesYear])

  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'60vh' }}><Spin size="large" /></div>

  const {
    total_members, total_branches, month_meetings, dues_rate,
    status_distribution = [], role_distribution = [], gender_distribution = [],
    education_distribution = [], ethnicity_distribution = [], title_distribution = [],
    student_status_distribution = [], age_distribution = [],
    meeting_trend = [], meeting_type_distribution = [], recent_activity = [],
    dues_quarterly = [], dues_years = [], dues_year
  } = stats

  const breadcrumb = BREADCRUMB_MAP[subView] || [{ title: '可视化' }, { title: '数据仪表盘' }]

  const showAll = !subView
  const showStructure = showAll || subView === 'structure-stats'
  const showParticipation = showAll || subView === 'participation'
  const showDues = showAll || subView === 'dues-rate'

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={breadcrumb} />

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={12} lg={showAll ? 6 : 8}>
          <Card style={{ borderRadius: 10 }}>
            <Statistic title="党员总数" value={total_members} prefix={<UserOutlined style={{ color: '#d32f2f' }} />} />
          </Card>
        </Col>
        {showAll && (
          <Col xs={12} sm={12} lg={6}>
            <Card style={{ borderRadius: 10 }}>
              <Statistic title="党支部数" value={total_branches} prefix={<BankOutlined style={{ color: '#1976d2' }} />} />
            </Card>
          </Col>
        )}
        {(showAll || showParticipation) && (
          <Col xs={12} sm={12} lg={showAll ? 6 : 8}>
            <Card style={{ borderRadius: 10 }}>
              <Statistic title="本月会议" value={month_meetings} suffix="次" prefix={<CalendarOutlined style={{ color: '#2e7d32' }} />} />
            </Card>
          </Col>
        )}
        {(showAll || showDues) && (
          <Col xs={12} sm={12} lg={showAll ? 6 : 8}>
            <Card style={{ borderRadius: 10 }}>
              <Statistic title="本月党费收缴率" value={dues_rate} suffix="%" precision={1}
                prefix={<PercentageOutlined style={{ color: dues_rate >= 80 ? '#2e7d32' : '#e65100' }} />} />
            </Card>
          </Col>
        )}
      </Row>

      {/* 党员结构分析 */}
      {showStructure && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <PieChartCard title="党员状态分布" data={status_distribution} />
            </Col>
            <Col span={12}>
              <PieChartCard title="党内角色分布" data={role_distribution} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <PieChartCard title="性别分布" data={gender_distribution} />
            </Col>
            <Col span={12}>
              <BarChartCard title="学历结构" data={education_distribution} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <BarChartCard title="民族分布" data={ethnicity_distribution} />
            </Col>
            <Col span={12}>
              <BarChartCard title="职称分布" data={title_distribution} />
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={12}>
              <PieChartCard title="学生面貌分布" data={student_status_distribution} />
            </Col>
            <Col span={12}>
              <BarChartCard title="年龄分布" data={age_distribution} />
            </Col>
          </Row>
        </>
      )}

      {/* 活动参与分析 */}
      {showParticipation && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={12}>
            <PieChartCard title="会议类型分布" data={meeting_type_distribution} />
          </Col>
          <Col span={12}>
            <ChartCard title="近6月会议趋势" height={280}>
              <BarChart data={meeting_trend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#d32f2f" name="会议数" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartCard>
          </Col>
        </Row>
      )}

      {/* 党费分析 — 年度四季度柱状图 + 年份翻页 */}
      {showDues && (
        <Card title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>党费收缴概览</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button size="small" icon={<LeftOutlined />} disabled={!dues_years.includes(duesYear - 1)}
                onClick={() => setDuesYear(y => y - 1)} />
              <span style={{ fontWeight: 700, fontSize: 16, minWidth: 60, textAlign: 'center' }}>{duesYear}</span>
              <Button size="small" icon={<RightOutlined />} disabled={!dues_years.includes(duesYear + 1)}
                onClick={() => setDuesYear(y => y + 1)} />
            </div>
          </div>
        } style={{ borderRadius: 10, marginBottom: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dues_quarterly} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="quarter" />
              <YAxis tickFormatter={v => `¥${v}`} />
              <Tooltip formatter={(value) => [`¥${value}`, undefined]} />
              <Legend />
              <Bar dataKey="total" name="应收金额" fill="#90caf9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="paid" name="实收金额" fill="#d32f2f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 32, marginTop: 12, fontSize: 13, color: '#666' }}>
            {dues_quarterly.map(q => (
              <span key={q.quarter}>{q.quarter} 收缴率 <b style={{ color: q.rate >= 80 ? '#2e7d32' : q.rate >= 60 ? '#f9a825' : '#d32f2f' }}>{q.rate}%</b></span>
            ))}
          </div>
        </Card>
      )}

      {/* 最近动态 — 仅全览显示 */}
      {showAll && (
        <Card title="最近操作动态" style={{ borderRadius: 10 }}>
          <Table dataSource={recent_activity} rowKey="id" size="small" pagination={false}
            columns={[
              { title: '操作人', dataIndex: 'username', width: 100 },
              { title: '操作', dataIndex: 'action', width: 70, render: v => <Tag color={ACTION_MAP[v] || 'default'}>{v}</Tag> },
              { title: '详情', dataIndex: 'detail', ellipsis: true },
              { title: '时间', dataIndex: 'created_at', width: 170, render: v => v ? v.slice(0, 19).replace('T', ' ') : '-' },
            ]} />
        </Card>
      )}
    </div>
  )
}
