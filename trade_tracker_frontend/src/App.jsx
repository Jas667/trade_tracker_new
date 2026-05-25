import { useState, useEffect } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend
)

const API = 'http://localhost:3000'

function App() {
  const [trades, setTrades] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [newTag, setNewTag] = useState('')

  const [form, setForm] = useState({
    dateTime: '', reference: '', market: '', tradeCcy: 'USD',
    buySell: 'Buy', orderType: 'Market', quantity: '', price: '',
    spread: '0', openClose: 'Open'
  })

  const fetchTrades = async () => {
    const params = new URLSearchParams()
    if (from) params.append('from', from)
    if (to) params.append('to', to)
    const res = await fetch(`${API}/trades?${params}`)
    const data = await res.json()
    setTrades(data)
  }

  const handlePDFUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    const formData = new FormData()
    formData.append('pdf', file)

    const res = await fetch(`${API}/trades/upload`, {
      method: 'POST',
      body: formData
    })
    const result = await res.json()
    if (!res.ok) {
      alert('Upload failed: ' + (result.error || res.statusText))
    } else {
      alert(`Imported ${result.imported} trades`)
      fetchTrades()
    }
  }

  useEffect(() => { fetchTrades() }, [from, to])

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = {
      ...form,
      dateTime: new Date(form.dateTime).toISOString()
    }
    await fetch(`${API}/trades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    fetchTrades()
    setForm({ ...form, reference: '', quantity: '', price: '' })
  }

  const addTag = async () => {
    if (!newTag || !selectedTrade) return
    await fetch(`${API}/trades/${selectedTrade.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTag })
    })
    setNewTag('')
    fetchTrades()
    // refresh selected
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  const removeTag = async (tagId) => {
    await fetch(`${API}/trades/${selectedTrade.id}/tags/${tagId}`, { method: 'DELETE' })
    fetchTrades()
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  // Prepare chart data (use open_time from Trade)
  const sorted = [...trades].sort((a, b) => new Date(a.open_time) - new Date(b.open_time))
  const labels = sorted.map(t => new Date(t.open_time).toLocaleDateString())
  const cumulative = sorted.reduce((acc, t, i) => {
    const prev = i > 0 ? acc[i - 1] : 0
    acc.push(prev + (parseFloat(t.realized_pnl) || 0))
    return acc
  }, [])
  const daily = sorted.map(t => parseFloat(t.realized_pnl) || 0)

  const lineData = { labels, datasets: [{ label: 'Cumulative P&L', data: cumulative, borderColor: '#3b82f6' }] }
  const barData = { labels, datasets: [{ label: 'Daily P&L', data: daily, backgroundColor: '#10b981' }] }

  return (
    <div style={{ padding: 20, fontFamily: 'system-ui' }}>
      <h1>Trade Tracker</h1>

      {/* Date Filter + Upload */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
        <div>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ marginLeft: 8 }} />
          <button onClick={fetchTrades} style={{ marginLeft: 8 }}>Apply</button>
        </div>
        <div>
          <label style={{ cursor: 'pointer', background: '#3b82f6', color: 'white', padding: '6px 12px', borderRadius: 4 }}>
            Upload PDF Statement
            <input type="file" accept="application/pdf" onChange={handlePDFUpload} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
        <div>
          <h3>Cumulative P&amp;L</h3>
          <Line data={lineData} />
        </div>
        <div>
          <h3>Daily P&amp;L</h3>
          <Bar data={barData} />
        </div>
      </div>

      {/* Manual Entry Form */}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 30 }}>
        <input type="datetime-local" value={form.dateTime} onChange={e => setForm({ ...form, dateTime: e.target.value })} required />
        <input placeholder="Reference" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} required />
        <input placeholder="Market" value={form.market} onChange={e => setForm({ ...form, market: e.target.value })} required />
        <select value={form.buySell} onChange={e => setForm({ ...form, buySell: e.target.value })}>
          <option>Buy</option><option>Sell</option>
        </select>
        <input placeholder="Quantity" type="number" step="0.01" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
        <input placeholder="Price" type="number" step="0.0001" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} required />
        <input placeholder="Spread (positive)" type="number" step="0.0001" value={form.spread} onChange={e => setForm({ ...form, spread: e.target.value })} />
        <select value={form.openClose} onChange={e => setForm({ ...form, openClose: e.target.value })}>
          <option>Open</option>
          <option value="Full Close">Close (Partial or Full)</option>
        </select>
        <button type="submit" style={{ gridColumn: 'span 2' }}>Add Trade</button>
      </form>

      {/* Trades Table */}
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th>Open Time</th><th>Market</th><th>Buy/Sell</th><th>Price</th><th>Status</th><th>Remaining Qty</th><th>Realized P&amp;L</th><th>Tags</th></tr>
        </thead>
        <tbody>
          {trades.map(t => {
            const firstDetail = t.TradeDetails?.[0];
            return (
              <tr key={t.id} onClick={() => setSelectedTrade(t)} style={{ cursor: 'pointer' }}>
                <td>{new Date(t.open_time).toLocaleString()}</td>
                <td>{t.market}</td>
                <td>{firstDetail?.buySell || '-'}</td>
                <td>{firstDetail?.price || '-'}</td>
                <td>{t.status}</td>
                <td>{t.remaining_quantity}</td>
                <td style={{ color: (t.realized_pnl || 0) >= 0 ? 'green' : 'red' }}>{t.realized_pnl}</td>
                <td>{t.Tags?.map(tag => tag.name).join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Detail Modal */}
      {selectedTrade && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 20, width: 420, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Trade on {selectedTrade.market}</h2>
            
            <div style={{ marginBottom: 12 }}>
              <strong>Status:</strong> {selectedTrade.status} &nbsp;&nbsp;
              <strong>Remaining Qty:</strong> {selectedTrade.remaining_quantity} &nbsp;&nbsp;
              <strong>Realized P&amp;L:</strong> {selectedTrade.realized_pnl}
            </div>

            <div style={{ marginBottom: 16 }}>
              <strong>Details:</strong>
              <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
                {selectedTrade.TradeDetails?.map(d => (
                  <li key={d.id}>
                    {new Date(d.dateTime).toLocaleString()} — {d.buySell} {d.quantity} @ {d.price} ({d.openClose})
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ marginTop: 16 }}>
              <input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag" />
              <button onClick={addTag} style={{ marginLeft: 8 }}>Add Tag</button>
            </div>

            <div style={{ marginTop: 12 }}>
              {selectedTrade.Tags?.map(tag => (
                <span key={tag.id} style={{ marginRight: 8, background: '#eee', padding: '2px 6px' }}>
                  {tag.name} <button onClick={() => removeTag(tag.id)}>×</button>
                </span>
              ))}
            </div>

            <div style={{ marginTop: 20, display: 'flex', gap: 8 }}>
              <button onClick={() => setSelectedTrade(null)}>Close</button>
              <button
                onClick={async () => {
                  if (!confirm('Delete this trade?')) return;
                  await fetch(`${API}/trades/${selectedTrade.id}`, { method: 'DELETE' });
                  setSelectedTrade(null);
                  fetchTrades();
                }}
                style={{ background: '#ef4444', color: 'white' }}
              >
                Delete Trade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App