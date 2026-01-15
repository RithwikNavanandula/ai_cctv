import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import LiveDetection from './pages/LiveDetection';
import TruckLog from './pages/TruckLog';
import Cameras from './pages/Cameras';
import Inventory from './pages/Inventory';
import LabelScanner from './pages/LabelScanner';
import Ledger from './pages/Ledger';
import Tracker from './pages/Tracker';
import Faces from './pages/Faces';
import Analytics from './pages/Analytics';
import Compression from './pages/Compression';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Mock auth check (can be improved)
const isAuthenticated = () => !!localStorage.getItem('token');

function App() {
    return (
        <Router basename="/ai_cctv">
            <Routes>
                <Route path="/login" element={<Login />} />

                <Route element={<Layout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/live" element={<LiveDetection />} />
                    <Route path="/trucks" element={<TruckLog />} />
                    <Route path="/cameras" element={<Cameras />} />
                    <Route path="/inventory" element={<Inventory />} />
                    <Route path="/scanner" element={<LabelScanner />} />
                    <Route path="/ledger" element={<Ledger />} />
                    <Route path="/tracker" element={<Tracker />} />
                    <Route path="/faces" element={<Faces />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/compression" element={<Compression />} />
                    <Route path="/settings" element={<Settings />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;
