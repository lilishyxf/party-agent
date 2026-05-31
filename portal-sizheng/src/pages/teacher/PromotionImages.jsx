import { useState, useEffect } from 'react'
import { Card, Breadcrumb, Button, Tag, Space, Modal, Upload, Input, message } from 'antd'
import { ArrowLeftOutlined, DownloadOutlined, LeftOutlined, RightOutlined, CloseOutlined, PlusOutlined, UploadOutlined, InboxOutlined, DeleteOutlined } from '@ant-design/icons'
import { fetchImageAlbums, uploadImages, deleteImage } from '../../services/api'

const { Dragger } = Upload
const MEDIA_BASE = '/admin/media/images'
const ALBUM_COLORS = ['#d32f2f', '#c62828', '#e53935', '#b71c1c', '#d84315', '#bf360c', '#e64a19', '#a31515', '#1976d2', '#388e3c', '#7b1fa2', '#e65100', '#78909c']

function getAlbumColor(key) {
    let hash = 0
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash) + key.charCodeAt(i)
    return ALBUM_COLORS[Math.abs(hash) % ALBUM_COLORS.length]
}

export default function PromotionImages() {
    const [albums, setAlbums] = useState([])
    const [currentAlbum, setCurrentAlbum] = useState(null)
    const [lightboxIdx, setLightboxIdx] = useState(-1)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [uploadOpen, setUploadOpen] = useState(false)
    const [uploadAlbum, setUploadAlbum] = useState('')
    const [uploadFiles, setUploadFiles] = useState([])
    const [uploading, setUploading] = useState(false)
    const [cacheBuster, setCacheBuster] = useState(0)

    const loadAlbums = async () => {
        try {
            const data = await fetchImageAlbums()
            setAlbums(data.albums || [])
            return data.albums || []
        } catch (e) {
            message.error('加载相册失败')
            return []
        }
    }

    useEffect(() => { loadAlbums() }, [])

    // 切换照片或关闭灯箱时,重置删除确认状态
    useEffect(() => { setConfirmingDelete(false) }, [lightboxIdx])

    const goToList = () => {
        setCurrentAlbum(null)
        setLightboxIdx(-1)
        loadAlbums()
    }

    // 删除当前灯箱里的照片(已移除 new Promise(async) 反模式)
    const handleDeletePhoto = async () => {
        if (lightboxIdx < 0 || !currentAlbum) return
        const filename = `${String(lightboxIdx + 1).padStart(2, '0')}.jpg`
        const albumKey = currentAlbum.key
        setDeleting(true)
        try {
            const resp = await fetch(
                `/api/promotion/images/delete?album=${encodeURIComponent(albumKey)}&filename=${encodeURIComponent(filename)}`,
                { method: 'DELETE' }
            )
            if (!resp.ok) throw new Error(`${resp.status}`)
            const result = await resp.json()
            if (result.status !== 'ok') throw new Error('delete failed')
            message.success('照片已删除')

            // 关灯箱 + 刷新相册数据(用新拿到的数据,不依赖 stale state)
            setLightboxIdx(-1)
            setConfirmingDelete(false)
            const freshAlbums = await loadAlbums()
            const updated = freshAlbums.find(a => a.key === albumKey)
            setCurrentAlbum(updated && updated.count > 0 ? updated : null)
            setCacheBuster(c => c + 1)
        } catch (e) {
            message.error('删除失败: ' + e.message)
        }
        setDeleting(false)
    }

    const handleUpload = async () => {
        if (!uploadAlbum.trim()) {
            message.warning('请输入相册名称')
            return
        }
        if (uploadFiles.length === 0) {
            message.warning('请选择照片')
            return
        }
        setUploading(true)
        try {
            await uploadImages(uploadAlbum.trim(), uploadFiles)
            message.success(`已上传 ${uploadFiles.length} 张照片到「${uploadAlbum.trim()}」`)
            setUploadOpen(false)
            setUploadAlbum('')
            setUploadFiles([])

            // 用刚 fetch 回来的新数据更新 currentAlbum,而不是 stale 的 albums
            const freshAlbums = await loadAlbums()
            if (currentAlbum) {
                const updated = freshAlbums.find(a => a.key === currentAlbum.key)
                if (updated) setCurrentAlbum(updated)
            }
            setCacheBuster(c => c + 1)
        } catch (e) {
            message.error('上传失败,请重试')
        }
        setUploading(false)
    }

    // ── Album Detail View ──
    if (currentAlbum) {
        const photos = (currentAlbum.photos || []).map((url, i) => ({
            id: i + 1,
            src: url,
        }))
        const count = photos.length

        return (
            <div>
                <Breadcrumb style={{ marginBottom: 12 }}
                    items={[
                        { title: <a onClick={goToList}>宣传中心</a> },
                        { title: <a onClick={goToList}>党建图片库</a> },
                        { title: currentAlbum.key },
                    ]} />

                <Card title={currentAlbum.key} extra={
                    <Space>
                        <Button icon={<UploadOutlined />} onClick={() => { setUploadAlbum(currentAlbum.key); setUploadOpen(true) }}>上传照片</Button>
                        <Tag color="red">{count} 张照片</Tag>
                        <Button icon={<ArrowLeftOutlined />} onClick={goToList}>返回相册列表</Button>
                    </Space>
                }>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                        {photos.map((photo, i) => (
                            <div key={photo.id}
                                onClick={() => setLightboxIdx(i)}
                                style={{
                                    aspectRatio: '4/3', borderRadius: 8, overflow: 'hidden',
                                    cursor: 'pointer', border: '1px solid #f0f0f0',
                                    transition: 'transform 0.15s', background: '#f5f5f5',
                                }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <img
                                    src={`${photo.src}?t=${cacheBuster}`}
                                    alt={`照片 ${photo.id}`}
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Lightbox */}
                {lightboxIdx >= 0 && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.92)', userSelect: 'none' }}>
                        {/* Top toolbar */}
                        <div style={{ height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', background: 'rgba(0,0,0,0.3)', position: 'relative' }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <Button icon={<DownloadOutlined />} ghost onClick={e => {
                                    e.stopPropagation()
                                    const a = document.createElement('a')
                                    a.href = `${photos[lightboxIdx].src}?t=${cacheBuster}`
                                    a.download = photos[lightboxIdx].src.split('/').pop()
                                    a.click()
                                }}>下载原图</Button>

                                {/* 内联删除确认:正常态是"删除"按钮,点一下变成"确认删除 / 取消"两个按钮 */}
                                {!confirmingDelete ? (
                                    <Button
                                        icon={<DeleteOutlined />}
                                        ghost danger
                                        onClick={e => { e.stopPropagation(); setConfirmingDelete(true) }}
                                    >删除</Button>
                                ) : (
                                    <>
                                        <Button
                                            type="primary" danger
                                            icon={<DeleteOutlined />}
                                            loading={deleting}
                                            onClick={e => { e.stopPropagation(); handleDeletePhoto() }}
                                        >确认删除</Button>
                                        <Button
                                            ghost
                                            disabled={deleting}
                                            onClick={e => { e.stopPropagation(); setConfirmingDelete(false) }}
                                        >取消</Button>
                                        <span style={{ color: '#fff', fontSize: 12, opacity: 0.7, marginLeft: 4 }}>
                                            删除后不可恢复
                                        </span>
                                    </>
                                )}
                            </div>

                            <div style={{ color: '#fff', fontSize: 14, opacity: 0.8 }}>
                                {lightboxIdx + 1} / {photos.length}
                            </div>
                            <Button icon={<CloseOutlined />} ghost size="large" onClick={() => setLightboxIdx(-1)} />
                        </div>

                        {/* Image area */}
                        <div style={{
                            position: 'absolute', top: 56, left: 0, right: 0, bottom: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}
                            onClick={() => setLightboxIdx(-1)}>
                            {lightboxIdx > 0 && (
                                <Button icon={<LeftOutlined />} ghost size="large"
                                    style={{ position: 'absolute', left: 20 }}
                                    onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1) }} />
                            )}
                            <img src={`${photos[lightboxIdx].src}?t=${cacheBuster}`} alt={`照片 ${photos[lightboxIdx].id}`}
                                onClick={e => e.stopPropagation()}
                                style={{ maxWidth: '90vw', maxHeight: 'calc(100vh - 76px)', objectFit: 'contain', borderRadius: 4, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
                            {lightboxIdx < photos.length - 1 && (
                                <Button icon={<RightOutlined />} ghost size="large"
                                    style={{ position: 'absolute', right: 20 }}
                                    onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1) }} />
                            )}
                        </div>
                    </div>
                )}

                {/* Upload modal — shared between album detail and list views */}
                <Modal title="上传照片" open={uploadOpen}
                    onCancel={() => { setUploadOpen(false); setUploadFiles([]) }}
                    onOk={handleUpload}
                    confirmLoading={uploading}
                    okText="上传" cancelText="取消"
                    width={560} destroyOnClose>
                    <div style={{ marginBottom: 16 }}>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>目标相册</div>
                        <Input
                            placeholder="输入相册名称(如:2026年5月主题党日)"
                            value={uploadAlbum}
                            onChange={e => setUploadAlbum(e.target.value)}
                            style={{ marginBottom: 4 }}
                        />
                        <div style={{ fontSize: 11, color: '#999' }}>
                            已有相册:
                            {albums.map(a => (
                                <Tag key={a.key} style={{ cursor: 'pointer', marginBottom: 4 }}
                                    onClick={() => setUploadAlbum(a.key)}>{a.key}</Tag>
                            ))}
                        </div>
                    </div>
                    <div>
                        <div style={{ marginBottom: 8, fontWeight: 500 }}>选择照片</div>
                        <Dragger
                            multiple
                            accept=".jpg,.jpeg,.png,.webp"
                            fileList={uploadFiles}
                            beforeUpload={file => {
                                setUploadFiles(prev => [...prev, file])
                                return false
                            }}
                            onRemove={file => {
                                setUploadFiles(prev => prev.filter(f => f.uid !== file.uid))
                            }}
                        >
                            <p className="ant-upload-drag-icon">
                                <InboxOutlined />
                            </p>
                            <p className="ant-upload-text">点击或拖拽照片到此区域</p>
                            <p className="ant-upload-hint">支持 JPG / PNG / WebP,可批量上传</p>
                        </Dragger>
                    </div>
                </Modal>
            </div>
        )
    }

    // ── Album List View ──
    return (
        <div>
            <Breadcrumb style={{ marginBottom: 12 }}
                items={[{ title: '宣传中心' }, { title: '党建图片库' }]} />

            <Card title="党建图片库" extra={
                <Space>
                    <Button type="primary" icon={<PlusOutlined />} onClick={() => { setUploadAlbum(''); setUploadOpen(true) }}>
                        新建相册 / 上传照片
                    </Button>
                </Space>
            }>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
                    {albums.map(album => {
                        const color = getAlbumColor(album.key)
                        return (
                            <div key={album.key} onClick={() => setCurrentAlbum(album)} style={{
                                borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                                border: '1px solid #f0f0f0', transition: 'box-shadow 0.2s, transform 0.2s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
                            >
                                <div style={{
                                    height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    background: `linear-gradient(135deg, ${color}33, ${color}55)`,
                                    position: 'relative', overflow: 'hidden',
                                }}>
                                    {album.cover && (
                                        <img src={`${album.cover}?t=${cacheBuster}`} alt={album.key}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            onError={e => { e.currentTarget.style.display = 'none' }}
                                        />
                                    )}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%)',
                                    }} />
                                    <div style={{ position: 'absolute', bottom: 10, left: 14, right: 14 }}>
                                        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                                            {album.key}
                                        </div>
                                    </div>
                                    <div style={{ position: 'absolute', top: 10, right: 12 }}>
                                        <Tag color="red">{album.count} 张</Tag>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                    {albums.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 60, color: '#ccc', gridColumn: '1 / -1' }}>暂无相册,点击上方按钮上传照片</div>
                    )}
                </div>
            </Card>

            {/* Upload modal */}
            <Modal title="上传照片" open={uploadOpen}
                onCancel={() => { setUploadOpen(false); setUploadFiles([]) }}
                onOk={handleUpload}
                confirmLoading={uploading}
                okText="上传" cancelText="取消"
                width={560} destroyOnClose>
                <div style={{ marginBottom: 16 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>目标相册</div>
                    <Input
                        placeholder="输入相册名称(如:2026年5月主题党日)"
                        value={uploadAlbum}
                        onChange={e => setUploadAlbum(e.target.value)}
                        style={{ marginBottom: 4 }}
                    />
                    <div style={{ fontSize: 11, color: '#999' }}>
                        已有相册:
                        {albums.map(a => (
                            <Tag key={a.key} style={{ cursor: 'pointer', marginBottom: 4 }}
                                onClick={() => setUploadAlbum(a.key)}>{a.key}</Tag>
                        ))}
                    </div>
                </div>

                <div>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>选择照片</div>
                    <Dragger
                        multiple
                        accept=".jpg,.jpeg,.png,.webp"
                        fileList={uploadFiles}
                        beforeUpload={file => {
                            setUploadFiles(prev => [...prev, file])
                            return false
                        }}
                        onRemove={file => {
                            setUploadFiles(prev => prev.filter(f => f.uid !== file.uid))
                        }}
                    >
                        <p className="ant-upload-drag-icon">
                            <InboxOutlined />
                        </p>
                        <p className="ant-upload-text">点击或拖拽照片到此区域</p>
                        <p className="ant-upload-hint">支持 JPG / PNG / WebP,可批量上传</p>
                    </Dragger>
                </div>
            </Modal>
        </div>
    )
}