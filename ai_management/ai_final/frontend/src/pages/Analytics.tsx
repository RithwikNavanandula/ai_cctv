import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { SkeletonStats, SkeletonTable } from '../components/ui/Skeleton';

interface Detection {
    id: string;
    type: string;
    confidence: number;
    direction: string;
    detected_at: string;
}

export default function Analytics() {
    const [detections, setDetections] = useState<Detection[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDetections();
    }, []);

    async function fetchDetections() {
        try {
            const data = await apiGet<Detection[]>('/api/v1/detections?limit=100');
            setDetections(data);
        } catch (err) {
            console.error('Failed to fetch detections:', err);
        } finally {
            setLoading(false);
        }
    }

    // Group by type
    const byType = detections.reduce((acc, d) => {
        acc[d.type] = (acc[d.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    // Group by direction
    const inCount = detections.filter(d => d.direction === 'IN').length;
    const outCount = detections.filter(d => d.direction === 'OUT').length;

    // Group by date
    const byDate = detections.reduce((acc, d) => {
        const date = new Date(d.detected_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    if (loading) {
        return (
            <div>
                <PageHeader
                    title="Analytics"
                    subtitle="Detection trends and insights"
                />
                <SkeletonStats />
                <div className="grid grid-2">
                    <SkeletonTable rows={5} />
                    <SkeletonTable rows={5} />
                </div>
            </div>
        );
    }

    return (
        <div>
            <PageHeader
                title="Analytics"
                subtitle="Detection trends and insights"
            />

            <div className="grid grid-4" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon purple"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Detections</div>
                        <div className="stat-value">{detections.length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"></div>
                    <div className="stat-content">
                        <div className="stat-label">IN Movements</div>
                        <div className="stat-value">{inCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow"></div>
                    <div className="stat-content">
                        <div className="stat-label">OUT Movements</div>
                        <div className="stat-value">{outCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon blue"></div>
                    <div className="stat-content">
                        <div className="stat-label">Object Types</div>
                        <div className="stat-value">{Object.keys(byType).length}</div>
                    </div>
                </div>
            </div>

            <div className="grid grid-2">
                {/* Detection by Type */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> By Object Type</h3>
                    </div>
                    {Object.keys(byType).length === 0 ? (
                        <div className="empty-state"><p>No data available</p></div>
                    ) : (
                        <div className="status-list">
                            {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                                <div key={type} className="status-row">
                                    <span>{type}</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, marginLeft: 16 }}>
                                        <div className="progress-bar-track" style={{ flex: 1 }}>
                                            <div
                                                className="progress-bar-fill"
                                                style={{ width: `${(count / detections.length) * 100}%` }}
                                            />
                                        </div>
                                        <strong style={{ width: 40, textAlign: 'right' }}>{count}</strong>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Detection by Date */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> By Date</h3>
                    </div>
                    {Object.keys(byDate).length === 0 ? (
                        <div className="empty-state"><p>No data available</p></div>
                    ) : (
                        <div className="status-list">
                            {Object.entries(byDate).slice(0, 7).map(([date, count]) => (
                                <div key={date} className="status-row date-row">
                                    <span className="text-muted">{date}</span>
                                    <strong>{count} detections</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Recent Detections */}
            <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header">
                    <h3 className="card-title"> Recent Detections</h3>
                </div>
                {detections.length === 0 ? (
                    <div className="empty-state"><p>No detections yet</p></div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Direction</th>
                                    <th>Confidence</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {detections.slice(0, 10).map(det => (
                                    <tr key={det.id}>
                                        <td>{det.type}</td>
                                        <td>
                                            <span className={`badge ${det.direction === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                                {det.direction}
                                            </span>
                                        </td>
                                        <td>{(det.confidence * 100).toFixed(1)}%</td>
                                        <td className="text-muted">
                                            {new Date(det.detected_at).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

