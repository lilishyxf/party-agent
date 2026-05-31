import { useState } from 'react'
import { Card, Breadcrumb, Button, Modal, Tag, Empty } from 'antd'
import { PlayCircleOutlined, VideoCameraOutlined, ClockCircleOutlined } from '@ant-design/icons'

const MEDIA_BASE = '/admin/media/videos'

const VIDEOS = [
  {
    id: 1,
    title: '中办印发《通知》在全党开展树立和践行正确政绩观学习教育',
    filename: '中办印发《通知》在全党开展树立和践行正确政绩观学习教育.mp4',
    duration: '3:45',
    color: '#d32f2f',
    description: '中共中央办公厅印发《关于在全党开展树立和践行正确政绩观学习教育的通知》，对学习教育作出全面部署。通知要求各级党委（党组）精心组织实施，坚持学查改相结合，确保学习教育取得实效。',
  },
  {
    id: 2,
    title: '全国两会上习近平多次强调政绩观',
    filename: '全国两会上习近平多次强调政绩观.mp4',
    duration: '5:20',
    color: '#1976d2',
    description: '习近平总书记在全国两会期间多次强调树立和践行正确政绩观，指出"共产党人必须牢记，为民造福是最大政绩"，为广大党员干部干事创业指明了正确方向。',
  },
]

export default function PromotionVideos() {
  const [playing, setPlaying] = useState(null)

  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '宣传中心' }, { title: '视频资料库' }]} />

      <Card title="视频资料库">
        {VIDEOS.length === 0 ? <Empty description="暂无视频资源" /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20 }}>
            {VIDEOS.map(video => (
              <div key={video.id} style={{
                borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                border: '1px solid #f0f0f0', transition: 'box-shadow 0.2s, transform 0.2s',
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
              >
                {/* Thumbnail area with first-frame or play button */}
                <div onClick={() => setPlaying(video)} style={{
                  height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg, ${video.color}22, ${video.color}55)`,
                  position: 'relative',
                }}>
                  <VideoCameraOutlined style={{ fontSize: 56, color: video.color, opacity: 0.5 }} />
                  <div style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.15s',
                    }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <PlayCircleOutlined style={{ fontSize: 30, color: '#fff' }} />
                    </div>
                  </div>
                  <div style={{
                    position: 'absolute', bottom: 8, right: 10,
                    background: 'rgba(0,0,0,0.65)', color: '#fff', borderRadius: 4,
                    padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <ClockCircleOutlined style={{ fontSize: 10 }} />
                    {video.duration}
                  </div>
                </div>
                {/* Info */}
                <div style={{ padding: '14px 16px', background: '#fff' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8, lineHeight: 1.5 }}>
                    {video.title}
                  </div>
                  <div style={{ fontSize: 12, color: '#888', lineHeight: 1.7 }}>
                    {video.description}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Video player modal */}
      <Modal title={playing?.title} open={!!playing} onCancel={() => setPlaying(null)}
        footer={null} width={760} destroyOnClose>
        {playing && (
          <video
            controls
            autoPlay
            style={{ width: '100%', borderRadius: 8, background: '#000' }}
            src={`${MEDIA_BASE}/${encodeURIComponent(playing.filename)}`}
          >
            您的浏览器不支持视频播放
          </video>
        )}
      </Modal>
    </div>
  )
}
