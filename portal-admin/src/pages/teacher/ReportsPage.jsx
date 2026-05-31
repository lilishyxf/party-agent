import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, DatePicker, Popconfirm, message, Breadcrumb, Space, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'

const STATUS_COLORS = { pending: 'orange', investigating: 'blue', resolved: 'green', dismissed: 'default' }
const STATUS_OPTIONS = ['待处理', '调查中', '已办结', '已排除']

export default function ReportsPage() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    // TODO: connect to backend API when ready
    setData([])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: '待处理', report_date: dayjs() })
    setModalOpen(true)
  }

  const openEdit = (r) => {
    setEditing(r)
    form.setFieldsValue({ ...r, report_date: r.report_date ? dayjs(r.report_date) : null })
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    message.info('功能开发中')
  }

  const handleSubmit = async () => {
    message.info('功能开发中')
  }

  const columns = [
    { title: '线索编号', dataIndex: 'id', width: 80 },
    { title: '线索来源', dataIndex: 'source', width: 100 },
    { title: '反映内容', dataIndex: 'content', width: 300, ellipsis: true },
    { title: '被反映人', dataIndex: 'target_name', width: 100 },
    { title: '状态', dataIndex: 'status', width: 90,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag> },
    { title: '登记日期', dataIndex: 'report_date', width: 110,
      render: v => v ? dayjs(v).format('YYYY-MM-DD') : '-' },
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
        items={[{ title: '监督中心' }, { title: '问题线索' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}>登记线索</Button>
          <Tag color="blue" style={{ marginLeft: 8 }}>后端 API 开发中，当前为页面占位</Tag>
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
          scroll={{ x: 900 }} />
      </Card>

      <Modal title={editing ? '编辑线索' : '登记线索'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSubmit}
        confirmLoading={saving} okText="保存" cancelText="取消"
        width={560} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="source" label="线索来源" rules={[{ required: true }]}>
            <Select options={['群众举报', '上级交办', '巡查发现', '其他'].map(v => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="content" label="反映内容">
            <Input.TextArea rows={4} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Form.Item name="target_name" label="被反映人">
              <Input />
            </Form.Item>
            <Form.Item name="status" label="状态">
              <Select options={STATUS_OPTIONS.map(v => ({ value: v, label: v }))} />
            </Form.Item>
          </div>
          <Form.Item name="report_date" label="登记日期">
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
