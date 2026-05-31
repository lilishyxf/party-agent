import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, InputNumber, Select, DatePicker, Tag, message, Breadcrumb, Space, Drawer } from 'antd'
import { PlusOutlined, EyeOutlined } from '@ant-design/icons'
import { fetchExams, createExam, fetchExamResults, fetchQuestions, fetchMembers, parseDate } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const CATEGORY_OPTIONS = [
  { label: '党章党纪', value: 'charter' },
  { label: '时政方针', value: 'policy' },
  { label: '党史学习', value: 'history' },
  { label: '党性教育', value: 'education' },
  { label: '综合', value: 'general' },
]

export default function Exams() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [form] = Form.useForm()

  // 创建考试用
  const [questions, setQuestions] = useState([])
  const [questionsLoading, setQuestionsLoading] = useState(false)
  const [members, setMembers] = useState([])

  // 成绩抽屉
  const [resultsOpen, setResultsOpen] = useState(false)
  const [results, setResults] = useState(null)

  const load = async (p = 1) => {
    setLoading(true)
    try {
      const res = await fetchExams({ page: p })
      setData(res.items)
      setTotal(res.total)
      setPage(p)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = async () => {
    form.resetFields()
    form.setFieldsValue({ pass_score: 60 })
    setModalOpen(true)
    // 预加载题目和成员
    setQuestionsLoading(true)
    try {
      const [qRes, mRes] = await Promise.all([
        fetchQuestions({ page_size: 9999 }),
        fetchMembers(),
      ])
      setQuestions(qRes.items || [])
      setMembers(mRes || [])
    } catch { message.error('加载题目/成员失败') }
    setQuestionsLoading(false)
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      const payload = {
        title: values.title,
        question_ids: values.question_ids,
        member_ids: values.member_ids || [],
        pass_score: values.pass_score || 60,
        start_time: values.time_range?.[0]?.toISOString() || '',
        end_time: values.time_range?.[1]?.toISOString() || '',
      }
      await createExam(payload)
      message.success('考试已创建')
      setModalOpen(false)
      load(page)
    } catch { message.error('创建失败') }
  }

  const viewResults = async (examId) => {
    try {
      const res = await fetchExamResults(examId)
      setResults(res)
      setResultsOpen(true)
    } catch { message.error('加载成绩失败') }
  }

  const columns = [
    { title: '考试名称', dataIndex: 'title', key: 'title', width: 200 },
    { title: '题数', dataIndex: 'question_count', key: 'question_count', width: 70, align: 'center' },
    { title: '及格分', dataIndex: 'pass_score', key: 'pass_score', width: 80, align: 'center' },
    { title: '已分配', dataIndex: 'assigned_count', key: 'assigned_count', width: 80, align: 'center' },
    { title: '已提交', dataIndex: 'submitted_count', key: 'submitted_count', width: 80, align: 'center' },
    { title: '开始时间', dataIndex: 'start_time', key: 'start_time', width: 150,
      render: v => v ? parseDate(v).toLocaleString() : '-' },
    { title: '截止时间', dataIndex: 'end_time', key: 'end_time', width: 150,
      render: v => v ? parseDate(v).toLocaleString() : '-' },
    { title: '操作', key: 'ops', width: 100,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EyeOutlined />}
          onClick={() => viewResults(r.id)}>成绩</Button>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '考试中心' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#666' }}>共 {total} 场考试</span>
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}
            onClick={openCreate}>创建考试</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, onChange: p => load(p), showTotal: t => `共 ${t} 场` }} />
      </Card>

      {/* 创建考试弹窗 */}
      <Modal title="创建考试" open={modalOpen} onOk={handleSubmit} onCancel={() => setModalOpen(false)}
        width={680} okText="创建" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="考试名称" rules={[{ required: true, message: '请输入考试名称' }]}>
            <Input placeholder="例：2026年第一季度党章知识测试" />
          </Form.Item>
          <Form.Item name="pass_score" label="及格分">
            <InputNumber min={0} max={100} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="time_range" label="考试时间范围">
            <DatePicker.RangePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="question_ids" label="选择题目" rules={[{ required: true, message: '请至少选择一道题目' }]}>
            <Select mode="multiple" placeholder="搜索并选择题库中的题目"
              loading={questionsLoading} showSearch optionFilterProp="label"
              options={questions.map(q => ({
                label: `[${CATEGORY_OPTIONS.find(c => c.value === q.category)?.label || q.category}] ${q.content?.substring(0, 50)}...`,
                value: q.id,
              }))} />
          </Form.Item>
          <Form.Item name="member_ids" label="指定参考党员（留空则全员参加）">
            <Select mode="multiple" placeholder="选择参考党员，留空默认全员"
              showSearch optionFilterProp="label"
              options={members.map(m => ({
                label: `${m.name} (${m.student_id})`,
                value: m.id,
              }))} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 成绩抽屉 */}
      <Drawer title={results ? `考试成绩 - ${results.title}` : '考试成绩'} open={resultsOpen}
        onClose={() => setResultsOpen(false)} width={500}>
        {results && (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>及格分：{results.pass_score}</p>
            {results.results?.map((r, i) => (
              <Card key={i} size="small" style={{ marginBottom: 8, borderRadius: 8 }}
                bodyStyle={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.member_name}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{r.openid}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <Tag color={r.status === 'submitted' ? (r.score >= results.pass_score ? 'green' : 'red') : 'default'}>
                      {r.status === 'submitted' ? `${r.score}分` : '未提交'}
                    </Tag>
                    {r.submitted_at && <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>{parseDate(r.submitted_at).toLocaleString()}</div>}
                  </div>
                </div>
              </Card>
            ))}
            {(!results.results || results.results.length === 0) && (
              <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>暂无考生</div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}
