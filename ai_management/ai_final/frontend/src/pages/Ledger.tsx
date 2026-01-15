import { useState, useEffect } from 'react';
import { apiGet, apiDelete } from '../lib/api';

interface Scan {
    id: string;
    batch_no?: string;
    product_name?: string;
    mfg_date?: string;
    expiry_date?: string;
    flavour?: string;
    rack_no?: string;
    shelf_no?: string;
    direction: string;
    scanned_at: string;
}

export default function Ledger() {
    const [scans, setScans] = useState<Scan[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [sortOrder, setSortOrder] = useState('newest');

    useEffect(() => {
        fetchScans();
    }, []);

    async function fetchScans() {
        setLoading(true);
        try {
            const data = await apiGet<Scan[]>('/api/v1/scans');
            setScans(data);
        } catch (err) {
            console.error('Failed to fetch scans:', err);
        } finally {
            setLoading(false);
        }
    }

    function isExpired(expiryDate?: string): boolean {
        if (!expiryDate) return false;
        return new Date(expiryDate) < new Date();
    }

    function exportCSV() {
        if (scans.length === 0) return;

        const headers = ['Batch No', 'Flavour', 'MFG Date', 'Expiry Date', 'Rack', 'Shelf', 'Movement', 'Scanned At'];
        const rows = scans.map(s => [
            s.batch_no || '',
            s.flavour || '',
            s.mfg_date || '',
            s.expiry_date || '',
            s.rack_no || '',
            s.shelf_no || '',
            s.direction,
            s.scanned_at
        ]);

        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ledger_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    async function handleDelete(id: string) {
        try {
            await apiDelete(`/api/v1/scans/${id}`);
            fetchScans();
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    // Filter and sort
    let filteredScans = scans.filter(s => {
        const matchesSearch =
            (s.batch_no?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (s.flavour?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
            (s.rack_no?.toLowerCase() || '').includes(searchQuery.toLowerCase());

        if (statusFilter === 'active') return matchesSearch && !isExpired(s.expiry_date);
        if (statusFilter === 'expired') return matchesSearch && isExpired(s.expiry_date);
        return matchesSearch;
    });

    if (sortOrder === 'oldest') {
        filteredScans = [...filteredScans].reverse();
    }

    // Stats
    const totalEntries = scans.length;
    const inMovements = scans.filter(s => s.direction === 'IN').length;
    const outMovements = scans.filter(s => s.direction === 'OUT').length;
    const uniqueBatches = new Set(scans.map(s => s.batch_no)).size;

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title"> Ledger Entries</h1>
                    <p className="page-subtitle">Enterprise matrix view of all scanned entries</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={exportCSV}>
                        Export CSV
                    </button>
                    <button className="btn btn-primary" onClick={fetchScans}>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-4 mb-4">
                <div className="stat-card stat-card-accent blue">
                    <div className="stat-icon blue"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Entries</div>
                        <div className="stat-value">{totalEntries}</div>
                    </div>
                </div>

                <div className="stat-card stat-card-accent green">
                    <div className="stat-icon green"></div>
                    <div className="stat-content">
                        <div className="stat-label">IN Movements</div>
                        <div className="stat-value">{inMovements}</div>
                    </div>
                </div>

                <div className="stat-card stat-card-accent red">
                    <div className="stat-icon red"></div>
                    <div className="stat-content">
                        <div className="stat-label">OUT Movements</div>
                        <div className="stat-value">{outMovements}</div>
                    </div>
                </div>

                <div className="stat-card stat-card-accent yellow">
                    <div className="stat-icon yellow"></div>
                    <div className="stat-content">
                        <div className="stat-label">Unique Batches</div>
                        <div className="stat-value">{uniqueBatches}</div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="filter-bar">
                <div className="search-container">
                    <input
                        type="text"
                        className="input"
                        style={{ paddingLeft: 40 }}
                        placeholder=" Search batch, flavour, rack..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <select
                    className="input filter-select"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                </select>
                <select
                    className="input filter-select"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                </select>
            </div>

            {/* Matrix View */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"> Matrix View</h3>
                </div>

                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>Loading entries...</p>
                    </div>
                ) : filteredScans.length === 0 ? (
                    <div className="empty-state">

                        <p>No records found</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Batch No</th>
                                    <th>Flavour</th>
                                    <th>MFG Date</th>
                                    <th>Expiry</th>
                                    <th>Location</th>
                                    <th>Movement</th>
                                    <th>Status</th>
                                    <th>Scanned</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredScans.map(scan => (
                                    <tr key={scan.id}>
                                        <td><strong>{scan.batch_no || '-'}</strong></td>
                                        <td>{scan.flavour || '-'}</td>
                                        <td>{scan.mfg_date || '-'}</td>
                                        <td>{scan.expiry_date || '-'}</td>
                                        <td>{scan.rack_no && scan.shelf_no ? `${scan.rack_no}/${scan.shelf_no}` : '-'}</td>
                                        <td>
                                            <span className={`badge ${scan.direction === 'IN' ? 'badge-in' : 'badge-out'}`}>
                                                {scan.direction}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={`badge ${isExpired(scan.expiry_date) ? 'badge-expired' : 'badge-active'}`}>
                                                {isExpired(scan.expiry_date) ? 'Expired' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="text-secondary text-sm">
                                            {new Date(scan.scanned_at).toLocaleString('en-IN')}
                                        </td>
                                        <td>
                                            <button
                                                className="btn-link-danger"
                                                onClick={() => handleDelete(scan.id)}
                                            >
                                                Delete
                                            </button>
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
