import { useState, useEffect } from 'react'
import { Card, Table, Select, Button, Popconfirm, message, Breadcrumb, Space } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import { fetchNotes, deleteNote, fetchMaterials, parseDate } from '../../services/api'
import { useNavigate } from 'react-router-dom'

export default function Notes() {
  const navigate = useNavigate()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [materials, setMaterials] = useState([])
  const [materialId, setMaterialId] = useState(null)

  useEffect(() => {
    fetchMaterials({ page_size: 200 }).then(res => setMaterials(res.items || []))
  }, [])

  const load = async (mid = null) => {
    setLoading(true)
    try {
      const res = await fetchNotes(mid)
      setData(res || [])
    } catch { message.error('加载失败') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const onFilter = (v) => {
    setMaterialId(v)
    load(v || null)
  }

  const handleDelete = async (id) => {
    try { await deleteNote(id); message.success('已删除'); load(materialId) }
    catch { message.error('删除失败') }
  }

  const columns = [
    { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
    { title: '材料 ID', dataIndex: 'material_id', key: 'material_id', width: 90, align: 'center' },
    { title: '党员 ID', dataIndex: 'member_id', key: 'member_id', width: 90, align: 'center' },
    { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 160,
      render: v => v ? parseDate(v).toLocaleString('zh-CN') : '-' },
    { title: '操作', key: 'ops', width: 80,
      render: (_, r) => (
        <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ) },
  ]

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: <a onClick={() => navigate('/learning')}>学习中心</a> }, { title: '学习笔记' }]} />

      <Card style={{ borderRadius: 10, marginBottom: 12 }} bodyStyle={{ padding: '12px 16px' }}>
        <Space>
          <Select placeholder="按材料筛选" value={materialId || undefined} onChange={onFilter}
            options={materials.map(m => ({ label: m.title, value: m.id }))}
            style={{ width: 260 }} allowClear showSearch optionFilterProp="label" />
          <Button onClick={() => { setMaterialId(null); load(null) }}>重置</Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={data} rowKey="id" loading={loading} size="middle"
          pagination={{ pageSize: 30, showTotal: t => `共 ${t} 条` }} />
      </Card>
    </div>
  )
}
