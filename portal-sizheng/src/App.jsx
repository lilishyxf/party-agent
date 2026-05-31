import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './services/AuthContext'
import TeacherLayout from './layouts/TeacherLayout'
import LoginPage from './pages/teacher/LoginPage'
import AIAssistant from './pages/teacher/AIAssistant'
import MembersPage from './pages/teacher/MembersPage'
import OrgStructurePage from './pages/teacher/OrgStructurePage'
import DevelopmentPage from './pages/teacher/DevelopmentPage'
import ThreeOne from './pages/teacher/ThreeOne'
import ThemeActivity from './pages/teacher/ThemeActivity'
import OrgLifeMeeting from './pages/teacher/OrgLifeMeeting'
import DemocraticEval from './pages/teacher/DemocraticEval'
import LearningMaterials from './pages/teacher/LearningMaterials'
import Questions from './pages/teacher/Questions'
import Exams from './pages/teacher/Exams'
import SpecialTopics from './pages/teacher/SpecialTopics'
import LearningRecords from './pages/teacher/LearningRecords'
import NoticeBoard from './pages/teacher/NoticeBoard'
import DocumentFlow from './pages/teacher/DocumentFlow'
import DuesPage from './pages/teacher/DuesPage'
import TaskPage from './pages/teacher/TaskPage'
import DashboardPage from './pages/teacher/DashboardPage'
import UsersPage from './pages/teacher/UsersPage'
import RolesPage from './pages/teacher/RolesPage'
import LogsPage from './pages/teacher/LogsPage'
import ConfigPage from './pages/teacher/ConfigPage'
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
import SpecialBrandPage from './pages/teacher/SpecialBrandPage'
import BranchShowcasePage from './pages/teacher/BranchShowcasePage'
import SpecialActivityPage from './pages/teacher/SpecialActivityPage'

function AuthGuard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', justifyContent:'center', alignItems:'center', minHeight:'80vh' }}>加载中...</div>
  if (!user) return <Navigate to="/login" replace />
  return children
}

function Placeholder() {
  return (
    <div style={{ textAlign: 'center', padding: 100 }}>
      <h2 style={{ color: '#333' }}>智慧党建 · 思政工作平台</h2>
      <p style={{ color: '#999', marginTop: 12 }}>该模块内容待完善</p>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename="/sizheng">
        <Routes>
          <Route path="login" element={<LoginPage />} />

          <Route element={<AuthGuard><TeacherLayout /></AuthGuard>}>
            <Route index element={<Navigate to="/ai" replace />} />
            <Route path="ai" element={<AIAssistant />} />

            {/* 组织架构 */}
            <Route path="org" element={<Navigate to="/org/structure" replace />} />
            <Route path="org/structure" element={<OrgStructurePage />} />
            <Route path="org/groups" element={<PartyGroupPage />} />
            <Route path="org/duty" element={<DutyPage />} />
            <Route path="org/:sub" element={<Placeholder />} />

            {/* 党员管理 */}
            <Route path="members" element={<Navigate to="/members/roster" replace />} />
            <Route path="members/roster" element={<MembersPage />} />
            <Route path="members/info" element={<MembersPage />} />
            <Route path="members/transfer" element={<PartyTransferPage />} />
            <Route path="members/floating" element={<FloatingMemberPage />} />
            <Route path="members/:sub" element={<Placeholder />} />

            {/* 组织生活 */}
            <Route path="org-life" element={<Navigate to="/org-life/three-one" replace />} />
            <Route path="org-life/three-one" element={<ThreeOne />} />
            <Route path="org-life/theme-activity" element={<ThemeActivity />} />
            <Route path="org-life/life-meeting" element={<OrgLifeMeeting />} />
            <Route path="org-life/democratic" element={<DemocraticEval />} />
            <Route path="org-life/:sub" element={<Placeholder />} />

            {/* 学习教育 */}
            <Route path="learning" element={<Navigate to="/learning/materials" replace />} />
            <Route path="learning/materials" element={<LearningMaterials />} />
            <Route path="learning/exams" element={<Exams />} />
            <Route path="learning/records" element={<LearningRecords />} />
            <Route path="learning/lessons" element={<SpecialTopics />} />
            <Route path="learning/questions" element={<Questions />} />
            <Route path="learning/:sub" element={<Placeholder />} />

            {/* 公文文件 */}
            <Route path="documents" element={<Navigate to="/documents/notices" replace />} />
            <Route path="documents/notices" element={<NoticeBoard />} />
            <Route path="documents/inout" element={<DocumentFlow />} />
            <Route path="documents/rules" element={<RegulationPage />} />
            <Route path="documents/archive" element={<ArchivePage />} />
            <Route path="documents/:sub" element={<Placeholder />} />

            {/* 党费管理 */}
            <Route path="dues" element={<Navigate to="/dues/collect" replace />} />
            <Route path="dues/collect" element={<DuesPage />} />
            <Route path="dues/receipt" element={<DuesReceiptPage />} />
            <Route path="dues/public" element={<DuesPublicPage />} />
            <Route path="dues/:sub" element={<Placeholder />} />

            {/* 发展党员 */}
            <Route path="development" element={<Navigate to="/development/applicant" replace />} />
            <Route path="development/applicant" element={<DevelopmentPage />} />
            <Route path="development/activist" element={<DevelopmentPage />} />
            <Route path="development/candidate" element={<DevelopmentPage />} />
            <Route path="development/probationary" element={<DevelopmentPage />} />
            <Route path="development/:sub" element={<Placeholder />} />

            {/* 任务考核 */}
            <Route path="tasks" element={<Navigate to="/tasks/assign" replace />} />
            <Route path="tasks/assign" element={<TaskPage />} />
            <Route path="tasks/progress" element={<TaskProgressPage />} />
            <Route path="tasks/assess" element={<AssessmentIndicatorPage />} />
            <Route path="tasks/evaluate" element={<PeerEvaluationPage />} />
            <Route path="tasks/:sub" element={<Placeholder />} />

            {/* 特色党建 */}
            <Route path="special" element={<Navigate to="/special/brands" replace />} />
            <Route path="special/brands" element={<SpecialBrandPage />} />
            <Route path="special/showcase" element={<BranchShowcasePage />} />
            <Route path="special/activities" element={<SpecialActivityPage />} />
            <Route path="special/:sub" element={<Placeholder />} />

            {/* 数据统计 */}
            <Route path="stats" element={<DashboardPage />} />
            <Route path="stats/structure-stats" element={<DashboardPage />} />
            <Route path="stats/participation" element={<DashboardPage />} />
            <Route path="stats/dues-rate" element={<DashboardPage />} />
            <Route path="stats/:sub" element={<Placeholder />} />

            {/* 系统管理 */}
            <Route path="system" element={<Navigate to="/system/users" replace />} />
            <Route path="system/users" element={<UsersPage />} />
            <Route path="system/roles" element={<RolesPage />} />
            <Route path="system/logs" element={<LogsPage />} />
            <Route path="system/config" element={<ConfigPage />} />
            <Route path="system/:sub" element={<Placeholder />} />

            <Route path="*" element={<Navigate to="/ai" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
