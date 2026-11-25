import { useEffect, useState } from 'react';
import { api, fmt } from './api';

const FILTERS = [['', 'All'], ['consents', 'Consents'], ['views', 'Record Views'], ['emergency', 'Emergency']];

export default function Admin({ session: { token }, logout }) {
  const [overview, setOverview] = useState(null);
  const [emergencyAudit, setEmergencyAudit] = useState([]);
  const [audit, setAudit] = useState([]);
  const [type, setType] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [nextOverview, nextAudit, nextEmergencyAudit] = await Promise.all([
        api('/admin/overview', { token }),
        api(`/admin/audit?type=${type}&q=${encodeURIComponent(query)}`, { token }),
        api('/admin/audit?type=emergency', { token })
      ]);
      setOverview(nextOverview); setAudit(nextAudit); setEmergencyAudit(nextEmergencyAudit); setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    load(); const interval = setInterval(load, 5000); return () => clearInterval(interval);
  }, [type, query]);

  const review = async (id, action) => {
    try {
      await api(`/admin/emergency/${id}/review`, { method: 'POST', token, body: { action } });
      await load();
    } catch (e) { setError(e.message); }
  };

  if (!overview) return <main className="admin-page"><div className="admin-loading">{error || 'Loading oversight dashboard…'}</div></main>;

  const metrics = [
    ['Connected Hospitals', overview.hospitals.length, '+ verified participating nodes', ''],
    ['Requests Today', overview.requests_today, 'CamDX consent handshakes', ''],
    ['Approval Rate', `${Math.round(overview.approval_rate * 100)}%`, 'Patient-granted consents', 'metric-teal'],
    ['Emergency Alerts Pending', overview.emergency_pending, 'Break-glass audits required', 'metric-red']
  ];
  const emergencyById = Object.fromEntries(emergencyAudit.map(event => [event.id, event]));

  return <main className="admin-page">
    {error && <p className="err">{error}</p>}
    <header className="admin-header panel"><div><span className="eyebrow">♙ &nbsp;CAMDX NATIONAL HEALTH DATA GOVERNANCE</span><h1>Ministry of Health · CamDX Oversight</h1></div><div className="admin-header-actions"><span>Oversight Window: {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span><button className="secondary-button" onClick={logout}>Sign out</button></div></header>

    <section className="admin-metrics">{metrics.map(([label, value, note, className]) => <article className="panel admin-metric" key={label}><small>{label}</small><strong className={className}>{value}</strong><span>{note}</span></article>)}</section>

    <section className="admin-overview-grid">
      <article className="panel emergency-reviews"><div className="panel-heading"><h2><span className="red-icon">♧</span> Emergency Access Reviews</h2><small>{overview.emergency_events.length} events</small></div>
        <div className="emergency-list">{overview.emergency_events.length ? overview.emergency_events.map(event => {
          const detail = emergencyById[event.id];
          return <div className="emergency-event" key={event.id}>
          <div className="emergency-event-main"><div className="emergency-event-title"><strong>{event.actor_name} · {event.actor_hospital}</strong><span className={`status-pill status-${event.review_status}`}>{event.review_status === 'needs_review' ? 'Needs Review' : event.review_status}</span></div>
            <small>Patient: {detail?.patients?.name || '—'}{detail?.patients?.national_id ? ` (ID ${detail.patients.national_id})` : ''} · {fmt(event.ts)}</small>
            <p><strong>Justification:</strong> {event.justification}</p>
          </div>
          {event.review_status === 'needs_review' && <div className="review-actions"><button className="primary-button" onClick={() => review(event.id, 'reviewed')}>✓ &nbsp;Mark Reviewed</button><button className="flag-button" onClick={() => review(event.id, 'flag')}>⚑ &nbsp;Flag for Audit</button></div>}
        </div>;
        }) : <p className="empty-copy">No emergency access events.</p>}</div>
      </article>

      <article className="panel nodes-panel"><div className="panel-heading"><h2><span className="teal-icon">♧</span> Key CamDX Nodes</h2></div>
        <div className="node-list">{overview.hospitals.map(hospital => <div className="node-row" key={hospital.id}><div><strong>{hospital.name}</strong><code>{hospital.node_id} · {hospital.city}</code></div><span>Connected</span></div>)}</div>
      </article>
    </section>

    <section className="panel audit-panel"><div className="audit-heading"><h2><span className="teal-icon">▧</span> CamDX Exchange Audit Log</h2><div className="audit-controls">
      <div className="audit-filters">{FILTERS.map(([key, label]) => <button key={key} className={type === key ? 'active' : ''} onClick={() => setType(key)}>{label}</button>)}</div>
      <label className="audit-search"><span>⌕</span><input placeholder="Search ID, doctor, hospital…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div></div>
      <div className="table-scroll"><table><thead><tr><th>Timestamp</th><th>Tx ID</th><th>Actor / Hospital</th><th>Patient</th><th>Event</th><th>Details</th></tr></thead><tbody>{audit.map(row => <tr key={row.id}>
        <td><code>{fmt(row.ts)}</code></td><td><code>{row.tx_id}</code></td><td><strong>{row.actor_name}</strong><small>{row.actor_hospital}</small></td><td>{row.patients?.name || '—'}{row.patients?.national_id && <small>{row.patients.national_id}</small>}</td><td><span className={row.event === 'EMERGENCY ACCESS' ? 'event-emergency' : ''}>{row.event}</span></td><td>{row.details}</td>
      </tr>)}</tbody></table>{!audit.length && <p className="empty-copy">No audit entries match this search.</p>}</div>
    </section>
  </main>;
}
