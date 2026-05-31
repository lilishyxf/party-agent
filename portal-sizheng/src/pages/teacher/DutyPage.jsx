import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, message, Breadcrumb, Space, Tag } from 'antd'
import { EditOutlined } from '@ant-design/icons'
import { fetchMembers, updateMember, fetchBranches, fetchPartyGroups } from '../../services/api'

const ROLE_ORDER = { 支部书记: 0, 支委委员: 1, 干部: 2, 党员: 3 }
const ROLE_COLORS = { 支部书记: 'red', 支委委员: 'blue', 干部: 'purple', 党员: 'default' }

export default function DutyPage() {
  const [data, setData] = useState([])
  const [branches, setBranches] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const [mems, brs, grps] = await Promise.all([
        fetchMembers({}),
        fetchBranches(),
        fetchPartyGroups(),
      ])
      const sorted = [...(mems || [])].sort(
        (a, b) => (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99)
      )
      setData(sorted)
      setBranches(brs || [])
      setGroups(grps || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      role: r.role,
      duty_description: r.duty_description || '',
      party_group_id: r.party_group_id || undefined,
    })
    setModalOpen(true)
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      await updateMember(editing.id, values)
      message.success('已更新')
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '所属支部', dataIndex: 'branch_name', width: 160, ellipsis: true },
    { title: '党小组', dataIndex: 'party_group_name', width: 120, render: v => v || '-' },
    { title: '角色', dataIndex: 'role', width: 100,
      render: v => <Tag color={ROLE_COLORS[v]}>{v}</Tag> },
    { title: '职责分工', dataIndex: 'duty_description', ellipsis: true,
      render: v => v || <span style={{ color: '#ccc' }}>未设置</span> },
    { title: '操作', key: 'ops', width: 80,
      render: (_, r) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '党务中心' }, { title: '职责分工' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>
            职责分工列表
          </span>
          <span style={{ fontSize: 12, color: '#999' }}>点击"编辑"修改角色、党小组、职责描述</span>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={false} />
      </Card>

      <Modal title="编辑职责分工" open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={520} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="role" label="角色">
            <Select options={[
              { value: '支部书记', label: '支部书记' },
              { value: '支委委员', label: '支委委员' },
              { value: '干部', label: '干部' },
              { value: '党员', label: '党员' },
            ]} />
          </Form.Item>
          <Form.Item name="party_group_id" label="所属党小组">
            <Select placeholder="选择党小组" allowClear
              options={groups.map(g => ({ value: g.id, label: g.name }))} />
          </Form.Item>
          <Form.Item name="duty_description" label="职责描述">
            <Input.TextArea rows={3} placeholder="例：负责支部宣传工作、组织主题党日活动" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
