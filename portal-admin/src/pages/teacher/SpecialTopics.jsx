import { useState, useEffect } from 'react'
import { Card, Table, Button, Modal, Form, Input, Select, Tag, Popconfirm, message, Breadcrumb, Space, Drawer } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { fetchTopics, createTopic, updateTopic, deleteTopic, fetchTopicDetail, addTopicItem, removeTopicItem, fetchMaterials, fetchQuestions, parseDate } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function SpecialTopics() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  // 管理 items 的状态
  const [itemsDrawerOpen, setItemsDrawerOpen] = useState(false)
  const [currentTopicId, setCurrentTopicId] = useState(null)
  const [topicItems, setTopicItems] = useState([])
  const [materials, setMaterials] = useState([])
  const [addType, setAddType] = useState('material')
  const [addId, setAddId] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetchTopics()
      setData(Array.isArray(res) ? res : [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleDelete = async (id) => {
    try { await deleteTopic(id); message.success('已删除'); load() }
    catch { message.error('删除失败') }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      if (editing) {
        await updateTopic(editing.id, values)
        message.success('已更新')
      } else {
        await createTopic(values)
        message.success('已创建')
      }
      setModalOpen(false)
      load()
    } catch { message.error('操作失败') }
  }

  const openItems = async (topicId) => {
    setCurrentTopicId(topicId)
    setAddType('material')
    setAddId(null)
    try {
      const [detail, mats] = await Promise.all([
        fetchTopicDetail(topicId),
        fetchMaterials({ page_size: 200 }),
      ])
      setTopicItems(detail.items || [])
      setMaterials(mats.items || [])
    } catch { message.error('加载专题详情失败') }
    setItemsDrawerOpen(true)
  }

  const handleAddItem = async () => {
    if (!addId) { message.warning('请选择要添加的内容'); return }
    try {
      await addTopicItem(currentTopicId, { item_type: addType, item_id: addId })
      message.success('已添加')
      // 重新加载 items
      const detail = await fetchTopicDetail(currentTopicId)
      setTopicItems(detail.items || [])
      setAddId(null)
    } catch { message.error('添加失败') }
  }

  const handleRemoveItem = async (itemId) => {
    try {
      await removeTopicItem(itemId)
      message.success('已移除')
      setTopicItems(prev => prev.filter(i => i.id !== itemId))
    } catch { message.error('移除失败') }
  }

  const columns = [
    { title: '标题', dataIndex: 'title', key: 'title', width: 200 },
    { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
    { title: '排序', dataIndex: 'order_num', key: 'order_num', width: 80, align: 'center' },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: v => v ? parseDate(v).toLocaleDateString('zh-CN') : '-' },
    { title: '操作', key: 'ops', width: 180,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<UnorderedListOutlined />} onClick={() => openItems(r.id)}>内容</Button>
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
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '专题学习' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 14, color: '#666' }}>共 {data.length} 个专题</span>
          <Button type="primary" icon={<PlusOutlined />}
            style={{ background: '#d32f2f', borderColor: '#d32f2f', borderRadius: 6 }}
            onClick={openCreate}>创建专题</Button>
        </div>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={false} />
      </Card>

      {/* 创建/编辑弹窗 */}
      <Modal title={editing ? '编辑专题' : '创建专题'} open={modalOpen}
        onOk={handleSubmit} onCancel={() => setModalOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}
          initialValues={{ order_num: 0 }}>
          <Form.Item name="title" label="专题名称" rules={[{ required: true }]}>
            <Input placeholder="例：二十大精神学习专题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="专题简介" />
          </Form.Item>
          <Form.Item name="cover_url" label="封面图 URL">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="order_num" label="排序号">
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 管理 items 抽屉 */}
      <Drawer title="管理专题内容" open={itemsDrawerOpen}
        onClose={() => setItemsDrawerOpen(false)} width={500}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>添加内容</div>
          <Space style={{ width: '100%' }}>
            <Select value={addType} onChange={setAddType} style={{ width: 100 }}
              options={[{ label: '学习材料', value: 'material' }, { label: '学习任务', value: 'task' }]} />
            <Select value={addId} onChange={setAddId} style={{ flex: 1 }} placeholder="选择内容"
              showSearch optionFilterProp="label"
              options={materials.map(m => ({ label: m.title, value: m.id }))} />
            <Button type="primary" onClick={handleAddItem}>添加</Button>
          </Space>
        </div>

        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
          已有内容 ({topicItems.length})
        </div>
        {topicItems.map((item, i) => (
          <Card key={item.id} size="small" style={{ marginBottom: 8, borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Tag color={item.item_type === 'material' ? 'blue' : 'orange'} style={{ marginRight: 8 }}>
                  {item.item_type === 'material' ? '材料' : '任务'}
                </Tag>
                <span style={{ fontSize: 13 }}>{item.title || `ID: ${item.item_id}`}</span>
              </div>
              <Popconfirm title="确定移除？" onConfirm={() => handleRemoveItem(item.id)}>
                <Button type="link" size="small" danger>移除</Button>
              </Popconfirm>
            </div>
          </Card>
        ))}
      </Drawer>
    </div>
  )
}
