import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TeacherLayout from './layouts/TeacherLayout'
import AIAssistant from './pages/teacher/AIAssistant'
import Dashboard from './pages/teacher/Dashboard'
import GenericTabPage from './pages/teacher/GenericTabPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<TeacherLayout />}>
          <Route index element={<Navigate to="/ai" replace />} />
          <Route path="ai" element={<AIAssistant />} />

          {/* Tab 2: Dashboard */}
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="dashboard/:sub" element={<Dashboard />} />

          {/* Tab 3-10: Generic tabs with sidebar */}
          <Route path="party" element={<GenericTabPage />} />
          <Route path="party/:sub" element={<GenericTabPage />} />

          <Route path="learning" element={<GenericTabPage />} />
          <Route path="learning/:sub" element={<GenericTabPage />} />

          <Route path="promotion" element={<GenericTabPage />} />
          <Route path="promotion/:sub" element={<GenericTabPage />} />

          <Route path="activity" element={<GenericTabPage />} />
          <Route path="activity/:sub" element={<GenericTabPage />} />

          <Route path="service" element={<GenericTabPage />} />
          <Route path="service/:sub" element={<GenericTabPage />} />

          <Route path="supervision" element={<GenericTabPage />} />
          <Route path="supervision/:sub" element={<GenericTabPage />} />

          <Route path="office" element={<GenericTabPage />} />
          <Route path="office/:sub" element={<GenericTabPage />} />

          <Route path="system" element={<GenericTabPage />} />
          <Route path="system/:sub" element={<GenericTabPage />} />

          <Route path="*" element={<Navigate to="/ai" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
