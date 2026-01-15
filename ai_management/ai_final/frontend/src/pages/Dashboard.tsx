import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonStats, SkeletonTable } from '../components/ui/Skeleton';
import {
    Package,
    ArrowDownCircle,
    ArrowUpCircle,
    Activity,
    Camera,
    AlertCircle,
    LayoutDashboard
} from 'lucide-react';

interface DashboardData {
    total_in: number;
    total_out: number;
    total_stock: number;
    detections_today: number;
    camera_active: boolean;
    inventory: Array<{
        product_name: string;
        count_in: number;
        count_out: number;
        current_stock: number;
    }>;
    models_loaded: {
        main: boolean;
        sugar: boolean;
    };
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchDashboard();
        const interval = setInterval(fetchDashboard, 5000);
        return () => clearInterval(interval);
    }, []);

    async function fetchDashboard() {
        try {
            const result = await apiGet<DashboardData>('/api/v1/analytics/dashboard');
            setData(result);
            setError(null);
        } catch (err) {
            setError('Failed to load dashboard');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    if (loading) {
        return (
            <div>
                <PageHeader
                    title="Dashboard"
                    subtitle="Real-time inventory monitoring and analytics"
                />
                <SkeletonStats />
                <div className="grid grid-2">
                    <SkeletonTable rows={4} />
                    <SkeletonTable rows={3} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Dashboard"
                subtitle="Real-time inventory monitoring and analytics"
            />

            {error && (
                <div className="error-banner">

                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-4" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon blue">

                    </div>
                    <div className="stat-content">
                        <div className="stat-label">Total Stock</div>
                        <div className="stat-value">{data?.total_stock || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon green">

                    </div>
                    <div className="stat-content">
                        <div className="stat-label">Total IN</div>
                        <div className="stat-value">{data?.total_in || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon yellow">

                    </div>
                    <div className="stat-content">
                        <div className="stat-label">Total OUT</div>
                        <div className="stat-value">{data?.total_out || 0}</div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="stat-icon purple">

                    </div>
                    <div className="stat-content">
                        <div className="stat-label">Detections Today</div>
                        <div className="stat-value">{data?.detections_today || 0}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Inventory Breakdown</h3>
                    </div>
                    {data?.inventory?.length === 0 ? (
                        <div className="empty-state">

                            <p>No inventory data</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th>IN</th>
                                        <th>OUT</th>
                                        <th>Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data?.inventory?.map((item, idx) => (
                                        <tr key={idx}>
                                            <td>{item.product_name}</td>
                                            <td className="text-success">+{item.count_in}</td>
                                            <td className="text-warning">-{item.count_out}</td>
                                            <td><strong>{item.current_stock}</strong></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> System Status</h3>
                    </div>
                    <div className="status-list">
                        <div className="status-row">
                            <span> Camera</span>
                            <span className={`badge ${data?.camera_active ? 'badge-online' : 'badge-offline'}`}>
                                {data?.camera_active ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="status-row">
                            <span> Main Model</span>
                            <span className={`badge ${data?.models_loaded?.main ? 'badge-online' : 'badge-offline'}`}>
                                {data?.models_loaded?.main ? 'Loaded' : 'Not Loaded'}
                            </span>
                        </div>
                        <div className="status-row">
                            <span> Sugar Model</span>
                            <span className={`badge ${data?.models_loaded?.sugar ? 'badge-online' : 'badge-offline'}`}>
                                {data?.models_loaded?.sugar ? 'Loaded' : 'Not Loaded'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

