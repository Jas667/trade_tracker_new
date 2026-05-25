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
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [editingDetail, setEditingDetail] = useState(null)
  const [allTags, setAllTags] = useState([])
  const [tagInput, setTagInput] = useState('')
  const [showTagsModal, setShowTagsModal] = useState(false)
  const [selectedFilterTags, setSelectedFilterTags] = useState([])
  const [analytics, setAnalytics] = useState({
    plByHour: {},
    plByDirection: { buy: 0, sell: 0 },
    winRate: 0,
    avgWin: 0,
    avgLoss: 0
  })

  // Calculate P&L by day of week (Mon-Fri) from current trades
  const calculatePlByDayOfWeek = (tradeList) => {
    if (!Array.isArray(tradeList)) return [0, 0, 0, 0, 0]

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const result = [0, 0, 0, 0, 0] // Mon to Fri

    tradeList.forEach(trade => {
      const dayIndex = new Date(trade.open_time).getDay()
      if (dayIndex >= 1 && dayIndex <= 5) {
        result[dayIndex - 1] += parseFloat(trade.realized_pnl || 0)
      }
    })
    return result
  }

  const [form, setForm] = useState({
    dateTime: '', reference: '', market: '', tradeCcy: 'USD',
    buySell: 'Buy', orderType: 'Market', quantity: '', price: '',
    spread: '0', openClose: 'Open'
  })

  const fetchTrades = async () => {
    try {
      const params = new URLSearchParams()
      if (from && !isNaN(new Date(from))) params.append('from', from)
      if (to && !isNaN(new Date(to))) params.append('to', to)
      if (selectedFilterTags.length > 0) {
        params.append('tags', selectedFilterTags.join(','))
      }
      console.log('Fetching trades with params:', params.toString())
      const res = await fetch(`${API}/trades?${params}`)
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error('Backend error response:', errorText)
        setTrades([])
        return
      }
      
      const data = await res.json()
      setTrades(data)
      fetchAnalytics()
    } catch (err) {
      console.error('fetchTrades error:', err)
    }
  }

  useEffect(() => { fetchTrades() }, [selectedFilterTags])

  const fetchTags = async () => {
    try {
      const res = await fetch(`${API}/trades/tags`)
      if (!res.ok) {
        console.error('Failed to fetch tags:', res.status)
        setAllTags([])
        return
      }
      const data = await res.json()
      setAllTags(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('fetchTags error:', err)
      setAllTags([])
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const fetchAnalytics = async () => {
    try {
      const params = new URLSearchParams()
      if (from && !isNaN(new Date(from))) params.append('from', from)
      if (to && !isNaN(new Date(to))) params.append('to', to)
      if (selectedFilterTags.length > 0) {
        params.append('tags', selectedFilterTags.join(','))
      }

      const query = params.toString() ? `?${params}` : ''

      const [hourRes, dirRes, winRes, avgRes] = await Promise.all([
        fetch(`${API}/trades/analytics/pl-by-hour${query}`),
        fetch(`${API}/trades/analytics/pl-by-direction${query}`),
        fetch(`${API}/trades/analytics/win-rate${query}`),
        fetch(`${API}/trades/analytics/avg-win-loss${query}`)
      ])

      const [plByHour, plByDirection, winRateData, avgData] = await Promise.all([
        hourRes.json(),
        dirRes.json(),
        winRes.json(),
        avgRes.json()
      ])

      setAnalytics({
        plByHour,
        plByDirection,
        winRate: winRateData.winRate,
        avgWin: avgData.avgWin,
        avgLoss: avgData.avgLoss
      })
    } catch (e) {
      console.error('Analytics fetch failed')
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [selectedFilterTags])

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

  const handlePasteSubmit = async () => {
    if (!pasteText.trim()) return

    const res = await fetch(`${API}/trades/paste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: pasteText })
    })

    const result = await res.json()
    if (res.ok) {
      alert(`Imported ${result.imported} trades`)
      setShowPasteModal(false)
      setPasteText('')
      fetchTrades()
    } else {
      alert('Error: ' + (result.error || 'Failed to import'))
    }
  }

  const addTag = async (tagName) => {
    const name = tagName || tagInput || newTag
    if (!name || !selectedTrade) return

    await fetch(`${API}/trades/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })

    await fetch(`${API}/trades/${selectedTrade.id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })

    setNewTag('')
    setTagInput('')
    fetchTrades()
    fetchTags()

    // Force fresh fetch with cache buster
    const updated = await fetch(`${API}/trades/${selectedTrade.id}?t=${Date.now()}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  const removeTag = async (tagId) => {
    await fetch(`${API}/trades/${selectedTrade.id}/tags/${tagId}`, { method: 'DELETE' })
    fetchTrades()
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  const saveDetail = async (detail) => {
    await fetch(`${API}/trades/details/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(detail)
    })
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
    setEditingDetail(null)
  }

  const deleteDetail = async (id) => {
    if (!confirm('Delete this trade detail?')) return
    await fetch(`${API}/trades/details/${id}`, { method: 'DELETE' })
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  const addNewDetail = async () => {
    const newDetail = {
      trade_id: selectedTrade.id,
      dateTime: new Date().toISOString(),
      reference: '',
      market: selectedTrade.market,
      tradeCcy: 'GBP',
      buySell: 'Buy',
      orderType: 'Market',
      quantity: 0,
      price: 0,
      spread: 0,
      openClose: 'Open'
    }
    const res = await fetch(`${API}/trades/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newDetail)
    })
    const created = await res.json()
    const updated = await fetch(`${API}/trades/${selectedTrade.id}`).then(r => r.json())
    setSelectedTrade(updated)
  }

  const removeTagFromTrade = async (tagId) => {
    if (!selectedTrade) return
    await fetch(`${API}/trades/${selectedTrade.id}/tags/${tagId}`, { method: 'DELETE' })
    fetchTags()
    fetchTrades()

    // Force fresh fetch with cache buster
    const updated = await fetch(`${API}/trades/${selectedTrade.id}?t=${Date.now()}`).then(r => r.json())
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

      {/* Date Filter + Paste Button */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        {(from || to) && (
          <button onClick={() => { setFrom(''); setTo(''); }} style={{ fontSize: 12 }}>
            Clear Dates
          </button>
        )}
        <button onClick={fetchTrades}>Apply</button>
        <button onClick={() => setShowPasteModal(true)} style={{ background: '#10b981', color: 'white' }}>
          Paste Trades from Statement
        </button>
      </div>

      {/* Manage Tags Button + Tag Filter */}
      <div style={{ marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={() => setShowTagsModal(true)}>Manage Tags</button>

        {Array.isArray(allTags) && allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {allTags.map(tag => {
              const isSelected = selectedFilterTags.includes(tag.name)
              return (
                <span
                  key={tag.id}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedFilterTags(selectedFilterTags.filter(t => t !== tag.name))
                    } else {
                      setSelectedFilterTags([...selectedFilterTags, tag.name])
                    }
                  }}
                  style={{
                    background: isSelected ? '#3b82f6' : '#eee',
                    color: isSelected ? 'white' : 'black',
                    padding: '4px 10px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontSize: 13
                  }}
                >
                  {tag.name}
                </span>
              )
            })}
          </div>
        )}
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

      {/* P&L by Hour + Day of Week Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
        <div>
          <h3>P&amp;L by Hour (07:00 – 17:00)</h3>
          <Bar 
            data={{
              labels: Object.keys(analytics.plByHour),
              datasets: [{
                label: 'P&L',
                data: Object.values(analytics.plByHour),
                backgroundColor: Object.values(analytics.plByHour).map(v => v >= 0 ? '#10b981' : '#ef4444')
              }]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
        <div>
          <h3>P&amp;L by Day of Week</h3>
          <Bar 
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
              datasets: [{
                label: 'P&L',
                data: calculatePlByDayOfWeek(trades),
                backgroundColor: '#3b82f6'
              }]
            }}
            options={{ responsive: true, plugins: { legend: { display: false } } }}
          />
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div style={{ marginBottom: 30, padding: 16, background: '#f8f9fa', borderRadius: 8 }}>
        <h3 style={{ marginTop: 0 }}>Analytics</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {/* Overall P&L */}
          <div>
            <strong>Overall P&amp;L:</strong> {(analytics.plByDirection.buy + analytics.plByDirection.sell).toFixed(2)}
          </div>

          {/* Win Rate */}
          <div>
            <strong>Win Rate:</strong> {analytics.winRate}%
          </div>

          {/* Average Win / Loss */}
          <div>
            <strong>Avg Win:</strong> {analytics.avgWin} &nbsp;&nbsp;
            <strong>Avg Loss:</strong> {analytics.avgLoss}
          </div>
        </div>

        {/* Buy vs Sell P&L */}
        <div style={{ marginTop: 20 }}>
          <strong>Buy P&amp;L:</strong> {analytics.plByDirection.buy} &nbsp;&nbsp;
          <strong>Sell P&amp;L:</strong> {analytics.plByDirection.sell}
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
              <strong>Trade Details:</strong>
              {selectedTrade.TradeDetails?.map(d => (
                <div key={d.id} style={{ border: '1px solid #ddd', padding: 8, margin: '6px 0', borderRadius: 4 }}>
                  {editingDetail?.id === d.id ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <input type="datetime-local" value={editingDetail.dateTime?.slice(0,16)} onChange={e => setEditingDetail({...editingDetail, dateTime: e.target.value})} />
                      <input value={editingDetail.reference} onChange={e => setEditingDetail({...editingDetail, reference: e.target.value})} />
                      <input value={editingDetail.market} onChange={e => setEditingDetail({...editingDetail, market: e.target.value})} />
                      <select value={editingDetail.buySell} onChange={e => setEditingDetail({...editingDetail, buySell: e.target.value})}>
                        <option>Buy</option><option>Sell</option>
                      </select>
                      <input type="number" step="0.01" value={editingDetail.quantity} onChange={e => setEditingDetail({...editingDetail, quantity: e.target.value})} />
                      <input type="number" step="0.0001" value={editingDetail.price} onChange={e => setEditingDetail({...editingDetail, price: e.target.value})} />
                      <button onClick={() => saveDetail(editingDetail)}>Save</button>
                      <button onClick={() => setEditingDetail(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>
                        {new Date(d.dateTime).toLocaleString()} — {d.buySell} {d.quantity} @ {d.price} ({d.openClose})
                      </span>
                      <span>
                        <button onClick={() => setEditingDetail({...d})}>Edit</button>
                        <button onClick={() => deleteDetail(d.id)} style={{ marginLeft: 4, color: 'red' }}>Delete</button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
              <button onClick={addNewDetail} style={{ marginTop: 8 }}>+ Add New Detail</button>
            </div>

            <div style={{ marginTop: 16 }}>
              <strong>Tags on this Trade:</strong>
              <div style={{ margin: '6px 0' }}>
                {selectedTrade.Tags?.length > 0 ? (
                  selectedTrade.Tags.map(tag => (
                    <span key={tag.id} style={{ background: '#eee', padding: '2px 6px', marginRight: 6, borderRadius: 3 }}>
                      {tag.name} <button onClick={() => removeTagFromTrade(tag.id)} style={{ color: '#666', border: 'none', background: 'none' }}>×</button>
                    </span>
                  ))
                ) : (
                  <span style={{ color: '#666' }}>No tags</span>
                )}
              </div>

              <input 
                value={tagInput} 
                onChange={e => setTagInput(e.target.value)} 
                placeholder="Add tag..." 
                list="tag-suggestions"
              />
              <datalist id="tag-suggestions">
                {Array.isArray(allTags) && allTags.map(tag => <option key={tag.id} value={tag.name} />)}
              </datalist>
              <button onClick={() => addTag(tagInput)} style={{ marginLeft: 8 }}>Add</button>
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

      {/* Tags Management Modal */}
      {showTagsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 24, width: 400, borderRadius: 8 }}>
            <h3>Manage Tags</h3>
            <div style={{ maxHeight: 300, overflowY: 'auto', margin: '12px 0' }}>
              {allTags.length > 0 ? allTags.map(tag => (
                <div key={tag.id} style={{ padding: '4px 0', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                  {tag.name}
                  <button onClick={async () => {
                    await fetch(`${API}/trades/tags/${tag.id}`, { method: 'DELETE' })
                    fetchTags()
                  }} style={{ color: 'red' }}>Delete</button>
                </div>
              )) : <div style={{ color: '#666' }}>No tags yet</div>}
            </div>
            <button onClick={() => setShowTagsModal(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Paste Modal */}
      {showPasteModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', padding: 24, width: 520, borderRadius: 8 }}>
            <h3 style={{ marginTop: 0 }}>Paste Trades from Statement</h3>
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste lines here..."
              style={{ width: '100%', height: 200, fontFamily: 'monospace', fontSize: 13 }}
            />
            <div style={{ marginTop: 16, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowPasteModal(false); setPasteText('') }}>Cancel</button>
              <button onClick={handlePasteSubmit} style={{ background: '#10b981', color: 'white' }}>Import Trades</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App