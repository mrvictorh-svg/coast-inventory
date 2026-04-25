import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Search, Plus, Package, Barcode, DollarSign, MapPin, Edit, Trash2, Download, Filter, CarFront, ClipboardCheck, RefreshCw } from 'lucide-react';
import './style.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const statuses = ['In Stock', 'Pulled', 'Needs Testing', 'Tested Good', 'Ready to List', 'Listed', 'Sold', 'Damaged', 'Core', 'Scrap'];
const conditions = ['Used', 'Tested Good', 'For Parts', 'New', 'Refurbished', 'Core Only'];
const categories = ['Engine', 'Transmission', 'Electrical', 'Body', 'Interior', 'Suspension', 'Brake', 'Wheel/Tire', 'AC/Heat', 'Exhaust', 'Glass', 'Other'];

const emptyForm = {
  part_name: '',
  category: 'Other',
  vehicle: '',
  donor_vehicle: '',
  vin: '',
  condition: 'Used',
  yard_location: '',
  shelf_bin: '',
  qty: 1,
  cost: '',
  price: '',
  status: 'In Stock',
  notes: '',
};

function makeSku(parts) {
  const max = parts.reduce((highest, part) => {
    const num = Number(String(part.sku || '').replace(/\D/g, ''));
    return Number.isFinite(num) ? Math.max(highest, num) : highest;
  }, 0);
  return `CEA-${String(max + 1).padStart(5, '0')}`;
}

