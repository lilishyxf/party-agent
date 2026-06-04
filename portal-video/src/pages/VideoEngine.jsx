import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Steps, Button, Form, Input, Select, Progress, Tag, Space, Modal, message, Spin, Row, Col, Image, Empty, Collapse } from 'antd'
import {
  VideoCameraOutlined, CheckCircleOutlined, CloseCircleOutlined,
  PlayCircleOutlined, ReloadOutlined, DownloadOutlined, LoadingOutlined,
  BulbOutlined,
} from '@ant-design/icons'
import {
  createVideoProject, fetchVideoProject, fetchVideoProjectStatus,
  reviewScene, startImageGen, startVideoGen, getVideoDownloadUrl,
  fetchStyleTracks, suggestSizhengAngles,
} from '../services/api'

const { TextArea } = Input

const STAGE_STEPS = [
  { key: 'align', title: '对齐规划' },
  { key: 'narrate', title: '旁白生成' },
  { key: 'prompt_gen', title: '分镜提示词' },
  { key: 'prompts_review', title: '审核脚本' },
  { key: 'image_gen', title: '图像生成' },
  { key: 'images_review', title: '审核图像' },
  { key: 'video_gen', title: '视频生成' },
  { key: 'assemble', title: '后期合成' },
]

const TEACHING_FUNC_LABELS = {
  '设景设问': '🎬 设景设问', '概念引入': '💡 概念引入',
  '核心机制1': '⚙️ 核心机制1', '核心机制2': '⚙️ 核心机制2',
  '核心机制3': '⚙️ 核心机制3', '结果展示': '✅ 结果展示',
  '思政升华': '🏆 思政升华', '价值收束': '🔁 价值收束',
}

const SCENE_STATUS_MAP = {
  prompts_ready: { color: 'blue', label: '脚本就绪' },
  image_generating: { color: 'processing', label: '图像生成中' },
  images_ready: { color: 'cyan', label: '图像就绪' },
  video_generating: { color: 'processing', label: '视频生成中' },
  video_ready: { color: 'purple', label: '视频就绪' },
  failed: { color: 'error', label: '失败' },
}

