import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Breadcrumb, Space, Tag, Tree } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, TeamOutlined } from '@ant-design/icons'
import { fetchBranches, createBranch, updateBranch, deleteBranch, fetchMembers } from '../../services/api'
import { useNavigate } from 'react-router-dom'

const STATUS_COLORS = {
  申请人: 'default', 积极分子: 'orange', 发展对象: 'volcano',
  预备党员: 'blue', 正式党员: 'green',
}
const ROLE_COLORS = {
  党员: 'default', 支部书记: 'red', 支委委员: 'blue', 干部: 'purple',
}

export default function OrgStructurePage() {
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [brs, mems] = await Promise.all([
        fetchBranches(),
        fetchMembers({}),
      ])
      setBranches(brs || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = (parentId = null) => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ parent_id: parentId })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteBranch(id); message.success('已删除'); load() }
    catch (e) { message.error(e.message || '删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      if (editing) {
        await updateBranch(editing.id, values)
        message.success('已更新')
      } else {
        await createBranch(values)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  // build tree for Tree component
  const buildTree = (parentId = null) => {
    return branches
      .filter(b => b.parent_id === parentId)
      .map(b => ({
        key: b.id,
        title: (
          <span>
            {b.name}
            <Tag color="red" style={{ marginLeft: 8, fontSize: 10 }}>{b.member_count} 人</Tag>
            {b.secretary_name && (
              <span style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
                书记: {b.secretary_name}
              </span>
            )}
          </span>
        ),
        children: buildTree(b.id),
      }))
  }

  const treeData = buildTree(null)

  const columns = [
    { title: '支部名称', dataIndex: 'name', width: 200 },
    { title: '上级支部', dataIndex: 'parent_id', width: 120,
      render: v => v ? branches.find(b => b.id === v)?.name || '-' : '（无）' },
    { title: '支部书记', dataIndex: 'secretary_name', width: 120, render: v => v || '未指定' },
    { title: '党员人数', dataIndex: 'member_count', width: 80, align: 'center',
      render: v => <Tag color="blue">{v}</Tag> },
    { title: '简介', dataIndex: 'description', ellipsis: true },
    { title: '操作', key: 'ops', width: 160,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<TeamOutlined />}
            onClick={() => setSelectedBranch(r.id)}>党员</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ]

  const branchMembers = selectedBranch
    ? members.filter(m => m.branch_id === selectedBranch)
    : []

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '党务中心' }, { title: '党组织架构' }]} />

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* 左侧树 */}
        <Card title="组织树" size="small" style={{ borderRadius: 10, height: 'fit-content' }}
          extra={<Button size="small" type="link" icon={<PlusOutlined />}
            style={{ fontSize: 11, color: '#d32f2f' }}
            onClick={() => openCreate(null)}>新建</Button>}>
          {treeData.length === 0
            ? <div style={{ textAlign: 'center', color: '#ccc', padding: 20 }}>暂无支部</div>
            : <Tree treeData={treeData} defaultExpandAll blockNode
                onSelect={([key]) => typeof key === 'number' && setSelectedBranch(key)}
                selectedKeys={selectedBranch ? [selectedBranch] : []} />}
        </Card>

        {/* 右侧 */}
        <div>
          <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
                {selectedBranch
                  ? `「${branches.find(b => b.id === selectedBranch)?.name || ''}」党员列表`
                  : '支部列表'}
              </span>
              <Space>
                {selectedBranch && (
                  <Button size="small" onClick={() => setSelectedBranch(null)}>返回全部</Button>
                )}
                <Button type="primary" icon={<PlusOutlined />}
                  style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}
                  onClick={() => openCreate(null)}>新增支部</Button>
              </Space>
            </div>
          </Card>

          {selectedBranch ? (
            <Card style={{ borderRadius: 10 }}>
              <Table dataSource={branchMembers} rowKey="id" size="small"
                pagination={false}
                columns={[
                  { title: '姓名', dataIndex: 'name', width: 80 },
                  { title: '学号', dataIndex: 'student_id', width: 110 },
                  { title: '政治面貌', dataIndex: 'party_status', width: 100,
                    render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                  { title: '角色', dataIndex: 'role', width: 100,
                    render: v => <Tag color={ROLE_COLORS[v]}>{v}</Tag> },
                  { title: '手机号', dataIndex: 'phone', width: 120 },
                ]} />
            </Card>
          ) : (
            <Card style={{ borderRadius: 10 }}>
              <Table columns={columns} dataSource={branches} rowKey="id"
                loading={loading} size="middle"
                pagination={false} />
            </Card>
          )}
        </div>
      </div>

      <Modal title={editing ? '编辑支部' : '新增支部'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={520} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="支部名称" rules={[{ required: true }]}>
            <Input placeholder="例：教师第一支部" />
          </Form.Item>
          <Form.Item name="parent_id" label="上级支部">
            <Select placeholder="（无上级，作为根节点）" allowClear
              options={branches.filter(b => !editing || b.id !== editing.id).map(b => ({ value: b.id, label: b.name }))} />
          </Form.Item>
          <Form.Item name="secretary_id" label="支部书记">
            <Select placeholder="选择支部书记" allowClear showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id})` }))} />
          </Form.Item>
          <Form.Item name="description" label="简介">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
