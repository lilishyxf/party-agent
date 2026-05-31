import { useState, useEffect } from 'react'
import { NavBar, Button, Card, DotLoading, ProgressBar, Toast, Result, Tag } from 'antd-mobile'
import { getExamDetail, submitExam, getMyExamResult } from '../api'


const TYPE_LABEL = { choice: '单选题', single: '单选题', truefalse: '判断题', multi: '多选题' }

export default function ExamPage({ onBack, examId, reviewMode }) {
  const [phase, setPhase] = useState('loading') // loading | quiz | result | review
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [scoreResult, setScoreResult] = useState(null)

  useEffect(() => {
    if (reviewMode) {
      getMyExamResult(examId, null)
        .then(data => {
          if (data.error) { Toast.show({ icon: 'fail', content: data.error }); return }
          setExam(data)
          const qs = (data.questions || []).map(q => {
            let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            if (!opts || opts.length === 0) {
              if (q.type === 'truefalse') opts = ['正确', '错误']
              else if (q.type === 'choice') opts = ['A', 'B', 'C', 'D']
            }
            return { ...q, options: opts }
          })
          setQuestions(qs)
          setScoreResult(data)
          setPhase('review')
        })
        .catch(() => Toast.show({ icon: 'fail', content: '加载考试成绩失败' }))
    } else {
      getExamDetail(examId, null)
        .then(data => {
          if (data.error) { Toast.show({ icon: 'fail', content: data.error }); return }
          setExam(data)
          const qs = (data.questions || []).map(q => {
            let opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
            if (!opts || opts.length === 0) {
              if (q.type === 'truefalse') opts = ['正确', '错误']
              else if (q.type === 'choice') opts = ['A', 'B', 'C', 'D']
            }
            return { ...q, options: opts }
          })
          setQuestions(qs)
          setPhase('quiz')
        })
        .catch(() => Toast.show({ icon: 'fail', content: '加载考试失败' }))
    }
  }, [examId, reviewMode])

  const selectAnswer = (questionId, answer) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }))
  }

  const handleSubmit = async () => {
    const unanswered = questions.filter(q => !answers[q.question_id])
    if (unanswered.length > 0) {
      Toast.show({ content: `还有 ${unanswered.length} 题未作答` })
      return
    }
    setSubmitting(true)
    try {
      const answerList = Object.entries(answers).map(([qid, ans]) => ({
        question_id: parseInt(qid),
        answer: ans,
      }))
      const res = await submitExam(examId, answerList, null)
      setScoreResult(res)
      setPhase('result')
    } catch {
      Toast.show({ icon: 'fail', content: '提交失败，请重试' })
    } finally {
      setSubmitting(false)
    }
  }

  const currentQ = questions[currentIndex]
  const answeredCount = Object.keys(answers).length

  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={onBack} style={{ background: '#fff' }}>{reviewMode ? '考试成绩' : '考试'}</NavBar>
        <div style={{ textAlign: 'center', padding: 80 }}>
          <DotLoading color="primary" />
          <div style={{ color: '#999', marginTop: 10, fontSize: 13 }}>加载中...</div>
        </div>
      </div>
    )
  }

  // ── 刚刚交卷的结果页 ──────────────────────────
  if (phase === 'result') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
        <NavBar onBack={onBack} style={{ background: '#fff' }}>考试结果</NavBar>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <Result
            status={scoreResult?.passed ? 'success' : 'error'}
            title={scoreResult?.passed ? '考试通过' : '未通过'}
            description={`得分 ${scoreResult?.score} 分（正确 ${scoreResult?.correct}/${scoreResult?.total} 题）`}
          />
          <div style={{ marginTop: 20, fontSize: 14, color: '#666' }}>
            {exam?.pass_score && <p>及格分：{exam.pass_score} 分</p>}
          </div>
          <Button block color="primary" onClick={onBack} style={{ borderRadius: 8, marginTop: 24 }}>
            返回任务中心
          </Button>
        </div>
      </div>
    )
  }

  // ── 回顾已交卷的答卷 ──────────────────────────
  if (phase === 'review') {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 60 }}>
        <NavBar onBack={onBack} style={{ background: '#fff' }}>考试成绩</NavBar>

        {/* 得分概览 */}
        <Card style={{ margin: '12px', borderRadius: 10, textAlign: 'center' }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: scoreResult?.passed ? '#52c41a' : '#d32f2f' }}>
            {scoreResult?.score}
            <span style={{ fontSize: 16, fontWeight: 400 }}> 分</span>
          </div>
          <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>
            正确 {questions.filter(q => q.is_correct).length}/{questions.length} 题 · 及格分 {exam?.pass_score}
          </div>
          <Tag color={scoreResult?.passed ? 'success' : 'danger'} style={{ marginTop: 8 }}>
            {scoreResult?.passed ? '已通过' : '未通过'}
          </Tag>
        </Card>

        {/* 逐题回顾 */}
        {questions.map((q, i) => (
          <Card key={q.question_id} style={{ margin: '0 12px 12px', borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
              <Tag color={q.is_correct ? 'success' : 'danger'} style={{ flexShrink: 0 }}>
                {q.is_correct ? '正确' : '错误'}
              </Tag>
              <div>
                <div style={{ fontSize: 12, color: '#999' }}>
                  第 {i + 1} 题 · {TYPE_LABEL[q.type] || q.type}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#333', lineHeight: 1.6, marginBottom: 12 }}>
              {q.content}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {q.options?.map((opt, j) => {
                const letter = String.fromCharCode(65 + j)
                const isUser = q.user_answer === letter
                const isCorrect = q.correct_answer === letter
                let bg = '#fff'; let border = '#e8e8e8'; let labelBg = '#f0f0f0'; let labelColor = '#666'
                if (isUser && isCorrect) { bg = '#f6ffed'; border = '#52c41a'; labelBg = '#52c41a'; labelColor = '#fff' }
                else if (isUser && !isCorrect) { bg = '#fff2f0'; border = '#d32f2f'; labelBg = '#d32f2f'; labelColor = '#fff' }
                else if (!isUser && isCorrect) { bg = '#f6ffed'; border = '#52c41a'; labelBg = '#52c41a'; labelColor = '#fff' }
                return (
                  <div key={j} style={{
                    padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${border}`,
                    background: bg, fontSize: 14, color: '#333', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 12, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0,
                      background: labelBg, color: labelColor,
                    }}>{letter}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {isUser && <span style={{ fontSize: 11, color: isCorrect ? '#52c41a' : '#d32f2f', flexShrink: 0 }}>你的答案</span>}
                    {isCorrect && !isUser && <span style={{ fontSize: 11, color: '#52c41a', flexShrink: 0 }}>正确答案</span>}
                  </div>
                )
              })}
            </div>
            {!q.is_correct && q.explanation && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 6, background: '#fffbe6', fontSize: 12, color: '#8c6900', lineHeight: 1.5 }}>
                解析：{q.explanation}
              </div>
            )}
          </Card>
        ))}

        <div style={{ padding: '0 12px', marginTop: 8 }}>
          <Button block color="primary" onClick={onBack} style={{ borderRadius: 8 }}>返回任务中心</Button>
        </div>
      </div>
    )
  }

  // ── 答题中 ─────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', paddingBottom: 80 }}>
      <NavBar onBack={onBack} style={{ background: '#fff' }}>{exam?.title || '考试'}</NavBar>

      {/* 进度条 */}
      <Card style={{ margin: '12px', borderRadius: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: '#666' }}>进度</span>
          <span style={{ fontSize: 13, color: '#1677ff' }}>{currentIndex + 1} / {questions.length}</span>
        </div>
        <ProgressBar percent={Math.round((answeredCount / questions.length) * 100)}
          style={{ '--track-width': '6px', '--fill-color': '#1677ff' }} />
        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
          已答 {answeredCount}/{questions.length} 题
        </div>
      </Card>

      {/* 题卡 */}
      {currentQ && (
        <Card style={{ margin: '0 12px 12px', borderRadius: 10 }}>
          <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>
            第 {currentIndex + 1} 题 · {TYPE_LABEL[currentQ.type] || currentQ.type}
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.6, marginBottom: 16 }}>
            {currentQ.content}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {currentQ.options?.map((opt, i) => {
              const letter = String.fromCharCode(65 + i)
              const selected = answers[currentQ.question_id] === letter
              return (
                <div key={i}
                  onClick={() => selectAnswer(currentQ.question_id, letter)}
                  style={{
                    padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${selected ? '#1677ff' : '#e8e8e8'}`,
                    background: selected ? '#e6f4ff' : '#fff', cursor: 'pointer',
                    fontSize: 15, color: '#333', display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                  <span style={{
                    width: 26, height: 26, borderRadius: 13, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, fontWeight: 600, flexShrink: 0,
                    background: selected ? '#1677ff' : '#f0f0f0', color: selected ? '#fff' : '#666',
                  }}>{letter}</span>
                  <span>{opt}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* 底部导航 */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff',
        borderTop: '1px solid #eee', padding: '10px 16px', display: 'flex', gap: 12,
        justifyContent: 'space-between', alignItems: 'center', zIndex: 10,
      }}>
        <Button
          color="default"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex(i => i - 1)}
          style={{ borderRadius: 8, flex: 1 }}
        >上一题</Button>

        {currentIndex < questions.length - 1 ? (
          <Button
            color="primary"
            onClick={() => setCurrentIndex(i => i + 1)}
            style={{ borderRadius: 8, flex: 1 }}
          >下一题</Button>
        ) : (
          <Button
            color="danger"
            loading={submitting}
            onClick={handleSubmit}
            style={{ borderRadius: 8, flex: 1, '--background-color': '#d32f2f' }}
          >交卷</Button>
        )}
      </div>
    </div>
  )
}
