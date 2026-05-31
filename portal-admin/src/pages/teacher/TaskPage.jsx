import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag, Transfer } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { fetchAdminTasks, fetchAdminTask, createTask, updateTask, deleteTask, assignTask, fetchMembers, fetchBranches } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const STATUS_COLORS = { pending: 'orange', completed: 'green' }

export default function TaskPage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [branches, setBranches] = useState([])
  const [allMembers, setAllMembers] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  const [assignTargetKeys, setAssignTargetKeys] = useState([])
  const [assigning, setAssigning] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [tasks, brs] = await Promise.all([
        fetchAdminTasks(),
        fetchBranches(),
      ])
      setData(tasks)
      setBranches(brs || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setSelectedMembers([])
    setModalOpen(true)
  }

  const openEdit = async (r) => {
    setEditing(r)
    form.setFieldsValue({
      title: r.title,
      description: r.description || '',
      branch_id: r.branch_id || undefined,
      deadline: r.deadline ? dayjs(r.deadline) : null,
    })
    setModalOpen(true)
  }

  const openAssign = async (r) => {
    setEditing(r)
    setAssignTargetKeys([])
    try {
      const [detail, members] = await Promise.all([
        fetchAdminTask(r.id),
        fetchMembers({ page_size: 9999 }),
      ])
      setAllMembers(members.list || members || [])
      setAssignTargetKeys((detail.assignments || []).map(a => String(a.member_id)))
    } catch { message.error('加载分配详情失败') }
    setAssignModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteTask(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        title: values.title,
        description: values.description || '',
        branch_id: values.branch_id || null,
        deadline: values.deadline ? values.deadline.format('YYYY-MM-DD') : null,
      }
      if (editing) {
        await updateTask(editing.id, payload)
        message.success('已更新')
      } else {
        payload.member_ids = selectedMembers
        payload.assign_all_branch = false
        await createTask(payload)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const handleAssign = async () => {
    setAssigning(true)
    try {
      await assignTask(editing.id, assignTargetKeys.map(Number))
      message.success('分配已更新')
      setAssignModalOpen(false)
      load()
    } catch { message.error('分配失败') }
    setAssigning(false)
  }

  const columns = [
    { title: '任务名称', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '所属支部', dataIndex: 'branch_name', width: 150 },
    {
      title: '完成进度', key: 'progress', width: 180,
      render: (_, r) => {
        const total = r.total_assigned || 0
        if (total === 0) return <span style={{ color: '#999' }}>未分配</span>
        const pct = total > 0 ? Math.round((r.completed_count / total) * 100) : 0
        return (
          <Space>
            <div style={{ width: 80, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#52c41a', borderRadius: 3 }} />
            </div>
            <span style={{ fontSize: 12, color: '#666' }}>{r.completed_count}/{total} ({pct}%)</span>
          </Space>
        )
      },
    },
    {
      title: '状态', key: 'status', width: 100,
      render: (_, r) => {
        if (!r.total_assigned) return <Tag color="default">未分配</Tag>
        return r.pending_count === 0
          ? <Tag color="green">全部完成</Tag>
          : <Tag color="blue">进行中</Tag>
      },
    },
    {
      title: '截止日期', dataIndex: 'deadline', width: 110,
      render: v => v ? dayjs(v).format('YYYY-MM-DD') : '-',
    },
    {
      title: '操作', key: 'ops', width: 200, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => openAssign(r)}>分配</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const memberOptions = allMembers.map(m => ({
    key: String(m.id),
    title: `${m.name} (${m.student_id || '-'})`,
    description: m.branch_name || '',
  }))

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '学习中心' }, { title: '任务管理' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
          style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
          创建任务
        </Button>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 个任务` }}
          scroll={{ x: 900 }} />
      </Card>

      {/* 创建/编辑任务 */}
      <Modal title={editing ? '编辑任务' : '创建任务'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="title" label="任务名称" rules={[{ required: true }]}>
            <Input placeholder="如：学习二十大报告" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <Input.TextArea rows={3} placeholder="任务要求、学习内容等" />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="branch_id" label="关联支部">
              <Select placeholder="选择支部" allowClear
                options={branches.map(b => ({ value: b.id, label: b.name }))} />
            </Form.Item>
            <Form.Item name="deadline" label="截止日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 分配党员 */}
      <Modal title={`分配党员 — ${editing?.title || ''}`} open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)} onOk={handleAssign}
        confirmLoading={assigning} okText="保存分配" cancelText="取消"
        width={560} destroyOnClose>
        <Transfer
          dataSource={memberOptions}
          targetKeys={assignTargetKeys}
          onChange={setAssignTargetKeys}
          render={item => item.title}
          listStyle={{ width: 240, height: 360 }}
          showSearch
          filterOption={(inputValue, item) =>
            item.title.toLowerCase().includes(inputValue.toLowerCase()) ||
            (item.description || '').toLowerCase().includes(inputValue.toLowerCase())
          }
          locale={{ itemUnit: '人', itemsUnit: '人', searchPlaceholder: '搜索党员' }}
          style={{ marginTop: 12 }}
        />
      </Modal>
    </div>
  )
}
