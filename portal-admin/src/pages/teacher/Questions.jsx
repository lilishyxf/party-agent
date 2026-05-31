import { useState, useEffect } from 'react'
import { Card, Table, Button, Select, Popconfirm, message, Breadcrumb, Tag, Modal, Space, InputNumber, Alert, Divider } from 'antd'
import { DeleteOutlined, EyeOutlined, RobotOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { fetchQuestions, deleteQuestion, generateQuestions, preGenerateAll } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = [
  { label: '全部', value: '' },
  { label: '党章党纪', value: 'charter' },
  { label: '时政方针', value: 'policy' },
  { label: '党史学习', value: 'history' },
  { label: '党性教育', value: 'education' },
]

const CAT_COLOR = { charter: 'red', policy: 'volcano', history: 'gold', education: 'green' }

function parseOptions(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

export default function Questions() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [category, setCategory] = useState('')
  const [detail, setDetail] = useState(null)
  const [genModalOpen, setGenModalOpen] = useState(false)
  const [genCategory, setGenCategory] = useState('charter')
  const [genDifficulty, setGenDifficulty] = useState('medium')
  const [genCount, setGenCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState(null)

  const load = async (p = 1, c = category) => {
    setLoading(true)
    try {
      const res = await fetchQuestions({ page: p, category: c, page_size: 20 })
      setData(res.items)
      setTotal(res.total)
      setPage(p)
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id) => {
    try { await deleteQuestion(id); message.success('已删除'); load(page) }
    catch { message.error('删除失败') }
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await generateQuestions({ category: genCategory, difficulty: genDifficulty, count: genCount })
      if (res.status === 'ok') {
        setGenResult({ type: 'single', generated: res.generated, category: genCategory, difficulty: genDifficulty })
      } else {
        message.error(res.message || '出题失败')
      }
    } catch { message.error('AI 出题请求失败') }
    setGenerating(false)
    load(page)
  }

  const handleBulkGenerate = async () => {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await preGenerateAll(40)
      if (res.status === 'ok') {
        setGenResult({ type: 'bulk', by_category: res.by_category, grand_total: res.grand_total })
      } else {
        message.error(res.message || '批量出题失败')
      }
    } catch { message.error('AI 批量出题请求失败') }
    setGenerating(false)
    load(page)
  }

  const columns = [
    { title: '#', dataIndex: 'id', key: 'id', width: 60 },
    { title: '题目', dataIndex: 'content', key: 'content', width: 280, ellipsis: true },
    { title: '分类', dataIndex: 'category', key: 'category', width: 100,
      render: v => <Tag color={CAT_COLOR[v] || 'default'}>{CATEGORIES.find(c => c.value === v)?.label || v}</Tag> },
    { title: '难度', dataIndex: 'difficulty', key: 'difficulty', width: 80 },
    { title: '答案', dataIndex: 'answer', key: 'answer', width: 60,
      render: v => <Tag color="green">{v}</Tag> },
    { title: '操作', key: 'ops', width: 120,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>详情</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '题库管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space wrap>
          <Select placeholder="分类筛选" value={category || undefined}
            onChange={v => { setCategory(v || ''); load(1, v || '') }}
            options={CATEGORIES} style={{ width: 130 }} allowClear />
          <Button icon={<RobotOutlined />} onClick={() => { setGenModalOpen(true); setGenResult(null) }}
            style={{ borderRadius: 6, background: '#fff', borderColor: '#d32f2f', color: '#d32f2f' }}>
            AI 智能出题
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ current: page, total, pageSize: 20, onChange: p => load(p), showTotal: t => `共 ${t} 题` }} />
      </Card>

      <Modal title={<Space><RobotOutlined /> AI 智能出题</Space>} open={genModalOpen}
        onCancel={() => setGenModalOpen(false)} footer={null} width={560} destroyOnClose>
        {genResult ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            {genResult.type === 'single' ? (
              <Alert type="success" showIcon
                message={`成功生成 ${genResult.generated} 道新题目`}
                description={`分类: ${CATEGORIES.find(c => c.value === genResult.category)?.label} | 难度: ${genResult.difficulty}`} />
            ) : (
              <div>
                <Alert type="success" showIcon
                  message={`批量生成完成，共新增 ${genResult.grand_total} 道题目`} style={{ marginBottom: 12 }} />
                {genResult.by_category && Object.entries(genResult.by_category).map(([cat, diffs]) => (
                  <Card key={cat} size="small" style={{ marginBottom: 8, textAlign: 'left' }}
                    title={CATEGORIES.find(c => c.value === cat)?.label || cat}>
                    {typeof diffs === 'object' && Object.entries(diffs).map(([d, n]) => (
                      <Tag key={d} color="blue">{d}: {n} 题</Tag>
                    ))}
                  </Card>
                ))}
              </div>
            )}
            <Button type="primary" style={{ marginTop: 16 }}
              onClick={() => setGenModalOpen(false)}>关闭</Button>
          </div>
        ) : (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message={<><strong>AI 智能出题</strong> — 调用 Dify 工作流自动生成党建题目，自动去重入库</>} />

            <Divider orientation="plain" plain>单类出题</Divider>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>分类</div>
                <Select value={genCategory} onChange={setGenCategory} style={{ width: '100%' }}
                  options={CATEGORIES.filter(c => c.value)} />
              </div>
              <div>
                <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>难度</div>
                <Select value={genDifficulty} onChange={setGenDifficulty} style={{ width: '100%' }}
                  options={[{ value: 'easy', label: '简单' }, { value: 'medium', label: '中等' }, { value: 'hard', label: '困难' }]} />
              </div>
              <div>
                <div style={{ marginBottom: 4, color: '#666', fontSize: 13 }}>数量</div>
                <InputNumber min={1} max={50} value={genCount} onChange={setGenCount} style={{ width: '100%' }} />
              </div>
            </div>
            <Button block icon={<RobotOutlined />} onClick={handleGenerate} loading={generating}
              style={{ borderRadius: 8, height: 40, background: '#d32f2f', borderColor: '#d32f2f', color: '#fff' }}>
              {generating ? 'AI 出题中...' : '开始 AI 出题'}
            </Button>

            <Divider orientation="plain" plain>一键填充</Divider>
            <Alert type="warning" showIcon style={{ marginBottom: 12 }}
              message="一键填充将为全部 4 个分类各生成约 40 道题（简单/中等/困难均匀分布），耗时较长，请耐心等待。" />
            <Button block icon={<ThunderboltOutlined />} onClick={handleBulkGenerate} loading={generating}
              style={{ borderRadius: 8, height: 40 }}>
              一键填充全部分类（目标每类 40 题）
            </Button>
          </>
        )}
      </Modal>

      <Modal title="题目详情" open={!!detail} onCancel={() => setDetail(null)} footer={null} width={640}>
        {detail && (
          <div style={{ lineHeight: 2 }}>
            <p><strong>题目：</strong>{detail.content}</p>
            <p><strong>分类：</strong><Tag color={CAT_COLOR[detail.category]}>{CATEGORIES.find(c => c.value === detail.category)?.label}</Tag></p>
            <p><strong>难度：</strong>{detail.difficulty}</p>
            <p><strong>选项：</strong></p>
            <ol style={{ paddingLeft: 24 }}>
              {parseOptions(detail.options).map((opt, i) => (
                <li key={i} style={String(opt).startsWith(detail.answer) ? { color: '#2e7d32', fontWeight: 600 } : undefined}>
                  {typeof opt === 'object' ? JSON.stringify(opt) : String(opt)}
                </li>
              ))}
            </ol>
            <p><strong>正确答案：</strong><Tag color="green">{detail.answer}</Tag></p>
            {detail.explanation && <p><strong>解析：</strong>{detail.explanation}</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
