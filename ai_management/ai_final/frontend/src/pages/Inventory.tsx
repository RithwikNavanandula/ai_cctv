import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';

interface InventoryItem {
    id: string;
    product_name: string;
    count_in: number;
    count_out: number;
    current_stock: number;
    last_updated: string;
}

export default function Inventory() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchInventory();
    }, []);

    async function fetchInventory() {
        try {
            const data = await apiGet<InventoryItem[]>('/api/v1/inventory');
            setItems(data);
        } catch (err) {
            console.error('Failed to fetch inventory:', err);
        } finally {
            setLoading(false);
        }
    }

    const totalIn = items.reduce((sum, i) => sum + i.count_in, 0);
    const totalOut = items.reduce((sum, i) => sum + i.count_out, 0);
    const totalStock = items.reduce((sum, i) => sum + i.current_stock, 0);

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title"> Inventory</h1>
                    <p className="page-subtitle">Track incoming and outgoing items</p>
                </div>
                <button className="btn btn-primary" onClick={fetchInventory}>
                    Refresh
                </button>
            </div>

            <div className="grid grid-3 mb-4">
                <div className="stat-card">
                    <div className="stat-icon blue"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total Stock</div>
                        <div className="stat-value">{totalStock}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon green"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total IN</div>
                        <div className="stat-value">{totalIn}</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon yellow"></div>
                    <div className="stat-content">
                        <div className="stat-label">Total OUT</div>
                        <div className="stat-value">{totalOut}</div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"> Inventory List</h3>
                </div>
                {loading ? (
                    <div className="loading"><div className="spinner"></div></div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Product</th>
                                    <th>IN</th>
                                    <th>OUT</th>
                                    <th>Current Stock</th>
                                    <th>Last Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td><strong>{item.product_name}</strong></td>
                                        <td className="text-success">+{item.count_in}</td>
                                        <td className="text-warning">-{item.count_out}</td>
                                        <td><strong>{item.current_stock}</strong></td>
                                        <td className="text-secondary text-sm">
                                            {item.last_updated ? new Date(item.last_updated).toLocaleString() : '-'}
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
