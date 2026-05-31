import { Card, Table, Tag, Breadcrumb } from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons'

const ROLES = [
  {
    key: 'super',
    name: '超级管理员',
    desc: '系统最高权限，可管理用户、系统配置、数据字典',
    permissions: {
      'AI 助手': true,
      '数据仪表盘': true,
      '党务中心（党员/组织/发展/干部/联系）': true,
      '学习中心（材料/题库/考试/专题等）': true,
      '宣传中心（文章/图片/视频）': true,
      '活动中心（会议/三会一课/组织生活会等）': true,
      '服务中心（党费/帮扶/志愿）': true,
      '监督中心（党纪学习/警示教育/检查）': true,
      '办公中心（通知/待办/公文/日程）': true,
      '用户管理（增删改管理员）': true,
      '系统配置': true,
      '数据字典': true,
    },
  },
  {
    key: 'normal',
    name: '普通管理员',
    desc: '日常党务操作权限，不可管理用户和系统设置',
    permissions: {
      'AI 助手': true,
      '数据仪表盘': true,
      '党务中心（党员/组织/发展/干部/联系）': true,
      '学习中心（材料/题库/考试/专题等）': true,
      '宣传中心（文章/图片/视频）': true,
      '活动中心（会议/三会一课/组织生活会等）': true,
      '服务中心（党费/帮扶/志愿）': true,
      '监督中心（党纪学习/警示教育/检查）': true,
      '办公中心（通知/待办/公文/日程）': true,
      '用户管理（增删改管理员）': false,
      '系统配置': false,
      '数据字典': false,
    },
  },
]

const permKeys = Object.keys(ROLES[0].permissions)

const columns = [
  {
    title: '权限项',
    dataIndex: 'perm',
    key: 'perm',
    width: 280,
    fixed: 'left',
  },
  ...ROLES.map(r => ({
    title: r.name,
    dataIndex: r.key,
    key: r.key,
    width: 100,
    align: 'center',
    render: v => v
      ? <Tag icon={<CheckCircleOutlined />} color="success">允许</Tag>
      : <Tag icon={<CloseCircleOutlined />} color="error">禁止</Tag>,
  })),
]

const dataSource = permKeys.map((perm, i) => {
  const row = { key: i, perm }
  ROLES.forEach(r => { row[r.key] = r.permissions[perm] })
  return row
})

export default function RolesPage() {
  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }} items={[{ title: '系统' }, { title: '角色权限' }]} />

      <Card title="角色列表" style={{ borderRadius: 10, marginBottom: 16 }}>
        {ROLES.map(r => (
          <Card key={r.key} type="inner" title={<span>{r.name} <Tag>{r.key === 'super' ? '系统内置' : '系统内置'}</Tag></span>}
            style={{ marginBottom: 12, borderRadius: 8 }}>
            <p style={{ color: '#666' }}>{r.desc}</p>
          </Card>
        ))}
      </Card>

      <Card title="权限矩阵" style={{ borderRadius: 10 }}>
        <Table columns={columns} dataSource={dataSource} pagination={false} size="middle"
          scroll={{ x: 500 }} />
      </Card>
    </div>
  )
}
