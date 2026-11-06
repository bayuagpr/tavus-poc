import { useState } from 'react'
import { HairCheck } from './components/cvi/components/hair-check'
import { Conversation } from './components/cvi/components/conversation'

export default function App() {
  const [url, setUrl] = useState('')
  const [screen, setScreen] = useState<'url' | 'check' | 'call' | 'demo'>(new URLSearchParams(window.location.search).has('demo') ? 'demo' : 'url')
  return <main>
    {screen === 'url' && <form style={{ display: 'grid', gap: 20, maxWidth: 720, margin: '40px auto' }} onSubmit={event => {
      event.preventDefault()
      setScreen('check')
    }}>
      <h1>Tavus conversation POC</h1>
      <p>Create a session through your backend, then paste its conversationUrl.</p>
      <label htmlFor="url">Conversation URL</label>
      <input id="url" type="url" required pattern="https://.*" autoComplete="off" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://tavus.daily.co/..." style={{ padding: 14, width: '100%', font: 'inherit' }} />
      <button type="submit" title="Check your devices before joining">Check camera and microphone</button>
      <button type="button" title="Preview the conversation without a live session" onClick={() => setScreen('demo')}>Preview conversation UI (demo)</button>
      <p>No API key needed. This joins an existing conversation. Leaving disconnects you; it does not end the backend session.</p>
    </form>}
    {screen === 'check' && <HairCheck isJoinBtnLoading={false} onJoin={() => setScreen('call')} onCancel={() => setScreen('url')} />}
    {screen === 'demo' && <Conversation demo conversationUrl="" onLeave={() => setScreen('url')} />}
    {screen === 'call' && <div style={{ width: '100%', height: '85vh', minHeight: 480 }}><Conversation conversationUrl={url.trim()} onLeave={() => setScreen('url')} /></div>}
  </main>
}
