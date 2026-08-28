import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { TraceProvider } from './context/TraceContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import ScanSearch from './pages/ScanSearch'
import MainBatch from './pages/MainBatch'
import SubBatchDetail from './pages/SubBatchDetail'
import LogProcessStep from './pages/LogProcessStep'
import LogQC from './pages/LogQC'
import FinishedLots from './pages/FinishedLots'
import FinishedLotDetail from './pages/FinishedLotDetail'
import UnitDetail from './pages/UnitDetail'
import Recall from './pages/Recall'
import Reports from './pages/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <TraceProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="scan" element={<ScanSearch />} />
            <Route path="main-batch" element={<MainBatch />} />
            <Route path="sub-batch/:id" element={<SubBatchDetail />} />
            <Route path="log-process" element={<LogProcessStep />} />
            <Route path="log-qc" element={<LogQC />} />
            <Route path="finished-lots" element={<FinishedLots />} />
            <Route path="finished-lot/:id" element={<FinishedLotDetail />} />
            <Route path="unit/:serial" element={<UnitDetail />} />
            <Route path="recall" element={<Recall />} />
            <Route path="reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </TraceProvider>
    </BrowserRouter>
  )
}