export default function VideoEngine() {
  const [searchParams] = useSearchParams()
  const projectId = searchParams.get('id')

  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [tracks, setTracks] = useState([])

  const [form] = Form.useForm()
  const [creating, setCreating] = useState(false)

  // Angle suggestion state
  const [angles, setAngles] = useState([])
  const [suggesting, setSuggesting] = useState(false)
  const [selectedAngle, setSelectedAngle] = useState(null)

  useEffect(() => {
    fetchStyleTracks().then(d => setTracks(d.tracks || [])).catch(() => {})
  }, [])

  const loadProject = useCallback(async (id) => {
    setLoading(true)
    try {
      const data = await fetchVideoProject(id)
      setProject(data.project)
    } catch (e) {
      message.error('加载项目失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) loadProject(projectId)
  }, [projectId, loadProject])

  // Poll for status updates and reload content at key stage transitions
  useEffect(() => {
    if (!project || ['done', 'failed', 'cancelled'].includes(project.status)) return

    const contentStages = ['narrating', 'prompt_generating', 'image_generating', 'video_generating', 'prompts_review', 'images_review']

    const interval = setInterval(async () => {
      try {
        const status = await fetchVideoProjectStatus(project.id)
        setProject(prev => prev ? { ...prev, ...status } : prev)
        // Reload full project when stage changes or at review gates — ensures
        // alignment, narration, prompts, images, and video status are always fresh
        if (status.status !== project.status || contentStages.includes(status.status)) {
          loadProject(project.id)
        }
      } catch (e) { /* ignore */ }
    }, 3000)

    return () => clearInterval(interval)
  }, [project?.id, project?.status])

  const handleSuggest = async () => {
    const values = await form.validateFields(['knowledge_point']).catch(() => null)
    if (!values) return

    setSuggesting(true)
    setAngles([])
    setSelectedAngle(null)
    try {
      const data = await suggestSizhengAngles(values.knowledge_point)
      setAngles(data.angles || [])
      if (data.angles?.length > 0) {
        message.success(`已生成 ${data.angles.length} 个思政角度建议`)
      } else {
        message.warning('未生成建议,请尝试修改知识点描述')
      }
    } catch (e) {
      message.error('生成建议失败: ' + (e.message || ''))
    } finally {
      setSuggesting(false)
    }
  }

  const handleSelectAngle = (angle) => {
    setSelectedAngle(angle)
    form.setFieldsValue({ sizheng_angle: angle.label })
  }

  const handleCreate = async (values) => {
    setCreating(true)
    try {
      const result = await createVideoProject(values)
      message.success('项目已创建,流水线启动中')
      const url = new URL(window.location)
      url.searchParams.set('id', result.project_id)
      window.history.pushState({}, '', url)
      loadProject(result.project_id)
    } catch (e) {
      message.error('创建失败: ' + (e.message || '未知错误'))
    } finally {
      setCreating(false)
    }
  }

  const handleStartImageGen = async () => {
    try {
      await startImageGen(project.id)
      message.success('图像生成已启动')
      loadProject(project.id)
    } catch (e) {
      message.error('启动失败')
    }
  }

  const handleStartVideoGen = async () => {
    try {
      await startVideoGen(project.id)
      message.success('视频生成已启动')
      loadProject(project.id)
    } catch (e) {
      message.error('启动失败')
    }
  }

  const handleReview = async (sceneId, action) => {
    try {
      await reviewScene(project.id, sceneId, { action, comment: '' })
      message.success(action === 'approve' ? '已通过' : '已驳回')
      loadProject(project.id)
    } catch (e) {
      message.error('操作失败')
    }
  }

  const getCurrentStep = () => {
    if (!project) return 0
    const idx = STAGE_STEPS.findIndex(s => s.key === project.current_stage)
    return idx >= 0 ? idx : 0
  }

  const allScenesApproved = project?.scenes?.every(s => s.review_status === 'approved')

  // ── Create Form View (2-step wizard) ──
  if (!projectId) {
    const angleSuggestions = (
      <div style={{ marginBottom: 24 }}>
        {suggesting && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <p style={{ marginTop: 16, color: '#999' }}>AI正在分析知识点,生成思政结合角度...</p>
          </div>
        )}
        {!suggesting && angles.length > 0 && (
          <>
            <div style={{ marginBottom: 12, color: '#666', fontSize: 13 }}>
              <BulbOutlined /> AI 为你生成了以下思政角度建议,点击选择一个:
            </div>
            <Row gutter={[12, 12]}>
              {angles.map((angle, i) => (
                <Col span={12} key={i}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      cursor: 'pointer',
                      border: selectedAngle === angle ? '2px solid #1677ff' : '1px solid #d9d9d9',
                      background: selectedAngle === angle ? '#f0f5ff' : '#fff',
                    }}
                    onClick={() => handleSelectAngle(angle)}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{angle.label}</div>
                    <div style={{ fontSize: 12, color: '#666', lineHeight: 1.6 }}>{angle.description}</div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                      {angle.story_hint}
                    </div>
                    {angle.keywords && (
                      <Space size={4} style={{ marginTop: 6 }}>
                        {angle.keywords.map((kw, j) => <Tag key={j} color="blue">{kw}</Tag>)}
                      </Space>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </>
        )}
      </div>
    )

    return (
      <Card title={<><VideoCameraOutlined /> 创建AI教学思政视频</>}
        style={{ maxWidth: 800, margin: '0 auto' }}>
        <Form form={form} layout="vertical" onFinish={handleCreate}
          initialValues={{ style_track: 'industrial_documentary' }}>
          <Form.Item name="knowledge_point" label="第一步: 输入专业知识点"
            rules={[{ required: true, message: '请输入知识点' }]}>
            <TextArea rows={3} placeholder="例如: 产生式表示法 / 决策树(归纳学习) / 状态空间搜索..."
              disabled={suggesting} />
          </Form.Item>

          <Form.Item>
            <Button type="default" onClick={handleSuggest} loading={suggesting}
              icon={<BulbOutlined />} block size="large"
              disabled={suggesting}>
              {suggesting ? 'AI分析中...' : 'AI智能分析——生成思政结合角度建议'}
            </Button>
          </Form.Item>

          {angleSuggestions}

          <Form.Item name="sizheng_angle" label="第二步: 确认思政角度 (可直接修改)"
            rules={[{ required: true, message: '请选择或输入思政角度' }]}>
            <TextArea rows={2} placeholder="选择一个AI建议的角度,或自己输入思政角度..." />
          </Form.Item>

          <Form.Item name="style_track" label="视频风格">
            <Select options={tracks.map(t => ({ value: t.key, label: t.label }))} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={creating} block size="large" icon={<VideoCameraOutlined />}>
              开始生成视频
            </Button>
          </Form.Item>
        </Form>
      </Card>
    )
  }

  // ── Project View ──
  if (loading && !project) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />
  if (!project) return <Empty description="项目不存在" />

  const { scenes = [] } = project

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <Card size="small">
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <VideoCameraOutlined />
            <strong>{project.title || '未命名'}</strong>
            <Tag>{project.status}</Tag>
          </Space>
          <Space>
            <Progress percent={project.progress_pct} size="small" style={{ width: 120 }} />
            {project.status === 'done' && (
              <Button type="primary" icon={<DownloadOutlined />}
                onClick={() => window.open(getVideoDownloadUrl(project.id))}>
                下载视频
              </Button>
            )}
            <Button icon={<ReloadOutlined />} onClick={() => loadProject(project.id)}>刷新</Button>
          </Space>
        </Space>
      </Card>

      {/* Pipeline Steps */}
      <Card size="small" title="流水线进度">
        <Steps current={getCurrentStep()} size="small" status={project.status === 'failed' ? 'error' : 'process'}
          items={STAGE_STEPS.map(s => ({ title: s.title }))} />
      </Card>

      {/* Alignment */}
      {project.alignment_statement && (
        <Card size="small" title="对齐声明">
          <p style={{ color: '#555', fontStyle: 'italic' }}>{project.alignment_statement}</p>
        </Card>
      )}

      {/* Narration */}
      {project.full_narration && (
        <Card size="small" title="完整旁白稿">
          <p style={{ lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{project.full_narration}</p>
        </Card>
      )}

      {/* Scene Cards */}
      {scenes.length > 0 && (
        <Card size="small" title={`分镜脚本 (${scenes.length}个Scene)`}>
          <Row gutter={[12, 12]}>
            {scenes.map(scene => {
              const statusInfo = SCENE_STATUS_MAP[scene.status] || { color: 'default', label: scene.status }
              return (
              <Col span={12} key={scene.id}>
                <Card size="small" title={
                  <Space>
                    <span>Scene {scene.scene_number}</span>
                    {scene.teaching_function && (
                      <Tag>{TEACHING_FUNC_LABELS[scene.teaching_function] || scene.teaching_function}</Tag>
                    )}
                    <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                  </Space>
                }>
                  {/* Narration snippet */}
                  <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
                    旁白: {scene.narration_text?.substring(0, 100)}{(scene.narration_text?.length || 0) > 100 ? '...' : ''}
                  </p>

                  {/* Show prompts during prompts_review */}
                  {project.status === 'prompts_review' && (
                    <Collapse size="small" ghost items={[{
                      key: 'prompts', label: '查看分镜提示词',
                      children: (
                        <div style={{ fontSize: 12, color: '#555' }}>
                          {scene.start_frame_prompt && (
                            <p><strong>首帧Prompt:</strong> {scene.start_frame_prompt}</p>
                          )}
                          {scene.end_frame_prompt && (
                            <p><strong>尾帧Prompt:</strong> {scene.end_frame_prompt}</p>
                          )}
                          {scene.motion_prompt && (
                            <p><strong>动效Prompt:</strong> {scene.motion_prompt}</p>
                          )}
                        </div>
                      )
                    }]} />
                  )}

                  {/* Generated images */}
                  {['images_ready', 'video_ready'].includes(scene.status) && (
                    <Row gutter={8} style={{ marginBottom: 8 }}>
                      {scene.start_frame_url && (
                        <Col span={12}>
                          <Image src={scene.start_frame_url} alt="首帧" style={{ maxHeight: 120 }} />
                          <div style={{ fontSize: 11, textAlign: 'center', color: '#999' }}>首帧</div>
                        </Col>
                      )}
                      {scene.end_frame_url && (
                        <Col span={12}>
                          <Image src={scene.end_frame_url} alt="尾帧" style={{ maxHeight: 120 }} />
                          <div style={{ fontSize: 11, textAlign: 'center', color: '#999' }}>尾帧</div>
                        </Col>
                      )}
                    </Row>
                  )}

                  {/* Image review buttons */}
                  {project.status === 'images_review' && scene.status === 'images_ready' && !scene.review_status && (
                    <Space>
                      <Button type="primary" size="small" icon={<CheckCircleOutlined />}
                        onClick={() => handleReview(scene.id, 'approve')}>通过</Button>
                      <Button danger size="small" icon={<CloseCircleOutlined />}
                        onClick={() => handleReview(scene.id, 'reject')}>驳回</Button>
                    </Space>
                  )}
                  {scene.review_status && (
                    <Tag color={scene.review_status === 'approved' ? 'success' : 'error'}>
                      {scene.review_status === 'approved' ? '已通过' : '已驳回'}
                    </Tag>
                  )}
                  {scene.status === 'video_ready' && (
                    <div>
                      <Tag color="purple" icon={<PlayCircleOutlined />}>视频已生成</Tag>
                      {scene.video_segment_url && (
                        <video controls style={{ width: '100%', maxHeight: 160, marginTop: 8 }}
                          src={scene.video_segment_url} />
                      )}
                    </div>
                  )}
                </Card>
              </Col>
            )})}
          </Row>
        </Card>
      )}

      {/* Gate actions */}
      <Card size="small">
        <Space>
          {project.status === 'prompts_review' && (
            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handleStartImageGen}>
              确认脚本,开始生成图像
            </Button>
          )}
          {project.status === 'images_review' && allScenesApproved && (
            <Button type="primary" size="large" icon={<PlayCircleOutlined />} onClick={handleStartVideoGen}>
              全部通过,开始生成视频
            </Button>
          )}
          {project.status === 'failed' && (
            <div>
              <Tag color="error">流水线失败</Tag>
              {project.error_message && <p style={{ color: 'red' }}>{project.error_message}</p>}
            </div>
          )}
        </Space>
      </Card>

      {/* Final video */}
      {project.status === 'done' && project.final_video_url && (
        <Card size="small" title="成品视频">
          <video controls style={{ width: '100%', maxHeight: 500 }}
            src={project.final_video_url} />
        </Card>
      )}
    </div>
  )
}
