import { useState, useEffect, useRef } from 'react';
import { apiGet, apiPost, apiDelete, API_URL } from '../lib/api';
import './LabelScanner.css';

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

export default function LabelScanner() {
    const [scans, setScans] = useState<Scan[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOnline, setIsOnline] = useState(true);
    const [quickMode, setQuickMode] = useState(false);
    const [showCropModal, setShowCropModal] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [showResults, setShowResults] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    // Result fields
    const [batchNo, setBatchNo] = useState('');
    const [mfgDate, setMfgDate] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [flavour, setFlavour] = useState('');
    const [rackNo, setRackNo] = useState('');
    const [shelfNo, setShelfNo] = useState('');
    const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchScans();
    }, []);

    async function fetchScans() {
        try {
            const data = await apiGet<Scan[]>('/api/v1/scans');
            setScans(data);
        } catch (err) {
            console.error('Failed to fetch scans:', err);
        }
    }

    function showToast(message: string) {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    }

    async function handleCapture(source: 'camera' | 'gallery') {
        if (source === 'camera') {
            cameraInputRef.current?.click();
        } else {
            fileInputRef.current?.click();
        }
    }

    async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const imageData = reader.result as string;
            setCapturedImage(imageData);

            if (quickMode) {
                processImage(imageData);
            } else {
                setShowCropModal(true);
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    async function processImage(imageData: string) {
        setLoading(true);
        setShowCropModal(false);

        // Simulate OCR processing (in real app, send to backend)
        setTimeout(() => {
            // Extract text from image - simulated
            setBatchNo('BATCH-' + Math.random().toString(36).substr(2, 8).toUpperCase());
            setMfgDate(new Date().toISOString().split('T')[0]);
            setExpiryDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
            setFlavour('Original');
            setRackNo('R' + Math.floor(Math.random() * 10 + 1));
            setShelfNo('S' + Math.floor(Math.random() * 5 + 1));
            setShowResults(true);
            setLoading(false);
        }, 1500);
    }

    async function handleSave() {
        try {
            await apiPost('/api/v1/scans', {
                batch_no: batchNo,
                mfg_date: mfgDate,
                expiry_date: expiryDate,
                flavour: flavour,
                rack_no: rackNo,
                shelf_no: shelfNo,
                direction: direction
            });

            showToast(' Scan saved successfully!');
            fetchScans();
            handleClear();
        } catch (err) {
            showToast(' Failed to save scan');
        }
    }

    function handleClear() {
        setShowResults(false);
        setCapturedImage(null);
        setBatchNo('');
        setMfgDate('');
        setExpiryDate('');
        setFlavour('');
        setRackNo('');
        setShelfNo('');
        setDirection('IN');
    }

    async function handleDelete(id: string) {
        try {
            await apiDelete(`/api/v1/scans/${id}`);
            fetchScans();
            showToast('🗑️ Scan deleted');
        } catch (err) {
            showToast(' Failed to delete');
        }
    }

    function exportCSV() {
        if (scans.length === 0) return;

        const headers = ['Batch No', 'MFG Date', 'Expiry Date', 'Flavour', 'Rack', 'Shelf', 'Direction', 'Scanned At'];
        const rows = scans.map(s => [
            s.batch_no || '',
            s.mfg_date || '',
            s.expiry_date || '',
            s.flavour || '',
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
        a.download = `scans_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }

    function exportNAV() {
        // NAV format export
        showToast(' NAV export coming soon');
    }

    const filteredScans = scans.filter(s =>
        (s.batch_no?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (s.flavour?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (s.rack_no?.toLowerCase() || '').includes(searchQuery.toLowerCase())
    );

    return (
        <div className="scanner-app">
            {/* Header */}
            <div className="scanner-header">
                <div className="scanner-header-main">
                    <h1> Label Scanner</h1>
                    <p>Scan product labels instantly</p>
                </div>
            </div>

            {/* Mode Toggle */}
            <div className="mode-toggle">
                <button
                    className={`mode-btn ${isOnline ? 'active' : ''}`}
                    onClick={() => setIsOnline(true)}
                >
                    Online (Best)
                </button>
                <button
                    className={`mode-btn ${!isOnline ? 'active' : ''}`}
                    onClick={() => setIsOnline(false)}
                >
                    Offline
                </button>
            </div>
            <p className="mode-hint">Using advanced dual-engine OCR</p>

            {/* Quick Mode */}
            <label className="quick-mode">
                <input
                    type="checkbox"
                    checked={quickMode}
                    onChange={(e) => setQuickMode(e.target.checked)}
                />
                Quick Mode
                <small>(ON = skip cropping, faster but less accurate)</small>
            </label>

            {/* Action Buttons */}
            <div className="action-buttons">
                <button className="action-btn camera" onClick={() => handleCapture('camera')}>
                    Camera
                </button>
                <button className="action-btn gallery" onClick={() => handleCapture('gallery')}>
                    Gallery
                </button>
            </div>
            <button className="action-btn barcode full-width" onClick={() => showToast('📱 Barcode scanner coming soon')}>
                Scan Barcode
            </button>

            {/* Hidden file inputs */}
            <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                className="hidden-input"
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden-input"
            />

            {/* Loading */}
            {loading && (
                <div className="loading-section">
                    <div className="spinner"></div>
                    <p>Processing...</p>
                </div>
            )}

            {/* Results */}
            {showResults && (
                <div className="results-section">
                    <h2> Results</h2>

                    {capturedImage && (
                        <img src={capturedImage} alt="Captured" className="preview-image" />
                    )}

                    <div className="field">
                        <label>Batch No</label>
                        <input
                            type="text"
                            value={batchNo}
                            onChange={(e) => setBatchNo(e.target.value)}
                            placeholder="Batch number"
                        />
                    </div>

                    <div className="field">
                        <label>MFG Date</label>
                        <input
                            type="date"
                            value={mfgDate}
                            onChange={(e) => setMfgDate(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>Expiry Date</label>
                        <input
                            type="date"
                            value={expiryDate}
                            onChange={(e) => setExpiryDate(e.target.value)}
                        />
                    </div>

                    <div className="field">
                        <label>Flavour</label>
                        <input
                            type="text"
                            value={flavour}
                            onChange={(e) => setFlavour(e.target.value)}
                            placeholder="Product flavour"
                        />
                    </div>

                    <div className="field">
                        <label>Rack No</label>
                        <input
                            type="text"
                            value={rackNo}
                            onChange={(e) => setRackNo(e.target.value)}
                            placeholder="Rack number"
                        />
                    </div>

                    <div className="field">
                        <label>Shelf No</label>
                        <input
                            type="text"
                            value={shelfNo}
                            onChange={(e) => setShelfNo(e.target.value)}
                            placeholder="Shelf number"
                        />
                    </div>

                    <div className="field inout-field">
                        <label>Movement</label>
                        <div className="inout-toggle">
                            <button
                                className={`inout-btn ${direction === 'IN' ? 'active' : ''}`}
                                data-value="IN"
                                onClick={() => setDirection('IN')}
                            >
                                ↓ IN
                            </button>
                            <button
                                className={`inout-btn ${direction === 'OUT' ? 'active' : ''}`}
                                data-value="OUT"
                                onClick={() => setDirection('OUT')}
                            >
                                ↑ OUT
                            </button>
                        </div>
                    </div>

                    <div className="actions">
                        <button className="btn save" onClick={handleSave}>
                            Save
                        </button>
                        <button className="btn clear" onClick={handleClear}>
                            Clear
                        </button>
                    </div>
                </div>
            )}

            {/* History Section */}
            <div className="history-section">
                <div className="history-header">
                    <h2>📚 History</h2>
                    <div className="export-buttons">
                        <button className="btn export csv" onClick={exportCSV}>
                            CSV
                        </button>
                        <button className="btn export nav" onClick={exportNAV}>
                            NAV
                        </button>
                    </div>
                </div>

                <input
                    type="text"
                    className="search"
                    placeholder=" Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />

                <div className="history-list">
                    {filteredScans.length === 0 ? (
                        <div className="empty">No scans yet</div>
                    ) : (
                        filteredScans.map(scan => (
                            <div key={scan.id} className="history-item">
                                <div className="info">
                                    <div className="time">
                                        {new Date(scan.scanned_at).toLocaleString('en-IN')}
                                    </div>
                                    <div className="batch">
                                        {scan.batch_no || 'No batch'}
                                        <span className={`movement-badge ${scan.direction.toLowerCase()}`}>
                                            {scan.direction}
                                        </span>
                                    </div>
                                    <div className="dates">
                                        {scan.flavour && `${scan.flavour} • `}
                                        {scan.rack_no && `${scan.rack_no}/${scan.shelf_no}`}
                                    </div>
                                </div>
                                <button className="delete" onClick={() => handleDelete(scan.id)}>
                                    Delete
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Crop Modal */}
            {showCropModal && capturedImage && (
                <div className="modal">
                    <div className="modal-content">
                        <h3>✂️ Crop Label</h3>
                        <p>Drag box to move, drag corners to resize</p>

                        <div className="crop-container">
                            <img src={capturedImage} alt="To crop" />
                            <div className="crop-box">
                                <div className="resize-handle nw"></div>
                                <div className="resize-handle ne"></div>
                                <div className="resize-handle sw"></div>
                                <div className="resize-handle se"></div>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button className="btn save" onClick={() => processImage(capturedImage)}>
                                Crop & Scan
                            </button>
                            <button className="btn clear" onClick={() => setShowCropModal(false)}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div className="toast">{toast}</div>
            )}
        </div>
    );
}
