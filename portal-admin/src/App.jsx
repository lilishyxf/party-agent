import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/AuthContext'
import TeacherLayout from './layouts/TeacherLayout'
import LoginPage from './pages/teacher/LoginPage'
import LearningMaterials from './pages/teacher/LearningMaterials'
import Questions from './pages/teacher/Questions'
import Exams from './pages/teacher/Exams'
import SpecialTopics from './pages/teacher/SpecialTopics'
import LearningRecords from './pages/teacher/LearningRecords'
import LearningActivities from './pages/teacher/LearningActivities'
import Notes from './pages/teacher/Notes'
import Briefing from './pages/teacher/Briefing'
import AIAssistant from './pages/teacher/AIAssistant'
import PromotionArticles from './pages/teacher/PromotionArticles'
import PromotionImages from './pages/teacher/PromotionImages'
import PromotionVideos from './pages/teacher/PromotionVideos'
import PartyMeetings from './pages/teacher/PartyMeetings'
import ThreeOne from './pages/teacher/ThreeOne'
import ThemeActivity from './pages/teacher/ThemeActivity'
import OrgLifeMeeting from './pages/teacher/OrgLifeMeeting'
import DemocraticEval from './pages/teacher/DemocraticEval'
import NoticeBoard from './pages/teacher/NoticeBoard'
import WorkTodos from './pages/teacher/WorkTodos'
import DocumentFlow from './pages/teacher/DocumentFlow'
import ScheduleCalendar from './pages/teacher/ScheduleCalendar'
import MembersPage from './pages/teacher/MembersPage'
import OrgStructurePage from './pages/teacher/OrgStructurePage'
import DevelopmentPage from './pages/teacher/DevelopmentPage'
import CadrePage from './pages/teacher/CadrePage'
import ContactPage from './pages/teacher/ContactPage'
import PartyServicePage from './pages/teacher/PartyServicePage'
import DuesPage from './pages/teacher/DuesPage'
import AssistancePage from './pages/teacher/AssistancePage'
import VolunteerPage from './pages/teacher/VolunteerPage'
import UsersPage from './pages/teacher/UsersPage'
import LogsPage from './pages/teacher/LogsPage'
import ConfigPage from './pages/teacher/ConfigPage'
import DictPage from './pages/teacher/DictPage'
import RolesPage from './pages/teacher/RolesPage'
import DashboardPage from './pages/teacher/DashboardPage'
import DisciplineStudyPage from './pages/teacher/DisciplineStudyPage'
import WarningEduPage from './pages/teacher/WarningEduPage'
import InspectionPage from './pages/teacher/InspectionPage'
import ReportsPage from './pages/teacher/ReportsPage'
import TaskPage from './pages/teacher/TaskPage'
import FeaturedPage from './pages/teacher/FeaturedPage'
import PartyGroupPage from './pages/teacher/PartyGroupPage'
import DutyPage from './pages/teacher/DutyPage'
import PartyTransferPage from './pages/teacher/PartyTransferPage'
import FloatingMemberPage from './pages/teacher/FloatingMemberPage'
import RegulationPage from './pages/teacher/RegulationPage'
import ArchivePage from './pages/teacher/ArchivePage'
import DuesReceiptPage from './pages/teacher/DuesReceiptPage'
import DuesPublicPage from './pages/teacher/DuesPublicPage'
import TaskProgressPage from './pages/teacher/TaskProgressPage'
import AssessmentIndicatorPage from './pages/teacher/AssessmentIndicatorPage'
import PeerEvaluationPage from './pages/teacher/PeerEvaluationPage'

