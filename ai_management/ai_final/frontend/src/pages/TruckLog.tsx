import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../lib/api';

interface TruckEntry {
    id: string;
    plate_number: string;
    direction: string;
    confidence: number;
    detected_at: string;
}

export default function TruckLog() {
    const [entries, setEntries] = useState<TruckEntry[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTrucks();
    }, []);

    async function fetchTrucks() {
        try {
            const data = await apiGet<TruckEntry[]>('/api/v1/trucks');
            setEntries(data);
        } catch (err) {
            console.error('Failed to fetch trucks:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleReset() {
        try {
            await apiPost('/api/v1/trucks/reset');
            fetchTrucks();
        } catch (err) {
            console.error('Failed to reset:', err);
        }
    }

    const inCount = entries.filter(e => e.direction === 'IN').length;
    const outCount = entries.filter(e => e.direction === 'OUT').length;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title"> Truck Log</h1>
                    <p className="page-subtitle">Entry and exit tracking with license plate OCR</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={handleReset}>
                        Reset
                    </button>
                    <button className="btn btn-primary" onClick={fetchTrucks}>
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-3" style={{ marginBottom: 24 }}>
                <div className="stat-card">
                    <div className="stat-icon blue"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Trucks</div>
                        <div className="stat-value">{entries.length}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"></div>
                    <div className="stat-content">
                        <div className="stat-label">Entries (IN)</div>
                        <div className="stat-value">{inCount}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow"></div>
                    <div className="stat-content">
                        <div className="stat-label">Exits (OUT)</div>
                        <div className="stat-value">{outCount}</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"> Entry Log</h3>
                </div>
                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">

                        <p>No truck entries recorded</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>License Plate</th>
                                    <th>Direction</th>
                                    <th>Confidence</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td>
                                            <span className="license-plate">{entry.plate_number}</span>
                                        </td>
                                        <td>
                                            <span className={`badge ${entry.direction === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                                {entry.direction === 'IN' ? '↓ IN' : '↑ OUT'}
                                            </span>
                                        </td>
                                        <td>{(entry.confidence * 100).toFixed(1)}%</td>
                                        <td className="text-secondary text-sm">
                                            {new Date(entry.detected_at).toLocaleString()}
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
