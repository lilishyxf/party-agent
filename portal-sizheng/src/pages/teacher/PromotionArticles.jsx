import { useState } from 'react'
import { Card, Button, Input, Select, Tag, Popconfirm, message, Breadcrumb, Space, Modal, Form } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, ArrowLeftOutlined, ClockCircleOutlined } from '@ant-design/icons'

const { TextArea } = Input

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已发布', value: 'published' },
  { label: '草稿', value: 'draft' },
]

const CAT_OPTIONS = [
  { label: '党建新闻', value: 'news' },
  { label: '活动报道', value: 'activity' },
  { label: '学习心得', value: 'reflection' },
  { label: '通知公告', value: 'notice' },
]

const CAT_LABEL = { news: '党建新闻', activity: '活动报道', reflection: '学习心得', notice: '通知公告' }
const CAT_COLOR = { news: '#d32f2f', activity: '#e65100', reflection: '#7b1fa2', notice: '#0277bd' }
const STATUS_COLOR = { published: 'green', draft: 'default' }

const SOURCE_MAP = {
  news: '计算机学院教师第一党支部',
  activity: '计算机学院教师第一党支部',
  reflection: '学习强国',
  notice: '计算机学院教师第一党支部',
}

const EDITOR_MAP = {
  news: '吴琼',
  activity: '吴琼',
  reflection: '吴琼',
  notice: '吴琼',
}