function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'80vh' }}>加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Placeholder() {
  return (
    <div style={{ textAlign: 'center', padding: 100 }}>
      <h2 style={{ color: '#333' }}>欢迎使用党务 AI 助手 · 教师工作台</h2>
      <p style={{ color: '#999', marginTop: 12 }}>请点击上方导航切换功能模块</p>
    </div>
  )
}


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/admin">
        <Routes>
          {/* 登录页 — 不需要布局 */}
          <Route path="login" element={<LoginPage />} />

          {/* 受鉴权保护的路由 — 包裹在 TeacherLayout */}
          <Route element={<AuthGuard><TeacherLayout /></AuthGuard>}>
            <Route index element={<Navigate to="/ai" replace />} />
            <Route path="ai" element={<AIAssistant />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="party" element={<Navigate to="/party/members" replace />} />
            <Route path="party/members" element={<MembersPage />} />
            <Route path="party/org-structure" element={<OrgStructurePage />} />
            <Route path="party/groups" element={<PartyGroupPage />} />
            <Route path="party/duty" element={<DutyPage />} />
            <Route path="party/transfer" element={<PartyTransferPage />} />
            <Route path="party/floating" element={<FloatingMemberPage />} />
            <Route path="party/development" element={<DevelopmentPage />} />
            <Route path="party/cadres" element={<CadrePage />} />
            <Route path="party/contact" element={<ContactPage />} />
            <Route path="party/:sub" element={<Placeholder />} />
            <Route path="learning" element={<Navigate to="/learning/materials" replace />} />
            <Route path="learning/materials" element={<LearningMaterials />} />
            <Route path="learning/questions" element={<Questions />} />
            <Route path="learning/exams" element={<Exams />} />
            <Route path="learning/lessons" element={<SpecialTopics />} />
            <Route path="learning/records" element={<LearningRecords />} />
            <Route path="learning/progress" element={<LearningActivities />} />
            <Route path="learning/notes" element={<Notes />} />
            <Route path="learning/briefing" element={<Briefing />} />
            <Route path="learning/tasks" element={<TaskPage />} />
            <Route path="learning/task-progress" element={<TaskProgressPage />} />
            <Route path="learning/indicators" element={<AssessmentIndicatorPage />} />
            <Route path="learning/evaluations" element={<PeerEvaluationPage />} />
            <Route path="learning/:sub" element={<Placeholder />} />
            <Route path="promotion" element={<PromotionArticles />} />
            <Route path="promotion/articles" element={<PromotionArticles />} />
            <Route path="promotion/images" element={<PromotionImages />} />
            <Route path="promotion/videos" element={<PromotionVideos />} />
            <Route path="activity" element={<PartyMeetings />} />
            <Route path="activity/meetings" element={<PartyMeetings />} />
            <Route path="activity/three-one" element={<ThreeOne />} />
            <Route path="activity/theme-activity" element={<ThemeActivity />} />
            <Route path="activity/life-meeting" element={<OrgLifeMeeting />} />
            <Route path="activity/democratic" element={<DemocraticEval />} />
            <Route path="activity/:sub" element={<Placeholder />} />
            <Route path="service" element={<PartyServicePage />} />
            <Route path="service/party-service" element={<PartyServicePage />} />
            <Route path="service/dues" element={<DuesPage />} />
            <Route path="service/assistance" element={<AssistancePage />} />
            <Route path="service/volunteer" element={<VolunteerPage />} />
            <Route path="service/receipt" element={<DuesReceiptPage />} />
            <Route path="service/dues-public" element={<DuesPublicPage />} />
            <Route path="service/:sub" element={<Placeholder />} />
            <Route path="supervision" element={<Navigate to="/supervision/discipline-study" replace />} />
            <Route path="supervision/discipline-study" element={<DisciplineStudyPage />} />
            <Route path="supervision/warning-edu" element={<WarningEduPage />} />
            <Route path="supervision/reports" element={<ReportsPage />} />
            <Route path="supervision/inspection" element={<InspectionPage />} />
            <Route path="supervision/:sub" element={<Placeholder />} />
            <Route path="featured" element={<Navigate to="/featured/overview" replace />} />
            <Route path="featured/overview" element={<FeaturedPage />} />
            <Route path="featured/:sub" element={<Placeholder />} />
            <Route path="office" element={<NoticeBoard />} />
            <Route path="office/notices" element={<NoticeBoard />} />
            <Route path="office/todos" element={<WorkTodos />} />
            <Route path="office/documents" element={<DocumentFlow />} />
            <Route path="office/schedule" element={<ScheduleCalendar />} />
            <Route path="office/regulations" element={<RegulationPage />} />
            <Route path="office/archive" element={<ArchivePage />} />
            <Route path="office/:sub" element={<Placeholder />} />
            <Route path="system" element={<Navigate to="/system/users" replace />} />
            <Route path="system/users" element={<UsersPage />} />
            <Route path="system/roles" element={<RolesPage />} />
            <Route path="system/logs" element={<LogsPage />} />
            <Route path="system/config" element={<ConfigPage />} />
            <Route path="system/dict" element={<DictPage />} />
            <Route path="system/:sub" element={<Placeholder />} />
            <Route path="*" element={<Navigate to="/ai" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
