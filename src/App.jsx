import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import LandingPage from './pages/LandingPage'
import PredictionsPage from './pages/PredictionsPage'
import PaymentSuccess from './pages/PaymentSuccess'
import LeaderboardPage from './pages/LeaderboardPage'
import AdminPage from './pages/AdminPage'
import EngineTestPage from './pages/EngineTestPage'
import './index.css'

const IS_DEV = import.meta.env.DEV

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/"                   element={<LandingPage />} />
        <Route path="/wc"                 element={<LandingPage />} />
        <Route path="/wc/predictions"     element={<PredictionsPage />} />
        <Route path="/wc/payment-success" element={<PaymentSuccess />} />
        <Route path="/wc/leaderboard"     element={<LeaderboardPage />} />
        <Route path="/wc/admin"           element={<AdminPage />} />
        {IS_DEV && (
          <Route path="/wc/engine-test"   element={<EngineTestPage />} />
        )}
      </Routes>
    </BrowserRouter>
  )
}
