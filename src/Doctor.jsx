import { useEffect, useState } from 'react';
import { api, fmt, CATS } from './api';

const NAV = [['dash', 'Dashboard', '▦'], ['lookup', 'Patient Lookup', '⌕'], ['reqs', 'Requests', '◷'], ['referrals', 'Referrals', '➤']];
const labels = { labs: 'Lab Results', diagnoses: 'Diagnoses', prescriptions: 'Prescriptions', allergies: 'Allergies', imaging: 'Imaging' };

function Lookup({ token, initialId }) {
  const [nationalId, setNationalId] = useState(initialId || '');
  const [patient, setPatient] = useState(null);
  const [error, setError] = useState('');
  const [records, setRecords] = useState(null);
  const [fhir, setFhir] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [categories, setCategories] = useState(['labs', 'diagnoses', 'prescriptions', 'allergies']);
  const [message, setMessage] = useState('');
  const [emergency, setEmergency] = useState(null);
  const [showEmergency, setShowEmergency] = useState(false);
  const [justification, setJustification] = useState('');

  const search = async (value = nationalId) => {
    setError(''); setRecords(null); setEmergency(null); setMessage('');
    try { setPatient(await api(`/doctor/lookup/${encodeURIComponent(value)}`, { token })); }
    catch (e) { setPatient(null); setError(e.message); }
  };

  useEffect(() => { if (initialId) search(initialId); }, []);
  useEffect(() => {
    if (!patient) return;
    const interval = setInterval(async () => {
      try {
        const updated = await api(`/doctor/lookup/${encodeURIComponent(patient.national_id)}`, { token });
        if (updated.unlocked !== patient.unlocked) setPatient(updated);
      } catch { /* Keep the current patient visible if polling briefly fails. */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [patient]);
  useEffect(() => {
    if (!patient?.unlocked) { setRecords(null); return; }
    api(`/doctor/patients/${patient.id}/records${fhir ? '?format=fhir' : ''}`, { token })
      .then(setRecords).catch(e => setError(e.message));
  }, [patient?.unlocked, fhir]);

  const sendRequest = async () => {
    try {
      await api('/doctor/requests', { method: 'POST', token, body: { patient_id: patient.id, categories } });
      setShowCategories(false); setMessage('Consent request sent. Waiting for patient approval.');
    } catch (e) { setError(e.message); }
  };
  const requestEmergency = async () => {
    try {
      setEmergency(await api('/doctor/emergency', { method: 'POST', token, body: { patient_id: patient.id, justification } }));
      setShowEmergency(false); setError('');
    } catch (e) { setError(e.message); }
  };

  return <div className="lookup-page">
    <form className="lookup-search panel" onSubmit={event => { event.preventDefault(); search(); }}>
      <span>⌕</span><input aria-label="National ID" value={nationalId} onChange={event => setNationalId(event.target.value)} placeholder="Search National ID" />
      <button className="primary-button" type="submit">Search National ID</button><button className="secondary-button" type="button" title="QR scanning is not available yet">▦ <span>Scan QR</span></button>
    </form>
    {error && <p className="err">{error}</p>}
    {patient && <>
      <section className="patient-result panel">
        <div className="doctor-avatar">{patient.name?.split(' ').map(part => part[0]).slice(0, 2).join('')}</div>
        <div className="patient-result-info"><strong>{patient.name}</strong><span><code>National ID {patient.national_id}</code></span><small>Age: {patient.age} · {patient.gender} · {patient.city}</small></div>
        <div className="patient-result-actions"><button className="primary-button" onClick={() => setShowCategories(!showCategories)}>◇ <span>Request Records</span></button><button className="danger-button" onClick={() => setShowEmergency(!showEmergency)}>♧ <span>Emergency Access</span></button></div>
      </section>
      {showCategories && <section className="panel request-panel"><strong>Select record categories to request</strong><div className="category-checks">{CATS.map(category => <label key={category}><input type="checkbox" checked={categories.includes(category)} onChange={() => setCategories(categories.includes(category) ? categories.filter(item => item !== category) : [...categories, category])} />{labels[category]}</label>)}</div><button className="primary-button" disabled={!categories.length} onClick={sendRequest}>Send Consent Request</button></section>}
      {showEmergency && <section className="panel emergency-form"><strong>Emergency access justification</strong><p>This break-glass access is logged for Ministry review.</p><textarea rows="3" value={justification} onChange={event => setJustification(event.target.value)} placeholder="Explain why emergency access is required" /><button className="danger-button" onClick={requestEmergency}>Confirm Emergency Access</button></section>}
      {message && <p className="success-note">{message}</p>}
      {emergency && <section className="panel emergency-result"><span className="status-pill status-needs_review">Emergency access · logged</span><p>Blood type: <strong>{emergency.blood_type}</strong> · Allergies: <strong>{emergency.allergies}</strong></p>{emergency.records.map(record => <div key={record.id}>{record.title} · {labels[record.category] || record.category}</div>)}</section>}
      {patient.unlocked ? <section className="panel released-records">
        <div className="panel-heading"><strong>Records released by patient consent</strong><button className="secondary-button" onClick={() => setFhir(!fhir)}>{fhir ? 'Standard View' : 'FHIR Bundle'}</button></div>
        {fhir ? <pre>{JSON.stringify(records || {}, null, 2)}</pre> : records?.records?.map(record => <article className="released-record" key={record.id}><strong>{record.title}</strong><small>{record.hospitals?.name} · {fmt(record.recorded_on)} · {record.doctor_name} · {labels[record.category] || record.category}</small></article>)}
      </section> : <section className="panel locked-records"><strong>♙ &nbsp;Medical data locked · Patient consent required via MediLink CamDX</strong><div className="locked-preview-grid">{['Lab Results', 'Allergies', 'Prescriptions', 'Diagnoses'].map(label => <div className="locked-preview" key={label}><strong>{label}</strong><span>Restricted medical record preview</span><i>♙</i></div>)}</div></section>}
    </>}
  </div>;
}

function Referrals({ token, patients, hospitals }) {
  const [referrals, setReferrals] = useState([]);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ patient_id: '', to_hospital: '', department: '', urgency: 'Priority', summary: '' });
  const update = key => event => setForm(current => ({ ...current, [key]: event.target.value }));
  const load = async () => { try { setReferrals(await api('/doctor/referrals', { token })); } catch (e) { setError(e.message); } };
  useEffect(() => { load(); }, []);
  const submit = async event => {
    event.preventDefault(); setError(''); setSent(false);
    try {
      await api('/doctor/referrals', { method: 'POST', token, body: form });
      setSent(true); setForm(current => ({ ...current, summary: '' })); await load();
    } catch (e) { setError(e.message); }
  };
  return <div className="referrals-layout">
    <section className="panel referral-form-panel"><h2>Create Digital Referral</h2>
      <form onSubmit={submit}>
        <label>Patient<select required value={form.patient_id} onChange={update('patient_id')}><option value="">Select patient</option>{patients.map(patient => <option value={patient.id} key={patient.id}>{patient.name} (ID {patient.national_id})</option>)}</select></label>
        <label>Destination Hospital<select required value={form.to_hospital} onChange={update('to_hospital')}><option value="">Select destination hospital</option>{hospitals.map(hospital => <option value={hospital.name} key={hospital.id}>{hospital.name} ({hospital.city})</option>)}</select></label>
        <div className="form-pair"><label>Department<input required value={form.department} onChange={update('department')} placeholder="e.g. Endocrinology" /></label><label>Urgency<select value={form.urgency} onChange={update('urgency')}><option>Routine</option><option>Priority</option><option>Urgent</option></select></label></div>
        <label>Clinical Summary &amp; Attached Records<textarea required rows="4" value={form.summary} onChange={update('summary')} placeholder="Summarize the reason for referral and relevant records" /></label>
        {error && <p className="err">{error}</p>}{sent && <p className="success-note">Digital referral sent via CamDX.</p>}
        <button className="primary-button full-button" type="submit">➤ &nbsp;Send Digital Referral via CamDX</button>
      </form>
    </section>
    <section className="panel sent-referrals"><h2>Sent Digital Referrals</h2>
      {referrals.length ? referrals.map(referral => <article className="sent-referral" key={referral.id}><div><strong>{referral.patients?.name || 'Patient referral'}</strong><span>{referral.to_hospital} · {referral.department}</span></div><span className="status-pill">{referral.urgency}</span><p>{referral.summary}</p><small>{fmt(referral.created_at)}</small></article>) : <p className="empty-copy">No digital referrals sent in this session yet.</p>}
    </section>
  </div>;
}

export default function Doctor({ session: { token, user }, logout }) {
  const [tab, setTab] = useState('dash');
  const [initialId, setInitialId] = useState('');
  const [stats, setStats] = useState({});
  const [patients, setPatients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [nextStats, nextPatients, nextRequests, nextHospitals] = await Promise.all([
          api('/doctor/stats', { token }), api('/doctor/patients', { token }),
          api('/doctor/requests', { token }), api('/hospitals')
        ]);
        setStats(nextStats); setPatients(nextPatients); setRequests(nextRequests); setHospitals(nextHospitals);
      } catch (e) { setError(e.message); }
    };
    load(); const interval = setInterval(load, 5000); return () => clearInterval(interval);
  }, []);

  return <div className="doctor-layout">
    <aside className="doctor-sidebar">
      <div className="hospital-brand"><span className="hospital-code">♧ &nbsp;{user.hospital_id}</span><strong>{user.hospitals?.name}</strong><code>{user.hospitals?.node_id}</code></div>
      <nav>{NAV.map(([key, label, icon]) => <button key={key} className={tab === key ? 'selected' : ''} onClick={() => setTab(key)}><span>{icon}</span>{label}</button>)}</nav>
      <div className="doctor-profile"><span className="doctor-avatar small-avatar">{user.name?.split(' ').slice(-1)[0]?.[0] || 'D'}</span><div><strong>{user.name}</strong><small>{user.title}</small></div></div>
      <button className="sidebar-signout" onClick={logout}>↪ &nbsp;Sign out</button>
    </aside>

    <main className="doctor-main">
      {error && <p className="err">{error}</p>}
      {tab === 'dash' && <>
        <section className="workspace-heading panel"><div><h1>Outpatient Clinical Workspace</h1><p>Retrieve verified medical records across Cambodian hospitals with patient consent.</p></div><button className="primary-button" onClick={() => setTab('lookup')}>⌕ &nbsp;Patient Lookup</button></section>
        <div className="doctor-stats">{[['Today’s Patients', stats.today_patients, 'stat-blue'], ['Pending Consents', stats.pending, 'stat-orange'], ['Active Consents', stats.active, 'stat-green'], ['Referrals Sent', stats.referrals_sent, 'stat-dark']].map(([label, value, color]) => <section className="panel stat-card" key={label}><small>{label}</small><strong className={color}>{value ?? '—'}</strong></section>)}</div>
        <section className="panel patient-table-panel"><div className="panel-heading"><h2>Today’s Patients</h2><small>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</small></div>
          <div className="table-scroll"><table><thead><tr><th>Patient</th><th>National ID</th><th>Age / Gender</th><th>CamDX Consent Status</th><th>Action</th></tr></thead><tbody>{patients.map(patient => <tr key={patient.id}><td><strong>{patient.name}</strong></td><td><code>{patient.national_id}</code></td><td>{patient.age} · {patient.gender}</td><td><span className={patient.unlocked ? 'table-unlocked' : 'table-locked'}>{patient.unlocked ? '◇ Unlocked' : '♙ Locked · Consent required'}</span></td><td><button className="dark-button" onClick={() => { setInitialId(patient.national_id); setTab('lookup'); }}>Open Chart</button></td></tr>)}</tbody></table></div>
        </section>
      </>}
      {tab === 'lookup' && <Lookup key={initialId} token={token} initialId={initialId} />}
      {tab === 'reqs' && <section className="panel request-table-panel"><h2>Outbound Consent Requests · {user.hospitals?.name}</h2>
        {requests.length ? <div className="table-scroll"><table><thead><tr><th>Patient</th><th>Requested Categories</th><th>Request Date</th><th>Status</th></tr></thead><tbody>{requests.map(request => <tr key={request.id}><td>{request.patients?.name}</td><td>{request.categories.map(c => labels[c] || c).join(', ')}</td><td>{fmt(request.created_at)}</td><td><span className={`status-pill status-${request.status}`}>{request.status}</span></td></tr>)}</tbody></table></div> : <p className="empty-copy">No requests sent yet. Open Patient Lookup to request records.</p>}
      </section>}
      {tab === 'referrals' && <Referrals token={token} patients={patients} hospitals={hospitals.filter(hospital => hospital.id !== user.hospital_id)} />}
    </main>
  </div>;
}
