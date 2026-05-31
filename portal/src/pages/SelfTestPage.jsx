import { useState, useCallback, useEffect } from 'react'
import { NavBar, Button, Card, Space, DotLoading, Toast, ProgressBar } from 'antd-mobile'
import { getQuizOverview, getQuizQuestions, submitQuizAnswer, getWrongQuestions } from '../api'
import { useNavigate } from 'react-router-dom'

const CATEGORIES = [
  { key: 'charter', label: '党章党纪', color: '#d32f2f' },
  { key: 'policy', label: '时政方针', color: '#e65100' },
  { key: 'history', label: '党史学习', color: '#c62828' },
  { key: 'education', label: '党性教育', color: '#6a1b9a' },
]

const SESSION = 10

export default function SelfTestPage() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('overview')
  const [overview, setOverview] = useState(null)
  const [category, setCategory] = useState('charter')

  const [sessionQuestions, setSessionQuestions] = useState([])
  const [totalInBank, setTotalInBank] = useState(0)
  const [sessionOffset, setSessionOffset] = useState(0)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState(null)
  const [results, setResults] = useState([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [wrongList, setWrongList] = useState([])

  // ── 加载题库概览 ──────────────────────────────

  const loadOverview = useCallback(async () => {
    try {
      const data = await getQuizOverview()
      if (Array.isArray(data)) setOverview(data)
    } catch {
      Toast.show({ content: '加载题库失败', icon: 'fail' })
    }
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])

  // ── 开始 / 继续答题 ────────────────────────────

  const handleStartQuiz = useCallback(async (cat) => {
    setCategory(cat)
    setPhase('loading')
    const entry = (overview || []).find((o) => o.category === cat)
    const offset = entry ? entry.current_index : 0
    try {
      const data = await getQuizQuestions(cat, null, offset, SESSION)
      if (!data.questions || data.questions.length === 0) {
        Toast.show({ content: '题库暂无题目', icon: 'fail' })
        setPhase('overview')
        return
      }
      setSessionQuestions(data.questions)
      setTotalInBank(data.total)
      setSessionOffset(offset)
      setCurrentIndex(0)
      setResults([])
      setSelectedAnswer(null)
      setShowFeedback(false)
      setPhase('quiz')
    } catch (e) {
      Toast.show({ content: e.message || '加载失败', icon: 'fail' })
      setPhase('overview')
    }
  }, [overview])

  // ── 提交答案 ──────────────────────────────────

  const handleSubmitAnswer = useCallback(async () => {
    if (!selectedAnswer) return
    const q = sessionQuestions[currentIndex]
    if (!q) return
    setSubmitting(true)
    try {
      const globalIdx = sessionOffset + currentIndex
      const result = await submitQuizAnswer(q.id, selectedAnswer, category, globalIdx)
      setResults((prev) => [...prev, {
        isCorrect: !!result.is_correct,
        correctAnswer: result.correct_answer || '',
        explanation: result.explanation || '',
        userAnswer: selectedAnswer,
        qId: q.id,
      }])
      setShowFeedback(true)
    } catch {
      Toast.show({ content: '提交失败，请重试', icon: 'fail' })
    } finally {
      setSubmitting(false)
    }
  }, [selectedAnswer, currentIndex, sessionQuestions, sessionOffset, category])

  // ── 下一题 / 查看结果 / 继续 ─────────────────────

  const handleNext = useCallback(() => {
    if (currentIndex < sessionQuestions.length - 1) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedAnswer(null)
      setShowFeedback(false)
    } else {
      setPhase('result')
    }
  }, [currentIndex, sessionQuestions.length])

  const handleContinue = useCallback(() => {
    const nextOffset = sessionOffset + sessionQuestions.length
    if (nextOffset >= totalInBank) {
      Toast.show({ content: '已完成全部题目！', icon: 'success' })
      loadOverview()
      setPhase('overview')
      return
    }
    handleStartQuiz(category)
  }, [sessionOffset, sessionQuestions.length, totalInBank, category, handleStartQuiz, loadOverview])

  // ── 错题回顾 ──────────────────────────────────

  const handleWrongReview = useCallback(async (cat) => {
    setCategory(cat)
    setPhase('loading')
    try {
      const data = await getWrongQuestions(null, cat)
      setWrongList(Array.isArray(data) ? data : [])
      setPhase('wrong-review')
    } catch {
      Toast.show({ content: '加载错题失败', icon: 'fail' })
      setPhase('overview')
    }
  }, [])

  // ── 返回概览 ──────────────────────────────────

  const backToOverview = useCallback(() => {
    loadOverview()
    setPhase('overview')
  }, [loadOverview])

  // ══════════════════════════════════════════════
  //  阶段 1：题库概览
  // ══════════════════════════════════════════════

  if (phase === 'overview') {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={() => navigate(-1)} style={{ background: '#d32f2f', color: '#fff' }}>自测练习</NavBar>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 14, color: '#666', marginBottom: 12 }}>
            选择题库，从上次进度继续答题
          </div>

          {(overview || []).map((cat) => {
            const pct = cat.total > 0 ? Math.round((cat.answered_count / cat.total) * 100) : 0
            const cfg = CATEGORIES.find((c) => c.key === cat.category) || { label: cat.category, color: '#999' }
            const isDone = cat.total > 0 && cat.current_index >= cat.total

            return (
              <Card key={cat.category} style={{ borderRadius: 12, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                  <span style={{ fontSize: 13, color: isDone ? '#2e7d32' : '#999' }}>
                    {isDone ? '已完成' : `${cat.answered_count} / ${cat.total}`}
                  </span>
                </div>

                <ProgressBar
                  percent={pct}
                  style={{
                    '--track-width': '8px',
                    '--fill-color': isDone ? '#52c41a' : cfg.color,
                    '--track-color': '#eee',
                  }}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <Button
                    block color="danger" size="small"
                    onClick={() => handleStartQuiz(cat.category)}
                    disabled={cat.total === 0 || isDone}
                    style={{ borderRadius: 6, flex: 1 }}
                  >
                    {cat.total === 0 ? '暂无题目' : isDone ? '已全部完成' : '继续答题'}
                  </Button>
                  <Button
                    block color="default" size="small"
                    onClick={() => handleWrongReview(cat.category)}
                    disabled={cat.wrong_count === 0}
                    style={{ borderRadius: 6, flex: 1 }}
                  >
                    错题回顾
                    {cat.wrong_count > 0 && (
                      <span style={{
                        marginLeft: 4, background: '#d32f2f', color: '#fff',
                        fontSize: 10, padding: '1px 6px', borderRadius: 10,
                      }}>
                        {cat.wrong_count}
                      </span>
                    )}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  //  阶段 2：加载中
  // ══════════════════════════════════════════════

  if (phase === 'loading') {
    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={backToOverview} style={{ background: '#d32f2f', color: '#fff' }}>自测练习</NavBar>
        <div style={{ textAlign: 'center', paddingTop: 100 }}>
          <DotLoading color="#d32f2f" />
          <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>正在加载题目...</div>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  //  阶段 3：答题
  // ══════════════════════════════════════════════

  if (phase === 'quiz') {
    const q = sessionQuestions[currentIndex]
    if (!q) {
      return (
        <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
          <NavBar onBack={backToOverview} style={{ background: '#d32f2f', color: '#fff' }}>自测练习</NavBar>
          <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>题目加载异常，请返回重试</div>
        </div>
      )
    }
    const globalIdx = sessionOffset + currentIndex + 1
    const isTrueFalse = q.type === 'truefalse'
    const options = isTrueFalse
      ? ['正确', '错误']
      : (() => {
          try {
            const parsed = JSON.parse(q.options)
            return Array.isArray(parsed) ? parsed : []
          } catch { return [] }
        })()
    const lastResult = results[currentIndex]

    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <NavBar onBack={backToOverview} style={{ background: '#d32f2f', color: '#fff' }}>
          自测练习
        </NavBar>

        <div style={{ padding: '10px 16px', background: '#fff', borderBottom: '1px solid #eee' }}>
          <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>
            第 {globalIdx} / {totalInBank} 题
          </div>
          <div style={{ height: 4, background: '#eee', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: '#d32f2f', borderRadius: 2,
              width: `${((sessionOffset + currentIndex + (showFeedback ? 1 : 0)) / totalInBank) * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
          <Card style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#333', lineHeight: 1.6, marginBottom: 16 }}>
              {globalIdx}. {q.content}
            </div>
            <Space direction="vertical" block style={{ gap: 10 }}>
              {options.map((opt, i) => {
                const isSelected = selectedAnswer === opt
                const isRevealed = showFeedback && lastResult
                const isCorrectOpt = isRevealed && opt === lastResult.correctAnswer
                const isWrongChoice = isRevealed && isSelected && !lastResult.isCorrect

                let bg = '#fff'
                let borderColor = '#e0e0e0'
                let textColor = '#333'

                if (isRevealed) {
                  if (isCorrectOpt) { bg = '#f0fff0'; borderColor = '#52c41a'; textColor = '#2e7d32' }
                  else if (isWrongChoice) { bg = '#fff5f5'; borderColor = '#d32f2f'; textColor = '#c62828' }
                  else { bg = '#fafafa' }
                } else if (isSelected) {
                  bg = '#fff5f5'; borderColor = '#d32f2f'; textColor = '#d32f2f'
                }

                return (
                  <div
                    key={i}
                    onClick={() => { if (!showFeedback) setSelectedAnswer(opt) }}
                    style={{
                      padding: '12px 14px', borderRadius: 8, border: `1.5px solid ${borderColor}`,
                      background: bg, cursor: showFeedback ? 'default' : 'pointer',
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      transition: 'all 0.2s',
                      opacity: isRevealed && !isCorrectOpt && !isWrongChoice ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: isSelected || isCorrectOpt ? (isCorrectOpt ? '#52c41a' : '#d32f2f') : '#f0f0f0',
                      color: isSelected || isCorrectOpt ? '#fff' : '#666',
                      fontSize: 12, fontWeight: 700, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {isCorrectOpt && isRevealed ? '✓' : String.fromCharCode(65 + i)}
                    </span>
                    <span style={{ fontSize: 14, color: textColor, lineHeight: 1.5, wordBreak: 'break-word' }}>
                      {opt}
                    </span>
                  </div>
                )
              })}
            </Space>
          </Card>

          {showFeedback && lastResult && (
            <Card style={{
              marginTop: 12, borderRadius: 12,
              background: lastResult.isCorrect ? '#f0fff0' : '#fff5f5',
            }}>
              <div style={{
                fontSize: 15, fontWeight: 600,
                color: lastResult.isCorrect ? '#2e7d32' : '#c62828',
                marginBottom: 6,
              }}>
                {lastResult.isCorrect ? '✓ 回答正确！' : '✗ 回答错误'}
              </div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                {lastResult.explanation}
              </div>
            </Card>
          )}
        </div>

        <div style={{ padding: '12px 16px', background: '#fff', borderTop: '1px solid #eee' }}>
          {!showFeedback ? (
            <Button
              block color="danger" size="large" loading={submitting}
              disabled={!selectedAnswer}
              onClick={handleSubmitAnswer}
              style={{ borderRadius: 8 }}
            >
              确认答案
            </Button>
          ) : (
            <Button block color="danger" size="large" onClick={handleNext} style={{ borderRadius: 8 }}>
              {currentIndex < sessionQuestions.length - 1 ? '下一题' : '查看结果'}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  //  阶段 4：本轮结果
  // ══════════════════════════════════════════════

  if (phase === 'result') {
    const correctCount = results.filter((r) => r.isCorrect).length
    const atEnd = sessionOffset + sessionQuestions.length >= totalInBank

    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={backToOverview} style={{ background: '#d32f2f', color: '#fff' }}>
          答题结果
        </NavBar>

        <div style={{ textAlign: 'center', padding: '32px 16px 20px' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: '#d32f2f' }}>
            {correctCount} / {sessionQuestions.length}
          </div>
          <div style={{ fontSize: 15, color: '#666', marginTop: 6 }}>
            正确率 {Math.round((correctCount / sessionQuestions.length) * 100)}%
          </div>
          <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
            题库进度 {sessionOffset + sessionQuestions.length} / {totalInBank}
          </div>
        </div>

        <div style={{ padding: '0 16px' }}>
          <Card style={{ borderRadius: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 8 }}>答题详情</div>
            {sessionQuestions.map((q, i) => {
              const r = results[i]
              if (!r) return null
              return (
                <div key={q.id} style={{
                  padding: '10px 0',
                  borderBottom: i < sessionQuestions.length - 1 ? '1px solid #f5f5f5' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: r.isCorrect ? '#e8f5e9' : '#ffebee',
                    color: r.isCorrect ? '#2e7d32' : '#c62828',
                    fontSize: 12, fontWeight: 700, flexShrink: 0, marginTop: 1,
                  }}>
                    {r.isCorrect ? '✓' : '✗'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: '#333', lineHeight: 1.5 }}>
                      {sessionOffset + i + 1}. {q.content}
                    </div>
                    <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                      你的答案: {r.userAnswer} | 正确答案: {r.correctAnswer}
                    </div>
                  </div>
                </div>
              )
            })}
          </Card>
        </div>

        <div style={{ padding: '16px', display: 'flex', gap: 10 }}>
          <Button block color="default" onClick={backToOverview} style={{ borderRadius: 8 }}>
            返回题库
          </Button>
          <Button block color="danger" onClick={handleContinue} disabled={atEnd} style={{ borderRadius: 8 }}>
            {atEnd ? '已全部完成' : '继续答题'}
          </Button>
        </div>
      </div>
    )
  }

  // ══════════════════════════════════════════════
  //  阶段 5：错题回顾
  // ══════════════════════════════════════════════

  if (phase === 'wrong-review') {
    const cfg = CATEGORIES.find((c) => c.key === category) || { label: category, color: '#999' }

    return (
      <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
        <NavBar onBack={backToOverview} style={{ background: '#d32f2f', color: '#fff' }}>
          错题回顾
        </NavBar>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            {cfg.label} · 共 {wrongList.length} 道错题
          </div>

          {wrongList.length === 0 ? (
            <Card style={{ borderRadius: 12, textAlign: 'center', padding: 40, color: '#999' }}>
              暂无错题
            </Card>
          ) : (
            wrongList.map((item, i) => {
              const isTrueFalse = item.type === 'truefalse'
              const options = isTrueFalse
                ? ['正确', '错误']
                : (() => {
                    try {
                      const parsed = JSON.parse(item.options)
                      return Array.isArray(parsed) ? parsed : []
                    } catch { return [] }
                  })()

              return (
                <Card key={item.record_id} style={{ borderRadius: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: '#333', lineHeight: 1.6, marginBottom: 12 }}>
                    {i + 1}. {item.content}
                  </div>
                  <Space direction="vertical" block style={{ gap: 8 }}>
                    {options.map((opt, j) => {
                      const isCorrectOpt = opt === item.answer
                      const isUserChoice = opt === item.user_answer

                      let bg = '#fafafa'
                      let borderColor = '#eee'
                      let textColor = '#999'

                      if (isCorrectOpt) { bg = '#f0fff0'; borderColor = '#52c41a'; textColor = '#2e7d32' }
                      else if (isUserChoice) { bg = '#fff5f5'; borderColor = '#d32f2f'; textColor = '#c62828' }

                      return (
                        <div key={j} style={{
                          padding: '10px 12px', borderRadius: 6,
                          border: `1.5px solid ${borderColor}`,
                          background: bg, display: 'flex', alignItems: 'center', gap: 8,
                        }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: isCorrectOpt ? '#52c41a' : isUserChoice ? '#d32f2f' : '#ddd',
                            color: '#fff', fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                          }}>
                            {isCorrectOpt ? '✓' : isUserChoice ? '✗' : String.fromCharCode(65 + j)}
                          </span>
                          <span style={{ fontSize: 13, color: textColor }}>{opt}</span>
                        </div>
                      )
                    })}
                  </Space>
                  {item.explanation && (
                    <div style={{
                      marginTop: 10, padding: '8px 10px',
                      background: '#fff8e1', borderRadius: 6,
                      fontSize: 12, color: '#795548', lineHeight: 1.5,
                    }}>
                      {item.explanation}
                    </div>
                  )}
                </Card>
              )
            })
          )}
        </div>
      </div>
    )
  }

  return null
}