const MOCK = [
  {
    id: 1, title: '计算机学院教师第一党支部召开2026年度组织生活会暨民主评议党员大会', category: 'news', status: 'published',
    publishedAt: '2026-05-15 16:30', source: '计算机学院教师第一党支部', editor: '吴琼',
    summary: '5月15日下午，计算机学院教师第一党支部在学院学术报告厅召开2026年度组织生活会暨民主评议党员大会。支部书记吴琼同志主持会议，支部全体党员参加。会议开展了严肃认真的批评与自我批评，并进行了民主评议党员测评。',
    content: `5月15日下午，计算机学院教师第一党支部在学院学术报告厅召开2026年度组织生活会暨民主评议党员大会。会议由支部书记吴琼同志主持，支部全体党员参加会议。

会上，支部书记吴琼首先代表支委班子作2025年度党建工作述职报告，全面回顾了一年来支部在思想政治建设、组织建设、作风建设等方面取得的成绩，深刻剖析了存在的问题和不足，并提出了2026年的工作思路和改进措施。

吴琼在述职中指出，过去一年，支部在学校党委和学院党委的正确领导下，坚持以习近平新时代中国特色社会主义思想为指导，深入学习贯彻党的二十大和二十届三中全会精神，紧紧围绕立德树人根本任务，扎实推进支部各项建设，取得了显著成效。

随后，全体党员逐一进行个人对照检查发言，紧紧围绕政治信仰、党员意识、理论学习、能力本领、作用发挥、纪律作风等六个方面，深入查摆问题，深刻剖析根源，严肃开展批评与自我批评。大家在发言中敞开心扉、坦诚相见，既交流了思想、增进了团结，又指出了问题、明确了方向。与会党员一致认为，此次组织生活会准备充分、程序规范、批评深刻，达到了"团结—批评—团结"的目的。

会议还进行了民主评议党员测评。全体参会党员以无记名投票方式对每位党员进行了民主测评，测评结果将作为党员年度考核的重要依据。

会议最后，吴琼同志作总结发言。她强调，全体党员要以此次组织生活会为契机，进一步提高政治站位，强化责任担当，在教学科研、管理服务等各项工作中充分发挥先锋模范作用，为学院高质量发展贡献力量。她要求，针对查摆出来的问题，每位党员要制定切实可行的整改措施，做到立行立改、真改实改，确保组织生活会取得实实在在的效果。`,
  },
  {
    id: 2, title: '计算机学院与西安交通大学计算机学院联合开展"党建引领·科技创新"主题党日活动', category: 'activity', status: 'published',
    publishedAt: '2026-04-24 14:20', source: '计算机学院教师第一党支部', editor: '吴琼',
    summary: '4月24日上午，计算机学院教师第一党支部与西安交通大学计算机科学与技术学院教工党支部联合开展了以"党建引领、科技创新"为主题的党日联建活动。两院教师党员代表共30余人参加。',
    content: `4月24日上午，计算机学院教师第一党支部与西安交通大学计算机科学与技术学院教工党支部联合开展了以"党建引领、科技创新"为主题的党日联建活动。两院教师党员代表共30余人参加活动。

活动伊始，两院教师党员一同参观了西安交通大学西迁博物馆，深入学习"西迁精神"。在讲解员的引导下，大家通过珍贵的历史照片、文献资料和实物展品，深刻感悟老一辈交大人"胸怀大局、无私奉献、弘扬传统、艰苦创业"的西迁精神内涵。参观过程中，党员们不时驻足交流，纷纷表示要将西迁精神与新时代高校教师的使命担当紧密结合。

参观结束后，双方在西安交通大学计算机学院会议室举行座谈会。会上，西交大计算机学院教工党支部书记介绍了支部在党建引领学科建设、科研攻关、人才培养等方面的经验做法，特别是"党建+"模式的探索实践。我院教师第一党支部书记吴琼同志介绍了支部在推进党建与业务深度融合、开展"党建+"品牌创建等方面的探索实践和取得的成效。

双方围绕"新时代高校教师党支部如何以党建引领科技创新"主题进行了深入交流研讨。与会教师党员踊跃发言，结合自身教学科研实践，分享了在党建引领下开展科技创新的心得体会。大家一致认为，高校教师党员要坚持以服务国家战略需求为导向，把论文写在祖国大地上，在关键核心技术攻关中发挥党员先锋模范作用。

座谈会后，双方签署了党支部联建共建协议，约定今后定期开展学术交流和党建联建活动，建立常态化合作机制，共同推动党建与科技创新深度融合。

此次联建活动不仅加深了两院教师党支部的交流合作，更是一次生动的党性教育和精神洗礼。大家一致表示，要以"西迁精神"为指引，在新时代展现新作为、创造新业绩，为教育强国和科技强国建设贡献智慧和力量。`,
  },
  {
    id: 3, title: '深入学习贯彻中央八项规定精神  持之以恒纠治"四风"', category: 'reflection', status: 'published',
    publishedAt: '2026-04-02 10:15', source: '学习强国', editor: '吴琼',
    summary: '近日，计算机学院教师第一党支部组织全体党员开展了深入学习中央八项规定精神专题教育活动。通过集中学习、个人自学、交流研讨等多种形式，使全体党员对中央八项规定精神有了更加深入的认识和理解。',
    content: `近日，计算机学院教师第一党支部组织全体党员开展了深入学习中央八项规定精神专题教育活动。通过集中学习、个人自学、交流研讨等多种形式，我对中央八项规定精神有了更加深入的认识和理解。

一、深刻认识八项规定精神的重大意义

中央八项规定是党的十八大以来全面从严治党的重要突破口，是我们党加强作风建设的鲜明旗帜。八项规定实施十余年来，党风政风焕然一新，社风民风持续向好。中央纪委国家监委数据显示，全国纪检监察机关查处的违反中央八项规定精神问题数量逐年下降，充分说明作风建设取得了显著成效。

作为高校教师党员，我们既是立德树人的践行者，也是党风建设的参与者，必须深刻理解八项规定精神的实质，自觉做优良作风的传承者和弘扬者。高校是培养社会主义建设者和接班人的重要阵地，教师党员的作风直接影响青年学生的价值取向。

二、准确把握八项规定精神的核心要义

八项规定内容具体、要求明确，核心在于"严"和"实"。"严"体现在对党员干部的严格要求、严格管理、严格监督；"实"体现在强调实事求是、力戒形式主义和官僚主义。对于高校教师而言，就是要把精力和心思用在教书育人上，用在科研攻关上，坚决克服"浮躁""功利"等不良风气，以良好师德师风引领学生成长成才。

三、自觉践行八项规定精神的具体行动

作为一名教师党员，我将从以下几个方面践行八项规定精神：一是在教学中坚持立德树人根本任务，踏踏实实备课授课，杜绝敷衍应付，把每一堂课都作为精品课来打磨；二是在科研中坚持学术诚信，反对弄虚作假，坚守科研伦理底线；三是在日常交往中保持清正廉洁，自觉抵制各种不正之风，树立教师党员的良好形象；四是在支部生活中积极发言，认真开展批评与自我批评，勇于指出问题、敢于接受批评。

作风建设永远在路上。我将以此次专题学习为新起点，时刻保持清醒头脑，严格自律，在教书育人的岗位上以实际行动贯彻落实中央八项规定精神，为培养德智体美劳全面发展的社会主义建设者和接班人贡献力量。`,
  },
  {
    id: 4, title: '关于做好2026年第二季度党费收缴工作的通知', category: 'notice', status: 'published',
    publishedAt: '2026-04-01 09:00', source: '计算机学院教师第一党支部', editor: '吴琼',
    summary: '根据学校党委组织部关于党费收缴工作的统一部署，现将2026年第二季度（4月-6月）党费收缴工作有关事项通知如下。',
    content: `各位党员同志：

根据学校党委组织部关于党费收缴工作的统一部署，现将2026年第二季度（4月-6月）党费收缴工作有关事项通知如下：

一、党费计算标准

按照《关于中国共产党党费收缴、使用和管理的规定》，党费收缴以党员每月工资总额中相对固定的、经常性的工资收入（税后）为计算基数，按规定比例缴纳：

——月工资收入在3000元以下（含3000元）者，缴纳月工资收入的0.5%；
——月工资收入在3000元以上至5000元（含5000元）者，缴纳1%；
——月工资收入在5000元以上至10000元（含10000元）者，缴纳1.5%；
——月工资收入在10000元以上者，缴纳2%。

二、收缴时间安排

请各位党员同志在4月15日前完成本季度（4-6月）党费的缴纳工作。如遇特殊情况不能按时缴纳，请提前向支部组织委员说明情况，经支部委员会同意后可适当延期。

三、收缴方式

本季度党费收缴继续采用"线上+线下"相结合的方式：
1. 线下缴纳：请在工作时间到学院办公室交至支部组织委员处，现场开具收据；
2. 线上缴纳：可通过学校财务系统或支部指定的党费收缴平台在线缴纳，缴纳后请截图保存凭证。

四、相关要求

按时足额缴纳党费是每个党员应尽的义务，也是党员党性观念和组织纪律性的具体体现。《中国共产党章程》明确规定，党员如果没有正当理由，连续六个月不交纳党费，就被认为是自行脱党。请各位党员同志高度重视，及时完成党费缴纳工作。

如有任何疑问，请联系支部组织委员。

联系人：支部组织委员
联系电话：029-XXXXXXXX

计算机学院教师第一党支部
2026年4月1日`,
  },
  {
    id: 5, title: '教师第一党支部"分类指导、争先进位"三年行动计划中期自查报告', category: 'news', status: 'draft',
    publishedAt: '2026-05-18 11:00', source: '计算机学院教师第一党支部', editor: '吴琼',
    summary: '按照学校党委部署要求，计算机学院教师第一党支部对照建设标准，认真开展了"分类指导、争先进位"三年行动计划中期自查工作，总结了取得的成效，查找了存在的问题，制定了下一步整改措施。',
    content: `按照学校党委《西安工业大学基层党组织"分类指导、争先进位"三年行动计划2024年工作实施方案》部署要求，计算机学院教师第一党支部对照建设标准，认真开展了中期自查工作。现将自查情况报告如下：

一、党建工作成效

（一）政治建设持续加强。支部坚持把党的政治建设摆在首位，严格落实"三会一课"制度，每季度至少召开1次支部党员大会、每月召开1次支委会、每月开展1次主题党日活动。2025年以来，支部组织政治理论学习12次，专题研讨4次，党员参与率达到95%以上。支部理论学习中心组被学院党委评为"优秀学习小组"。

（二）思想引领不断深化。支部以深入学习贯彻习近平新时代中国特色社会主义思想为主线，通过集中学习、个人自学、学习强国平台等多种载体，持续加强党员思想政治教育工作。支部学习强国人均积分长期保持在学院前列，3名党员获学校"学习强国"学习标兵称号。

（三）组织基础更加牢固。支部现有党员22人，其中教授4人，副教授10人，讲师及助教8人。支部委员5人，分工明确、履职到位。2025年度发展预备党员1名，按期转正1名，培养入党积极分子3名。支部被学校党委评为"先进基层党组织"。

（四）作风建设扎实推进。支部深入开展党纪学习教育，组织观看警示教育片2次，开展廉政专题学习3次。全体教师党员签订了师德师风承诺书，未发生违反师德师风行为。

（五）服务效能显著提升。支部围绕学院中心工作，积极参与"我为群众办实事"实践活动，累计开展志愿服务6次，帮扶困难学生15人次，为师生解决实际问题12件。

二、存在的主要问题

一是理论学习深度有待加强，个别党员学习存在"浅表化"现象，学用结合不够紧密；二是党建与教学科研融合还不够紧密，"党建+"品牌效应有待提升，党建促业务的实效性需要进一步增强；三是支部工作创新举措不多，形式和载体相对单一，信息化建设滞后；四是党员先锋模范作用发挥不够充分，先进典型的示范引领效应有待强化。

三、下一步整改措施

（一）深化理论学习。制定更加系统的学习计划，建立"领学+研讨+考核"三位一体学习机制，确保理论学习入脑入心、见行见效。建立党员学习档案，将学习情况纳入党员年度考核。

（二）推动党建与业务深度融合。围绕学科建设和人才培养重点任务，策划实施"党建+科研攻关""党建+课程思政"等系列活动，使党建工作与教学科研同频共振、互促共进。

（三）创新工作载体。充分利用信息化手段，探索"智慧党建"新模式，建设支部线上学习平台，提升支部活动的吸引力和实效性。

（四）强化示范引领。积极培育选树先进典型，开展"党员先锋岗"创建活动，发挥党员在教学科研、管理服务中的先锋模范作用，营造比学赶超的良好氛围。

我支部将以此次中期自查为契机，进一步找差距、补短板、强弱项，确保三年行动计划各项任务落地落实，为学院高质量发展贡献更大力量。`,
  },
]

