import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, InputNumber, DatePicker, Tag, Popconfirm, message, Breadcrumb, Space, Upload, Alert, Tooltip } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined, InboxOutlined, RobotOutlined } from '@ant-design/icons'
import { fetchDues, createDues, updateDues, deleteDues, fetchMembers, importDuesPreview, confirmDuesImport } from '../../services/api'
import dayjs from 'dayjs'

const STATUS_MAP = { 已缴: 'green', 未缴: 'red', 减免: 'orange' }

export default function DuesPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importing, setImporting] = useState(false)
  const [importPreview, setImportPreview] = useState(null)
  const [importConfirming, setImportConfirming] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [dues, mems] = await Promise.all([fetchDues({ search }), fetchMembers({})])
      setData(dues || [])
      setMembers(mems || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [search])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ year: dayjs().year(), month: Math.ceil((dayjs().month() + 1) / 3), status: '未缴', amount: 0 })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, paid_date: r.paid_date ? dayjs(r.paid_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteDues(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields()
      setSaving(true)
      const payload = { ...values, paid_date: values.paid_date ? values.paid_date.format('YYYY-MM-DD') : '' }
      if (editing) { await updateDues(editing.id, payload); message.success('已更新') }
      else { await createDues(payload); message.success('已创建') }
      setModalOpen(false); load()
    } catch (e) { if (e.errorFields) return; message.error('保存失败') }
    setSaving(false)
  }

  const handleImport = async () => {
    if (!importFile) { message.warning('请选择 Excel 文件'); return }
    setImporting(true)
    setImportPreview(null)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const res = await importDuesPreview(fd)
      if (res.status === 'ok') {
        setImportPreview(res)
      } else {
        message.error(res.message || 'AI 解析失败')
      }
    } catch { message.error('AI 解析请求失败，请检查网络') }
    setImporting(false)
  }

  const handleImportConfirm = async () => {
    if (!importPreview?.preview?.length) return
    setImportConfirming(true)
    try {
      const res = await confirmDuesImport(importPreview.preview)
      if (res.status === 'ok') {
        message.success(`导入成功：新增 ${res.created} 条，跳过 ${res.skipped} 条重复`)
        setImportModalOpen(false)
        setImportPreview(null)
        setImportFile(null)
        load()
      } else {
        message.error('导入失败')
      }
    } catch { message.error('导入失败') }
    setImportConfirming(false)
  }

  const matchColor = (score) => {
    if (score >= 90) return 'green'
    if (score >= 70) return 'orange'
    return 'red'
  }

  const columns = [
    { title: '党员', dataIndex: 'member_name', width: 100 },
    { title: '年份', dataIndex: 'year', width: 70 },
    { title: '季度', dataIndex: 'month', width: 60, render: v => `Q${v}` },
    { title: '金额', dataIndex: 'amount', width: 80, render: v => `¥${v}` },
    { title: '状态', dataIndex: 'status', width: 80, render: v => <Tag color={STATUS_MAP[v]}>{v}</Tag> },
    { title: '缴费日期', dataIndex: 'paid_date', width: 110, render: v => v || '-' },
    { title: '备注', dataIndex: 'notes', ellipsis: true },
    { title: '操作', key: 'ops', width: 120,
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
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '服务中心' }, { title: '党费收缴' }]} />
      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <Input.Search placeholder="搜索党员姓名" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)}
            onSearch={v => setSearch(v)} style={{ width: 220, borderRadius: 6 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>新增记录</Button>
          <Button icon={<RobotOutlined />} onClick={() => { setImportModalOpen(true); setImportFile(null); setImportPreview(null) }}
            style={{ borderRadius: 6, background: '#fff', borderColor: '#d32f2f', color: '#d32f2f' }}>
            AI 智能导入
          </Button>
        </div>
      </Card>
      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }} />
      </Card>

      <Modal title={editing ? '编辑党费记录' : '新增党费记录'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消" destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="member_id" label="党员" rules={[{ required: true }]}>
            <Select placeholder="选择党员" showSearch optionFilterProp="label"
              options={members.map(m => ({ value: m.id, label: `${m.name} (${m.student_id || m.phone || ''})` }))} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Form.Item name="year" label="年份" rules={[{ required: true }]}>
              <InputNumber min={2020} max={2030} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="month" label="季度" rules={[{ required: true }]}>
              <Select options={[{ value: 1, label: 'Q1 (1-3月)' }, { value: 2, label: 'Q2 (4-6月)' }, { value: 3, label: 'Q3 (7-9月)' }, { value: 4, label: 'Q4 (10-12月)' }]} />
            </Form.Item>
            <Form.Item name="amount" label="金额" rules={[{ required: true }]}>
              <InputNumber min={0} step={0.01} style={{ width: '100%' }} prefix="¥" />
            </Form.Item>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="status" label="状态">
              <Select options={[{ value: '未缴', label: '未缴' }, { value: '已缴', label: '已缴' }, { value: '减免', label: '减免' }]} />
            </Form.Item>
            <Form.Item name="paid_date" label="缴费日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="notes" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>

      {/* AI 智能导入 */}
      <Modal title={<Space><RobotOutlined /> AI 智能导入党费</Space>} open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        onOk={importPreview ? handleImportConfirm : undefined}
        confirmLoading={importConfirming}
        okText={importPreview ? `确认导入 (${importPreview.total} 条)` : undefined}
        okButtonProps={{ disabled: !importPreview?.preview?.length }}
        cancelText="取消" width={720} destroyOnClose>
        {!importPreview ? (
          <>
            <Upload.Dragger
              accept=".xlsx"
              maxCount={1}
              fileList={importFile ? [{ uid: '-1', name: importFile.name, status: 'done' }] : []}
              beforeUpload={f => { setImportFile(f); return false }}
              onRemove={() => setImportFile(null)}
              style={{ borderRadius: 8, marginBottom: 16 }}>
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">点击或拖拽党费 Excel 文件</p>
              <p className="ant-upload-hint" style={{ color: '#999' }}>仅支持 .xlsx 格式，AI 将自动识别表结构，无需固定模板</p>
            </Upload.Dragger>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message={<><strong>AI 智能解析</strong> — 无需固定模板，AI 会自动识别：姓名列、年份列、季度列、金额列、状态列、日期列</>} />
            <Button block icon={<RobotOutlined />} onClick={handleImport} loading={importing}
              style={{ borderRadius: 8, height: 40, background: '#d32f2f', borderColor: '#d32f2f', color: '#fff' }}>
              {importing ? 'AI 解析中...' : '开始 AI 解析'}
            </Button>
          </>
        ) : (
          <>
            <Alert type={importPreview.confidence === 'high' ? 'success' : 'warning'} showIcon
              style={{ marginBottom: 12 }}
              message={<>
                AI 解析完成，置信度：<Tag color={importPreview.confidence === 'high' ? 'green' : 'orange'}>{importPreview.confidence === 'high' ? '高' : importPreview.confidence === 'medium' ? '中' : '低（使用内置规则）'}</Tag>
                共识别 {importPreview.total} 条记录
              </>} />
            <div style={{ maxHeight: 360, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#fafafa', position: 'sticky', top: 0 }}>
                    <th style={thStyle}>姓名</th>
                    <th style={thStyle}>AI 匹配</th>
                    <th style={thStyle}>匹配度</th>
                    <th style={thStyle}>年份</th>
                    <th style={thStyle}>季度</th>
                    <th style={thStyle}>金额</th>
                    <th style={thStyle}>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.preview.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f0f0f0' }}>
                      <td style={tdStyle}>{r.member_name}</td>
                      <td style={tdStyle}>
                        {r.matched_name ? (
                          <Tooltip title={`学号: ${r.student_id}`}>
                            <Tag color={matchColor(r.match_score)}>{r.matched_name}</Tag>
                          </Tooltip>
                        ) : <Tag color="red">未匹配</Tag>}
                      </td>
                      <td style={tdStyle}>
                        <span style={{ color: matchColor(r.match_score), fontWeight: 600 }}>
                          {r.match_score}%
                        </span>
                      </td>
                      <td style={tdStyle}>{r.year}</td>
                      <td style={tdStyle}>Q{r.month}</td>
                      <td style={tdStyle}>¥{r.amount}</td>
                      <td style={tdStyle}><Tag color={r.status === '已缴' ? 'green' : r.status === '减免' ? 'orange' : 'red'}>{r.status}</Tag></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}

const thStyle = { padding: '8px 10px', textAlign: 'left', borderBottom: '2px solid #e8e8e8', fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 10px', whiteSpace: 'nowrap' }
