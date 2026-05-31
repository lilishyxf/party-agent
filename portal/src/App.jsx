import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import HomePage from './pages/HomePage'
import QAPage from './pages/QAPage'
import LearningPage from './pages/LearningPage'
import SelfTestPage from './pages/SelfTestPage'
import WritingPage from './pages/WritingPage'
import WritingEditor from './pages/WritingEditor'
import ProfilePage from './pages/ProfilePage'
import BindPage from './pages/BindPage'
import TaskPage from './pages/TaskPage'
import TopicListPage from './pages/TopicListPage'
import TopicDetailPage from './pages/TopicDetailPage'
import ExamHistoryPage from './pages/ExamHistoryPage'
import LearningRecordsPage from './pages/LearningRecordsPage'
import NoticesPage from './pages/NoticesPage'
import WritingDraftsPage from './pages/WritingDraftsPage'

export default function App() {
  return (
    <BrowserRouter basename="/portal">
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/qa" element={<QAPage />} />
        <Route path="/learning" element={<LearningPage />} />
        <Route path="/topics" element={<TopicListPage />} />
        <Route path="/topics/:topicId" element={<TopicDetailPage />} />
        <Route path="/test" element={<SelfTestPage />} />
        <Route path="/writing" element={<WritingPage />} />
        <Route path="/writing-drafts" element={<WritingDraftsPage />} />
        <Route path="/writing/:type" element={<WritingEditor />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/bind" element={<BindPage />} />
        <Route path="/tasks" element={<TaskPage />} />
        <Route path="/exam-history" element={<ExamHistoryPage />} />
        <Route path="/learning-records" element={<LearningRecordsPage />} />
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
