import { Drawer, Divider } from 'antd'
import { QuestionCircleOutlined } from '@ant-design/icons'
import { getHelpContent } from '../services/helpContent'

export default function HelpDrawer({ open, onClose, pathname }) {
  const content = getHelpContent(pathname)

  return (
    <Drawer
      title={
        <span style={{ fontSize: 16 }}>
          <QuestionCircleOutlined style={{ marginRight: 8, color: '#d32f2f' }} />
          使用帮助
        </span>
      }
      placement="right"
      width={420}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: '16px 24px' } }}
    >
      <h3 style={{ marginBottom: 4, color: '#c62828' }}>{content.title}</h3>
      <Divider style={{ margin: '12px 0' }} />

      {content.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: i < content.sections.length - 1 ? 20 : 0 }}>
          <h4 style={{ marginBottom: 6, color: '#333' }}>{s.heading}</h4>
          <p style={{ margin: 0, lineHeight: 1.8, color: '#555', whiteSpace: 'pre-wrap' }}>{s.text}</p>
        </div>
      ))}
    </Drawer>
  )
}