export default function PromotionArticles() {
  const [data] = useState(MOCK)
  const [viewing, setViewing] = useState(null)     // article being viewed in detail
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const filtered = data.filter(item => {
    if (status && item.status !== status) return false
    if (search && !item.title.includes(search) && !item.summary.includes(search)) return false
    return true
  })

  const handleNew = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const handleEdit = (record, e) => {
    e.stopPropagation()
    setEditing(record)
    form.setFieldsValue(record)
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(vals => {
      if (editing) {
        Object.assign(editing, vals)
        message.success('文章已更新')
      } else {
        const now = new Date()
        const publishedAt = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
        const newArticle = {
          id: Date.now(), ...vals, status: 'draft', publishedAt,
          source: SOURCE_MAP[vals.category] || '',
          editor: EDITOR_MAP[vals.category] || '',
          summary: (vals.content || '').slice(0, 120) + '……',
        }
        data.unshift(newArticle)
        message.success('文章已创建（草稿）')
      }
      setModalOpen(false)
    })
  }

  const handleDelete = (record, e) => {
    e.stopPropagation()
    const idx = data.findIndex(d => d.id === record.id)
    if (idx > -1) data.splice(idx, 1)
    message.success('已删除')
  }

  const handlePublish = (record, e) => {
    e.stopPropagation()
    record.status = 'published'
    record.publishedAt = (() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
    })()
    message.success('文章已发布')
  }

  // ── Article Detail View ──
  if (viewing) {
    const catColor = CAT_COLOR[viewing.category] || '#d32f2f'
    return (
      <div>
        <Breadcrumb style={{ marginBottom: 12 }}
          items={[
            { title: '宣传中心' },
            { title: <a onClick={() => setViewing(null)}>党建文章发布</a> },
            { title: viewing.title },
          ]} />

        <Card style={{ borderRadius: 10, maxWidth: 900, margin: '0 auto' }}
          bodyStyle={{ padding: '40px 48px' }}>
          {/* Category tag */}
          <div style={{ marginBottom: 12 }}>
            <Tag color={catColor}>{CAT_LABEL[viewing.category]}</Tag>
          </div>

          {/* Title */}
          <h1 style={{ fontSize: 26, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.4, marginBottom: 24 }}>
            {viewing.title}
          </h1>

          {/* Metadata header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap',
            paddingBottom: 20, marginBottom: 28, borderBottom: '1px solid #f0f0f0',
            fontSize: 13, color: '#999',
          }}>
            <span>
              <ClockCircleOutlined style={{ marginRight: 4 }} />
              发布时间：{viewing.publishedAt}
            </span>
            <span>来源：{viewing.source}</span>
            <span>编辑：{viewing.editor}</span>
          </div>

          {/* Body */}
          <div style={{
            fontSize: 15, lineHeight: 2.2, color: '#333',
            whiteSpace: 'pre-wrap', textIndent: '2em',
          }}>
            {viewing.content}
          </div>

          {/* Metadata footer */}
          <div style={{
            marginTop: 36, paddingTop: 20, borderTop: '1px solid #f0f0f0',
            fontSize: 12, color: '#bbb', textAlign: 'right',
          }}>
            <div>发布时间：{viewing.publishedAt}</div>
            <div>来源：{viewing.source}</div>
            <div>编辑：{viewing.editor}</div>
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setViewing(null)}>返回文章列表</Button>
        </div>
      </div>
    )
  }

  // ── Article List View ──
  return (
    <div>
      <Breadcrumb style={{ marginBottom: 12 }}
        items={[{ title: '宣传中心' }, { title: '党建文章发布' }]} />

      <Card title="党建文章发布" extra={
        <Space>
          <Select style={{ width: 110 }} value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <Input prefix={<SearchOutlined />} placeholder="搜索文章" value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 220 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={handleNew}>新建文章</Button>
        </Space>
      }>
        {/* Article cards */}
        <div style={{ display: 'grid', gap: 16 }}>
          {filtered.map(article => (
            <div key={article.id}
              onClick={() => setViewing(article)}
              style={{
                display: 'flex', gap: 20, padding: 20, borderRadius: 10,
                border: '1px solid #f0f0f0', cursor: 'pointer',
                transition: 'box-shadow 0.2s, transform 0.15s',
                background: '#fff',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none' }}
            >
              {/* Left color strip */}
              <div style={{
                width: 4, borderRadius: 4, flexShrink: 0,
                background: CAT_COLOR[article.category] || '#d32f2f',
              }} />

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Tag color={CAT_COLOR[article.category]}>{CAT_LABEL[article.category]}</Tag>
                  {article.status === 'draft' && <Tag>草稿</Tag>}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#1a1a1a', lineHeight: 1.5, marginBottom: 8 }}>
                  {article.title}
                </div>
                <div style={{ fontSize: 13, color: '#888', lineHeight: 1.6, marginBottom: 10 }}>
                  {article.summary}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, color: '#bbb' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />
                    {article.publishedAt}
                    <span style={{ margin: '0 8px', color: '#ddd' }}>|</span>
                    {article.source}
                  </div>
                  <Space onClick={e => e.stopPropagation()}>
                    <Button size="small" icon={<EyeOutlined />}
                      onClick={() => setViewing(article)}>查看</Button>
                    <Button size="small" icon={<EditOutlined />}
                      onClick={e => handleEdit(article, e)}>编辑</Button>
                    {article.status === 'draft' && (
                      <Popconfirm title="确认发布？" onConfirm={e => handlePublish(article, e)}>
                        <Button size="small" type="primary">发布</Button>
                      </Popconfirm>
                    )}
                    <Popconfirm title="确认删除？" onConfirm={e => handleDelete(article, e)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: '#ccc' }}>暂无文章</div>
          )}
        </div>
      </Card>

      {/* Article editor modal */}
      <Modal title={editing ? '编辑文章' : '新建文章'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={handleSave} width={760} destroyOnClose>
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="文章标题" />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select options={CAT_OPTIONS} placeholder="选择分类" />
          </Form.Item>
          <Form.Item name="content" label="正文" rules={[{ required: true, message: '请输入正文' }]}>
            <TextArea rows={14} placeholder="文章正文内容..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
