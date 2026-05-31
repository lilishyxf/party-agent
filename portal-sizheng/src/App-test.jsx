import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Button } from 'antd'

function Test() {
  return <div style={{padding:100}}><h1>Hello Teacher Portal</h1><Button type="primary">Test</Button></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<Test />} />
      </Routes>
    </BrowserRouter>
  )
}
