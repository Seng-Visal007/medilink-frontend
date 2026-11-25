import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, fmt } from './api';

const TABS = [
  ['home', 'Home', '⌂'], ['records', 'Records', '▤'], ['consent', 'Consent', '◇'],
  ['history', 'History', '◷'], ['qr', 'QR Card', '▦']
];
const categoryLabels = { labs: 'Lab Results', prescriptions: 'Prescriptions', diagnoses: 'Diagnoses', allergies: 'Allergies', imaging: 'Imaging' };

function Avatar({ name, photo }) {
  return photo
    ? <img className="patient-avatar" src={photo} alt="" />
    : <span className="patient-avatar avatar-fallback" aria-hidden="true">{name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</span>;
}

export default function Patient({ session: { token }, logout }) {
  const [tab, setTab] = useState('home');
  const [data, setData] = useState(null);
  const [category, setCategory] = useState('all');
  const [hours, setHours] = useState(24);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const [me, records, consents, history] = await Promise.all(
        ['me', 'records', 'consents', 'history'].map(path => api(`/patient/${path}`, { token }))
      );
      setData({ me, records, consents, history });
      setError('');
    } catch (e) { setError(e.message); }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const decide = async (id, action, body = {}) => {
    try {
      await api(`/patient/consents/${id}/${action}`, { method: 'POST', token, body });
      await load();
    } catch (e) { setError(e.message); }
  };

  if (!data) return <div className="patient-shell"><div className="patient-loading">{error || 'Loading…'}</div></div>;

  const { me, records, consents, history } = data;
  const patient = me.patient;
  const groups = records
    .filter(record => category === 'all' || record.category === category)
    .reduce((result, record) => {
      const hospital = record.hospitals?.name || 'Other facility';
      (result[hospital] ||= { hospital: record.hospitals, records: [] }).records.push(record);
      return result;
    }, {});

  return (
    <div className="patient-shell">
      <header className="patient-header">
        <div className="patient-identity">
          <Avatar name={patient.name} photo={patient.photo_url} />
          <div><strong>{patient.name}</strong><span>ID&nbsp; {patient.national_id}</span></div>
          <button className="icon-button signout" onClick={logout} aria-label="Sign out">⇥</button>
        </div>
      </header>

      <main className="patient-content">
        {error && <p className="err">{error}</p>}

        {tab === 'home' && <>
          <section className="summary-card">
            <div className="summary-heading"><strong>Health Summary</strong><span>◇ CamDX</span></div>
            <div className="summary-vitals">
              <div><small>Blood Type</small><strong>{patient.blood_type || 'Not recorded'}</strong></div>
              <div className="allergy-vital"><small>Allergies</small><strong>{patient.allergies || 'None recorded'}</strong></div>
            </div>
            <div className="condition-row"><small>Conditions</small><strong>{patient.conditions || 'None recorded'}</strong></div>
          </section>
          <div className="patient-shortcuts">
            <button className="shortcut-card" onClick={() => setTab('records')}><span className="shortcut-icon">▤</span><strong>My Health Records</strong><small>{me.record_count} records</small></button>
            <button className="shortcut-card" onClick={() => setTab('qr')}><span className="shortcut-icon qr-icon">▦</span><strong>My QR Health Card</strong><small>Hospital check-in</small></button>
          </div>
          <section className="permission-summary">
            <div className="section-title"><strong>Active Hospital Permissions</strong><button onClick={() => setTab('consent')}>Manage</button></div>
            {me.active_permissions.length
              ? me.active_permissions.map(consent => <p key={consent.id}>{consent.hospitals?.name} · {consent.categories.map(c => categoryLabels[c] || c).join(', ')}</p>)
              : <p className="mut"><span className="lock-mark">♙</span> No external hospital currently has access.</p>}
          </section>
          {!!consents.pending.length && <button className="pending-banner" onClick={() => setTab('consent')}>
            {consents.pending.length} pending request{consents.pending.length > 1 ? 's' : ''} · Review access request →
          </button>}
        </>}

        {tab === 'records' && <>
          <div className="page-heading"><h2>My Health Records</h2><span>{records.length} items</span></div>
          <div className="category-scroll">{[['all', 'All'], ...Object.entries(categoryLabels).map(([key, label]) => [key, label])].map(([key, label]) =>
            <button key={key} className={`category-chip ${category === key ? 'selected' : ''}`} onClick={() => setCategory(key)}>{label}</button>)}</div>
          {Object.entries(groups).map(([hospitalName, group]) => <section className="record-group" key={hospitalName}>
            <div className="record-hospital"><strong>{hospitalName}</strong>{group.hospital?.cross_border && <span className="verified-pill">✓ Verified</span>}</div>
            <div className="record-list">{group.records.map(record => <article className="record-item" key={record.id}>
              <span className={`record-type-icon type-${record.category}`}>{record.category === 'prescriptions' ? '◇' : record.category === 'diagnoses' ? '♧' : record.category === 'allergies' ? '♢' : '∿'}</span>
              <div><strong>{record.title}</strong><small>{fmt(record.recorded_on)} · {record.doctor_name}</small></div><span className="record-chevron">›</span>
            </article>)}</div>
          </section>)}
          {!records.length && <div className="empty-card">No health records are available yet.</div>}
        </>}

        {tab === 'consent' && <>
          <h2>Consent &amp; Permissions</h2>
          {consents.pending.length ? consents.pending.map(consent => <section className="consent-request" key={consent.id}>
            <strong>{consent.hospitals?.name}</strong>
            <p>{consent.requested_by} requests {consent.categories.map(c => categoryLabels[c] || c).join(', ')}</p>
            <label>Access duration</label>
            <select value={hours} onChange={event => setHours(Number(event.target.value))}><option value={1}>1 hour</option><option value={24}>24 hours</option><option value={168}>7 days</option></select>
            <div className="consent-actions"><button className="primary-button" onClick={() => decide(consent.id, 'decision', { decision: 'approve', hours })}>Approve</button><button className="danger-button" onClick={() => decide(consent.id, 'decision', { decision: 'deny' })}>Deny</button></div>
          </section>) : <div className="empty-card consent-empty"><span>◇</span><p>No pending requests right now. When a doctor requests your records, it appears here.</p></div>}
          <h3>Active Hospital Permissions</h3>
          {consents.active.length ? consents.active.map(consent => <div className="permission-row" key={consent.id}><div><strong>{consent.hospitals?.name}</strong><small>{consent.categories.map(c => categoryLabels[c] || c).join(', ')} · until {fmt(consent.expires_at)}</small></div><button className="danger-outline" onClick={() => decide(consent.id, 'revoke')}>Revoke</button></div>) : <div className="empty-card">No active hospital permissions.</div>}
          <h3>Past Denied, Revoked &amp; Expired</h3>
          <div className="past-permissions">{consents.past.length ? consents.past.map(consent => <div className="past-permission" key={consent.id}>
            <div><strong>{consent.hospitals?.name}</strong><small>{consent.categories.map(c => categoryLabels[c] || c).join(', ')} · {fmt(consent.created_at)}</small></div>
            <span className={`status-pill status-${consent.status}`}>{consent.status}</span>
          </div>) : <div className="empty-card">No past requests.</div>}</div>
        </>}

        {tab === 'history' && <>
          <h2>Access History</h2>
          <div className="history-list">{history.length ? history.map(item => <article className="history-item" key={item.tx_id}>
            <strong>{item.actor_name} · {item.actor_hospital}</strong><p>{item.details}</p>
            <div><span>{fmt(item.ts)}</span><code>{item.tx_id}</code></div>
          </article>) : <div className="empty-card">No access history yet.</div>}</div>
        </>}

        {tab === 'qr' && <>
          <h2>My QR Health Card</h2>
          <section className="health-card">
            <div className="health-card-title"><div><small>Ministry of Health Cambodia</small><strong>MediLink Health Card</strong></div><span>◇</span></div>
            <div className="health-card-patient"><Avatar name={patient.name} photo={patient.photo_url} /><div><strong>{patient.name}</strong><small>ID: {patient.national_id}</small></div></div>
            <div className="health-qr"><QRCodeSVG value={`medilink:patient:${patient.national_id}`} size={172} level="M" /></div>
            <div className="qr-vitals"><div><small>Blood Type</small><strong>{patient.blood_type || '—'}</strong></div><div><small>Allergies</small><strong>{patient.allergies || 'None recorded'}</strong></div></div>
            <p>Present this QR code at hospital reception to verify your National Health ID.</p>
          </section>
        </>}
      </main>

      <nav className="patient-tabs" aria-label="Patient navigation">{TABS.map(([key, label, icon]) =>
        <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}><span>{icon}</span><small>{label}</small></button>)}</nav>
    </div>
  );
}
