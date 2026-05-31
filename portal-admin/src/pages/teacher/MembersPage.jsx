import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Tag, Popconfirm, message, Breadcrumb, Space, Upload, Alert } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined, DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import { fetchMembers, createMember, updateMember, deleteMember, fetchBranches, fetchPartyGroups, importMembers, exportMembers } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'

const STATUS_COLORS = {
  申请人: 'default',
  积极分子: 'orange',
  发展对象: 'volcano',
  预备党员: 'blue',
  正式党员: 'green',
}

const STATUS_OPTIONS = ['申请人', '积极分子', '发展对象', '预备党员', '正式党员']

const ROLE_COLORS = {
  党员: 'default',
  支部书记: 'red',
  支委委员: 'blue',
  干部: 'purple',
}

const ROLE_OPTIONS = ['党员', '支部书记', '支委委员', '干部']

export default function MembersPage() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [branches, setBranches] = useState([])
  const [groups, setGroups] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [members, brs, grps] = await Promise.all([
        fetchMembers({ search, party_status: filterStatus }),
        fetchBranches(),
        fetchPartyGroups(),
      ])
      setData(members)
      setBranches(brs || [])
      setGroups(grps || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search, filterStatus])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ party_status: '正式党员', role: '党员' })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({
      ...r,
      birth_date: r.birth_date ? dayjs(r.birth_date) : null,
      join_party_date: r.join_party_date ? dayjs(r.join_party_date) : null,
    })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteMember(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = {
        ...values,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : '',
        join_party_date: values.join_party_date ? values.join_party_date.format('YYYY-MM-DD') : '',
      }
      if (editing) {
        await updateMember(editing.id, payload)
        message.success('已更新')
      } else {
        await createMember(payload)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const handleImport = async () => {
    if (!importFile) { message.warning('请选择 CSV 文件'); return }
    setImporting(true)
    setImportResult(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await importMembers(fd)
      if (res.status === 'ok') {
        setImportResult(res)
        if (res.created > 0) load()
      } else {
        message.error(res.message || '导入失败')
      }
    } catch { message.error('导入失败') }
    setImporting(false)
  }

  const columns = [
    { title: '姓名', dataIndex: 'name', width: 80 },
    { title: '学号', dataIndex: 'student_id', width: 110 },
    { title: '性别', dataIndex: 'gender', width: 60 },
    { title: '支部', dataIndex: 'branch_name', width: 160, ellipsis: true },
    { title: '党小组', dataIndex: 'party_group_name', width: 100, render: v => v || '-' },
    { title: '政治面貌', dataIndex: 'party_status', width: 100,
      render: v => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
    { title: '入党日期', dataIndex: 'join_party_date', width: 110, render: v => v || '-' },
    { title: '角色', dataIndex: 'role', width: 100,
      render: v => <Tag color={ROLE_COLORS[v]}>{v}</Tag> },
    { title: '学历', dataIndex: 'education', width: 70, render: v => v || '-' },
    { title: '民族', dataIndex: 'ethnicity', width: 70, render: v => v || '-' },
    { title: '职称', dataIndex: 'title', width: 90, render: v => v || '-' },
    { title: '学生面貌', dataIndex: 'student_status', width: 90, render: v => v || '-' },
    { title: '手机号', dataIndex: 'phone', width: 120, ellipsis: true },
    { title: '操作', key: 'ops', width: 120, fixed: 'right',
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '党务中心' }, { title: '党员信息' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input.Search placeholder="搜索姓名或学号" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)}
              onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
            <Select placeholder="政治面貌" value={filterStatus || undefined}
              onChange={v => setFilterStatus(v || '')} style={{ width: 130 }} allowClear
              options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} />
          </Space>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
              style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>
              新增党员
            </Button>
            <Button icon={<UploadOutlined />} onClick={() => { setImportModalOpen(true); setImportFile(null); setImportResult(null) }}
              style={{ borderRadius: 6 }}>
              批量导入
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => exportMembers().catch(() => message.error('导出失败'))}
              style={{ borderRadius: 6 }}>
              导出 Excel
            </Button>
          </Space>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30, showTotal: t => `共 ${t} 人` }}
          scroll={{ x: 1400 }} />
      </Card>

      <Modal title={editing ? '编辑党员' : '新增党员'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={640} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="student_id" label="学号">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="gender" label="性别">
              <Select options={[{ value: '男', label: '男' }, { value: '女', label: '女' }]} />
            </Form.Item>
            <Form.Item name="birth_date" label="出生日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="phone" label="手机号">
              <Input />
            </Form.Item>
            <Form.Item name="id_card" label="身份证号">
              <Input />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="branch_id" label="所属支部">
              <Select placeholder="选择支部" allowClear
                options={branches.map(b => ({ value: b.id, label: b.name }))} />
            </Form.Item>
            <Form.Item name="party_status" label="政治面貌">
              <Select options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="role" label="角色">
              <Select options={ROLE_OPTIONS.map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="join_party_date" label="入党日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="education" label="学历">
              <Select options={['本科', '硕士', '博士', '大专', '其他'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="ethnicity" label="民族">
              <Input placeholder="如：汉族" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="title" label="职称">
              <Select allowClear options={['教授', '副教授', '讲师', '助教', '其他'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
            <Form.Item name="student_status" label="学生面貌">
              <Select allowClear options={['本科生', '硕士生', '博士生'].map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="party_group_id" label="所属党小组">
              <Select placeholder="选择党小组" allowClear
                options={groups.map(g => ({ value: g.id, label: g.name }))} />
            </Form.Item>
            <Form.Item name="duty_description" label="职责描述">
              <Input placeholder="例：宣传委员" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal title="批量导入党员" open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={handleImport} confirmLoading={importing}
        okText="开始导入" cancelText="取消" width={560} destroyOnClose>
        <div style={{ marginBottom: 16 }}>
          <Upload.Dragger
            accept=".csv"
            maxCount={1}
            fileList={importFile ? [{ uid: '-1', name: importFile.name, status: 'done' }] : []}
            beforeUpload={f => { setImportFile(f); setImportResult(null); return false }}
            onRemove={() => setImportFile(null)}
            style={{ borderRadius: 8 }}>
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">点击或拖拽 CSV 文件到此区域</p>
          </Upload.Dragger>
          <div style={{ marginTop: 12, fontSize: 12, color: '#999' }}>
            <Space split={<span>|</span>}>
              <a onClick={() => {
                const headers = '姓名,学号,性别,出生日期,手机号,身份证号,所属支部,政治面貌,角色,入党日期,学历,民族,职称,学生面貌'
                const blob = new Blob(['﻿' + headers + '\n张三,2024001,男,2000-01-01,13800001111,,计算机学院教师第一支部,正式党员,党员,2023-06-01,本科,汉族,,本科生'], { type: 'text/csv;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = '党员导入模板.csv'; a.click()
                URL.revokeObjectURL(url)
              }}>
                <DownloadOutlined /> 下载 CSV 模板
              </a>
            </Space>
          </div>
        </div>
        {importResult && (
          <Alert type={importResult.errors?.length > 0 ? 'warning' : 'success'}
            showIcon
            message={`共 ${importResult.total} 条：成功导入 ${importResult.created} 条，跳过 ${importResult.skipped} 条`}
            description={importResult.errors?.length > 0 ? (
              <ul style={{ margin: 0, paddingLeft: 16 }}>{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            ) : null}
          />
        )}
      </Modal>
    </div>
  )
}