function App() {
  const [parts, setParts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => { loadParts(); }, []);

  async function loadParts() {
    setLoading(true);
    const { data, error } = await supabase
      .from('parts_inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) setMessage(`Database error: ${error.message}`);
    else setParts(data || []);
    setLoading(false);
  }

  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const haystack = `${p.sku} ${p.part_name} ${p.category} ${p.vehicle} ${p.donor_vehicle} ${p.vin} ${p.yard_location} ${p.shelf_bin} ${p.status} ${p.notes}`.toLowerCase();
      return haystack.includes(query.toLowerCase()) && (statusFilter === 'All' || p.status === statusFilter);
    });
  }, [parts, query, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = parts.reduce((sum, p) => sum + Number(p.price || 0) * Number(p.qty || 0), 0);
    return {
      totalParts: parts.length,
      totalValue,
      ready: parts.filter((p) => p.status === 'Ready to List').length,
      needsTesting: parts.filter((p) => p.status === 'Needs Testing').length,
    };
  }, [parts]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function savePart(e) {
    e.preventDefault();
    setMessage('');
    if (!form.part_name.trim()) {
      setMessage('Part name is required.');
      return;
    }

    const payload = {
      ...form,
      vin: String(form.vin || '').toUpperCase(),
      qty: Number(form.qty || 1),
      cost: Number(form.cost || 0),
      price: Number(form.price || 0),
    };

    let result;
    if (editingId) {
      result = await supabase.from('parts_inventory').update(payload).eq('id', editingId).select();
    } else {
      result = await supabase.from('parts_inventory').insert([{ ...payload, sku: makeSku(parts) }]).select();
    }

    if (result.error) {
      setMessage(`Save error: ${result.error.message}`);
      return;
    }

    setMessage(editingId ? 'Part updated.' : 'Part added.');
    resetForm();
    loadParts();
  }

  function editPart(part) {
    setEditingId(part.id);
    setForm({
      part_name: part.part_name || '',
      category: part.category || 'Other',
      vehicle: part.vehicle || '',
      donor_vehicle: part.donor_vehicle || '',
      vin: part.vin || '',
      condition: part.condition || 'Used',
      yard_location: part.yard_location || '',
      shelf_bin: part.shelf_bin || '',
      qty: part.qty || 1,
      cost: part.cost || '',
      price: part.price || '',
      status: part.status || 'In Stock',
      notes: part.notes || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deletePart(id) {
    if (!confirm('Delete this part from inventory?')) return;
    const { error } = await supabase.from('parts_inventory').delete().eq('id', id);
    if (error) setMessage(`Delete error: ${error.message}`);
    else {
      setMessage('Part deleted.');
      loadParts();
    }
  }

  function exportCsv() {
    const headers = ['SKU', 'Part', 'Category', 'Vehicle Fitment', 'Donor Vehicle', 'VIN', 'Condition', 'Yard Location', 'Shelf/Bin', 'Qty', 'Cost', 'Price', 'Status', 'Notes'];
    const rows = parts.map((p) => [p.sku, p.part_name, p.category, p.vehicle, p.donor_vehicle, p.vin, p.condition, p.yard_location, p.shelf_bin, p.qty, p.cost, p.price, p.status, p.notes]);
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coast-easy-autos-parts-inventory.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function printLabel(part) {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${part.sku}</title><style>body{font-family:Arial;padding:16px}.label{width:330px;border:2px solid #000;padding:14px}.brand{font-size:20px;font-weight:800}.sku{font-size:18px;font-weight:800;margin:10px 0}.barcode{font-family:monospace;font-size:22px;letter-spacing:2px;margin:12px 0}.line{margin:6px 0}</style></head><body><div class="label"><div class="brand">COAST EASY AUTOS</div><div class="sku">${part.sku}</div><div class="barcode">|||| ${part.sku} ||||</div><div class="line"><b>Part:</b> ${part.part_name || ''}</div><div class="line"><b>Vehicle:</b> ${part.vehicle || ''}</div><div class="line"><b>Donor:</b> ${part.donor_vehicle || ''}</div><div class="line"><b>Location:</b> ${part.yard_location || ''} / ${part.shelf_bin || ''}</div><div class="line"><b>Price:</b> $${part.price || 0}</div><div class="line"><b>Status:</b> ${part.status || ''}</div></div><script>window.print()</script></body></html>`);
    w.document.close();
  }

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div>
            <h1>Coast Easy Autos Stock & Parts Inventory</h1>
            <p>Track donor vehicles, used parts, barcodes, shelf/bin locations, value, testing, and listing status.</p>
          </div>
          <div className="actions">
            <button className="dark" onClick={loadParts}><RefreshCw size={18} /> Refresh</button>
            <button className="dark" onClick={exportCsv}><Download size={18} /> Export CSV</button>
          </div>
        </header>

        {message && <div className="message">{message}</div>}

        <section className="stats">
          <StatCard icon={<Package />} title="Total Parts" value={stats.totalParts} />
          <StatCard icon={<DollarSign />} title="Inventory Value" value={`$${stats.totalValue.toLocaleString()}`} />
          <StatCard icon={<ClipboardCheck />} title="Ready to List" value={stats.ready} />
          <StatCard icon={<Filter />} title="Needs Testing" value={stats.needsTesting} />
        </section>

        <form onSubmit={savePart} className="card formCard">
          <div className="formHeader">
            <h2><Plus size={20} /> {editingId ? 'Edit Part' : 'Add Part / Stock Item'}</h2>
            {editingId && <button type="button" className="linkBtn" onClick={resetForm}>Cancel edit</button>}
          </div>
          <div className="grid">
            <TextInput label="Part Name" value={form.part_name} onChange={(v) => setForm({ ...form, part_name: v })} placeholder="Alternator, radio, bumper..." required />
            <SelectInput label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} options={categories} />
            <TextInput label="Vehicle Fitment" value={form.vehicle} onChange={(v) => setForm({ ...form, vehicle: v })} placeholder="2016 Nissan Altima 2.5" />
            <TextInput label="Donor Vehicle / Stock #" value={form.donor_vehicle} onChange={(v) => setForm({ ...form, donor_vehicle: v })} placeholder="Car #12 / 2013 Titan" />
            <TextInput label="VIN" value={form.vin} onChange={(v) => setForm({ ...form, vin: v })} placeholder="Optional" />
            <SelectInput label="Condition" value={form.condition} onChange={(v) => setForm({ ...form, condition: v })} options={conditions} />
            <TextInput label="Yard Location" value={form.yard_location} onChange={(v) => setForm({ ...form, yard_location: v })} placeholder="Back lot Row 2" />
            <TextInput label="Shelf / Bin" value={form.shelf_bin} onChange={(v) => setForm({ ...form, shelf_bin: v })} placeholder="Shelf A-3 / Tote 5" />
            <SelectInput label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={statuses} />
            <TextInput label="Quantity" type="number" value={form.qty} onChange={(v) => setForm({ ...form, qty: v })} />
            <TextInput label="Cost" type="number" value={form.cost} onChange={(v) => setForm({ ...form, cost: v })} />
            <TextInput label="Selling Price" type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} />
          </div>
          <label className="field full"><span>Notes</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Testing notes, damage, compatibility, eBay title idea, shipping notes..." /></label>
          <button type="submit" className="saveBtn">{editingId ? 'Save Changes' : 'Add to Inventory'}</button>
        </form>

        <section className="card listCard">
          <div className="searchRow">
            <div className="searchBox"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search part, SKU, vehicle, VIN, donor, shelf, notes..." /></div>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>All</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          </div>
          {loading ? <p>Loading inventory...</p> : <div className="partGrid">{filteredParts.map((part) => <PartCard key={part.id} part={part} onPrint={printLabel} onEdit={editPart} onDelete={deletePart} />)}</div>}
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon, title, value }) {
  return <div className="stat"><div className="red">{icon}</div><span>{title}</span><strong>{value}</strong></div>;
}
function TextInput({ label, value, onChange, placeholder, type = 'text', required = false }) {
  return <label className="field"><span>{label}</span><input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} /></label>;
}
function SelectInput({ label, value, onChange, options }) {
  return <label className="field"><span>{label}</span><select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
function Info({ icon, label, value }) {
  return <div className="info"><span>{icon}</span><div><small>{label}</small><b>{value}</b></div></div>;
}
function PartCard({ part, onPrint, onEdit, onDelete }) {
  return <div className="part"><div className="partTop"><div><small className="sku">{part.sku}</small><h3>{part.part_name}</h3><p>{part.vehicle}</p></div><span className="pill">{part.status}</span></div><div className="infoGrid"><Info icon={<CarFront size={16} />} label="Donor" value={part.donor_vehicle || 'Not set'} /><Info icon={<MapPin size={16} />} label="Location" value={`${part.yard_location || 'Yard?'} / ${part.shelf_bin || 'Bin?'}`} /><Info icon={<DollarSign size={16} />} label="Price" value={`$${part.price || 0}`} /><Info icon={<Package size={16} />} label="Category" value={part.category || 'Other'} /></div>{part.notes && <p className="notes">{part.notes}</p>}<div className="partActions"><button onClick={() => onPrint(part)} className="dark small"><Barcode size={16} /> Print Label</button><button onClick={() => onEdit(part)} className="light small"><Edit size={16} /> Edit</button><button onClick={() => onDelete(part.id)} className="danger small"><Trash2 size={16} /> Delete</button></div></div>;
}

createRoot(document.getElementById('root')).render(<App />);
