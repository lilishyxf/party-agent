import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Table, Tag, Button, Space, Popconfirm, message } from 'antd'
import { VideoCameraOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons'
import { fetchVideoProjects, deleteVideoProject } from '../services/api'

const STATUS_MAP = {
  pending: { color: 'default', label: '等待中' },
  aligning: { color: 'processing', label: '对齐规划' },
  narrating: { color: 'processing', label: '旁白生成' },
  prompt_generating: { color: 'processing', label: '分镜生成' },
  prompts_review: { color: 'warning', label: '待审核脚本' },
  image_generating: { color: 'processing', label: '图像生成' },
  images_review: { color: 'warning', label: '待审核图像' },
  video_generating: { color: 'processing', label: '视频生成' },
  assembling: { color: 'processing', label: '后期合成' },
  done: { color: 'success', label: '已完成' },
  failed: { color: 'error', label: '失败' },
  cancelled: { color: 'default', label: '已取消' },
}

export default function VideoHistory() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  const loadProjects = async () => {
    setLoading(true)
    try {
      const data = await fetchVideoProjects({ page: 1, page_size: 50 })
      setProjects(data.items || [])
    } catch (e) {
      message.error('加载项目列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProjects() }, [])

  const handleDelete = async (id) => {
    try {
      await deleteVideoProject(id)
      message.success('已删除')
      loadProjects()
    } catch (e) {
      message.error('删除失败')
    }
  }

  const columns = [
    {
      title: '标题', dataIndex: 'title', key: 'title',
      render: (text, record) => (
        <a onClick={() => navigate(`/create?id=${record.id}`)}>{text || '未命名'}</a>
      ),
    },
    {
      title: '知识点', dataIndex: 'knowledge_point', key: 'knowledge_point', ellipsis: true, width: 200,
    },
    {
      title: '风格', dataIndex: 'style_track', key: 'style_track', width: 100,
      render: (v) => {
        const map = { flat_illustration: '扁平插画', industrial_documentary: '工业纪实', historical_humanities: '历史人文' }
        return map[v] || v
      },
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 120,
      render: (v) => {
        const s = STATUS_MAP[v] || { color: 'default', label: v }
        return <Tag color={s.color}>{s.label}</Tag>
      },
    },
    {
      title: '进度', dataIndex: 'progress_pct', key: 'progress_pct', width: 80,
      render: (v) => `${v || 0}%`,
    },
    {
      title: '费用', dataIndex: 'total_cost_cny', key: 'cost', width: 80,
      render: (v) => v > 0 ? `¥${v.toFixed(2)}` : '-',
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: (v) => v ? new Date(v + '+08:00').toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'actions', width: 100,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}
            onClick={() => navigate(`/create?id=${record.id}`)} />
          <Popconfirm title="确定删除?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <Card title={<><VideoCameraOutlined /> 历史项目</>}
      extra={<Button type="primary" onClick={() => navigate('/create')}>创建新视频</Button>}>
      <Table columns={columns} dataSource={projects} rowKey="id" loading={loading}
        pagination={{ pageSize: 20 }} size="small" />
    </Card>
  )
}
