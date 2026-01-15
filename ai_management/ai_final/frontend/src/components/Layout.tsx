import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { clearToken } from '../lib/api';

interface LayoutProps {
    userName?: string;
    userRole?: string;
}

export default function Layout({ userName = 'Demo Admin', userRole = 'admin' }: LayoutProps) {
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const handleLogout = () => {
        clearToken();
        navigate('/login');
    };

    const closeSidebar = () => setSidebarOpen(false);

    const navItems = [
        {
            section: 'Main', items: [
                { to: '/', label: 'Dashboard' },
                { to: '/live', label: 'Live Detection' },
                { to: '/trucks', label: 'Truck Log' },
            ]
        },
        {
            section: 'Inventory', items: [
                { to: '/cameras', label: 'RTSP Cameras' },
                { to: '/inventory', label: 'Inventory' },
                { to: '/scanner', label: 'Label Scanner' },
                { to: '/ledger', label: 'Ledger Entries' },
            ]
        },
        {
            section: 'People', items: [
                { to: '/tracker', label: 'Person Tracker' },
                { to: '/faces', label: 'Face Recognition' },
            ]
        },
        {
            section: 'Tools', items: [
                { to: '/analytics', label: 'Analytics' },
                { to: '/compression', label: 'Compression' },
                { to: '/settings', label: 'Settings' },
            ]
        },
    ];

    return (
        <div className="app-layout">
            {/* Mobile Menu Button */}
            <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)}>
                ☰
            </button>

            {/* Overlay */}
            <div
                className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={closeSidebar}
            />

            <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Link to="/" className="sidebar-logo">
                        <span>AI CCTV</span>
                    </Link>
                    <button
                        className="mobile-close-btn"
                        onClick={closeSidebar}
                        style={{
                            display: 'none',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                        }}
                    >
                        ✕
                    </button>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((section) => (
                        <div key={section.section} className="nav-section">
                            <div className="nav-section-title">{section.section}</div>
                            {section.items.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                    onClick={closeSidebar}
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </div>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-info">
                        <div className="user-avatar">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-details">
                            <div className="user-name">{userName}</div>
                            <div className="user-role">{userRole}</div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={handleLogout}>
                        Logout
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
