import { useState, useEffect } from 'react';
import { apiGet, apiPost } from '../lib/api';

interface TrackedPerson {
    person_id: string;
    name: string;
    last_camera: string;
    last_seen: string;
    total_appearances: number;
    is_known: boolean;
}

interface TrackEvent {
    id: string;
    camera_id: string;
    camera_name: string;
    action: string;
    timestamp: string;
}

export default function Tracker() {
    const [persons, setPersons] = useState<TrackedPerson[]>([]);
    const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<TrackEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [timelineLoading, setTimelineLoading] = useState(false);

    useEffect(() => {
        fetchPersons();
    }, []);

    async function fetchPersons() {
        setLoading(true);
        try {
            const data = await apiGet<TrackedPerson[]>('/api/v1/tracker/persons');
            setPersons(data);
        } catch (err) {
            console.error('Failed to fetch persons:', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchTimeline(personId: string) {
        setTimelineLoading(true);
        setSelectedPerson(personId);
        try {
            const data = await apiGet<TrackEvent[]>(`/api/v1/tracker/timeline/${personId}`);
            setTimeline(data);
        } catch (err) {
            console.error('Failed to fetch timeline:', err);
            setTimeline([]);
        } finally {
            setTimelineLoading(false);
        }
    }

    const selectedPersonData = persons.find(p => p.person_id === selectedPerson);

    return (
        <div>
            <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h1 className="page-title"> Person Tracker</h1>
                    <p className="page-subtitle">Track person movements across cameras</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchPersons}>
                    Refresh
                </button>
            </div>

            <div className="grid grid-2">
                {/* Tracked Persons List */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Tracked Persons ({persons.length})</h3>
                    </div>
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : persons.length === 0 ? (
                        <div className="empty-state">

                            <p>No persons tracked yet</p>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text2)', marginTop: 8 }}>
                                Face detections will appear here
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {persons.map(person => (
                                <div
                                    key={person.person_id}
                                    onClick={() => fetchTimeline(person.person_id)}
                                    className={`person-card ${selectedPerson === person.person_id ? 'selected' : ''}`}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div className={`person-avatar ${person.is_known ? 'known' : 'unknown'}`}>
                                            {person.is_known ? person.name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <div>
                                            <strong>{person.name}</strong>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
                                                Last: {person.last_camera || 'Unknown camera'}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span className="badge badge-warning" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                            {person.total_appearances} sightings
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Timeline */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            Movement Timeline
                            {selectedPersonData && ` - ${selectedPersonData.name}`}
                        </h3>
                    </div>
                    {!selectedPerson ? (
                        <div className="empty-state">

                            <p>Select a person to view timeline</p>
                        </div>
                    ) : timelineLoading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : timeline.length === 0 ? (
                        <div className="empty-state">

                            <p style={{ fontSize: '0.9rem' }}>No movement data available</p>
                        </div>
                    ) : (
                        <div className="timeline">
                            {/* Timeline line */}
                            <div className="timeline-line" />

                            {timeline.map((event, idx) => (
                                <div key={event.id} className="timeline-event">
                                    {/* Timeline dot */}
                                    <div className={`timeline-dot ${event.action === 'entered' ? 'entered' :
                                        event.action === 'exited' ? 'exited' : 'default'
                                        }`} />

                                    <div className="timeline-content">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <strong style={{ fontSize: '0.9rem' }}>{event.camera_name}</strong>
                                            </div>
                                            <span className={`event-badge ${event.action === 'entered' ? 'entered' :
                                                event.action === 'exited' ? 'exited' : 'default'
                                                }`}>
                                                {event.action}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: 4 }}>
                                            {new Date(event.timestamp).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
