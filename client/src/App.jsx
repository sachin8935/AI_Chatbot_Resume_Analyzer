import { useEffect, useRef, useState } from 'react'
import './App.css'

const SESSION_KEY = 'resume_chat_session'
const SESSION_LIFETIME = 60 * 60 + 10
const RESUME_CONTEXT_MESSAGES = 2

const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, options)
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    try {
      const error = await response.json()
      message = error.detail || message
    } catch {
      // Keep the friendly fallback for non-JSON API errors.
    }
    throw new Error(message)
  }
  return response
}

const saveSession = (sessionId) => {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    id: sessionId,
    expiresAt: Date.now() + SESSION_LIFETIME * 1000,
  }))
}

const readSession = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(SESSION_KEY))
    if (!stored?.id || stored.expiresAt <= Date.now()) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return stored
  } catch {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
}

const historyFromResponse = (data) => {
  if (!data) return []
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    if (!Array.isArray(parsed)) return []

    // The first two entries are model context: system instructions and the uploaded resume.
    return parsed
      .slice(RESUME_CONTEXT_MESSAGES)
      .filter((item) => item.role === 'user' || item.role === 'assistant')
  } catch {
    return []
  }
}

const responseHasPreparedResume = (data) => {
  if (!data) return false
  try {
    const parsed = typeof data === 'string' ? JSON.parse(data) : data
    return Array.isArray(parsed)
  } catch {
    return false
  }
}

function App() {
  const [email, setEmail] = useState('')
  const [session, setSession] = useState(null)
  const [file, setFile] = useState(null)
  const [isPrepared, setIsPrepared] = useState(false)
  const [messages, setMessages] = useState([])
  const [prompt, setPrompt] = useState('')
  const [isLoading, setIsLoading] = useState(() => Boolean(readSession()))
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [isPreparing, setIsPreparing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const stored = readSession()
    if (!stored) {
      return
    }

    apiRequest(`/validate-session?session_id=${encodeURIComponent(stored.id)}`, { method: 'POST' })
      .then(async (response) => {
        const result = await response.json()
        setSession(stored.id)
        setMessages(historyFromResponse(result.data))
        setIsPrepared(responseHasPreparedResume(result.data))
      })
      .catch(() => localStorage.removeItem(SESSION_KEY))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const createSession = async (event) => {
    event.preventDefault()
    if (!email.trim()) return
    setError('')
    setIsSigningIn(true)
    try {
      const response = await apiRequest('/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const result = await response.json()
      saveSession(result.data)
      setSession(result.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSigningIn(false)
    }
  }

  const prepareChat = async () => {
    if (!file || !session) return
    setError('')
    setIsPreparing(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', session)
      await apiRequest('/prepare-chat', { method: 'POST', body: formData })
      setMessages([])
      setIsPrepared(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsPreparing(false)
    }
  }

  const sendMessage = async (event) => {
    event.preventDefault()
    const text = prompt.trim()
    if (!text || !session || isSending) return
    setPrompt('')
    setError('')
    setMessages((current) => [...current, { role: 'user', content: text }, { role: 'assistant', content: '' }])
    setIsSending(true)
    try {
      const response = await apiRequest('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: session, prompt: text }),
      })
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let answer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        answer += decoder.decode(value, { stream: true })
        setMessages((current) => current.map((message, index) => (
          index === current.length - 1 ? { ...message, content: answer } : message
        )))
      }
    } catch (requestError) {
      setMessages((current) => current.slice(0, -1))
      setError(requestError.message)
    } finally {
      setIsSending(false)
    }
  }

  const selectFile = (selectedFile) => {
    if (!selectedFile) return
    if (selectedFile.type !== 'application/pdf') {
      setError('Please choose a PDF file.')
      return
    }
    setError('')
    setFile(selectedFile)
    setIsPrepared(false)
    setMessages([])
  }

  if (isLoading) {
    return <main className="loading-screen"><span className="loader" /> Restoring your workspace...</main>
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">RC</div>
          <p className="eyebrow">RESUME CHATBOT</p>
          <h1>Your resume,<br /><em>in conversation.</em></h1>
          <p className="auth-copy">Upload your resume and get thoughtful, instant answers about your experience.</p>
          <form onSubmit={createSession} className="email-form">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required autoFocus />
            <button type="submit" disabled={isSigningIn}>{isSigningIn ? 'Opening workspace...' : 'Continue to workspace'} <span aria-hidden="true">→</span></button>
          </form>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="privacy-note">Your session stays private and expires after one hour.</p>
        </section>
        <aside className="auth-aside"><span>01</span><p>Ask better questions.<br /><strong>Know your story.</strong></p></aside>
      </main>
    )
  }

  const hasResume = Boolean(file)

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark small">RC</div><span>resume / chat</span></div>
        <div className="session-status"><span className="status-dot" /> Session active</div>
      </header>
      <div className="workspace">
        <aside className="setup-panel">
          <div><p className="eyebrow">WORKSPACE</p><h2>Bring your<br /><em>experience</em> to life.</h2></div>
          <div className="step-list">
            <div className="step complete"><span>01</span><div><strong>Session created</strong><small>{email || 'Private workspace'}</small></div></div>
            <div className={`step ${hasResume ? 'complete' : 'active'}`}><span>02</span><div><strong>Upload resume</strong><small>{hasResume ? 'Ready to prepare' : 'PDF format only'}</small></div></div>
            <div className={`step ${hasResume && !isPreparing ? 'active' : ''}`}><span>03</span><div><strong>Start asking</strong><small>{hasResume ? 'Your AI reader is ready' : 'Unlocks after upload'}</small></div></div>
          </div>
          <div className="upload-area">
            <input ref={fileInputRef} type="file" accept="application/pdf" onChange={(event) => selectFile(event.target.files[0])} />
            <button className="dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
              <span className="upload-icon">↑</span>
              <strong>{isPrepared ? 'Upload new resume' : file ? 'Resume selected' : 'Choose a PDF'}</strong>
              <small>{file ? file.name : 'or drop it here'}</small>
            </button>
            {hasResume && !isPrepared && <button className="prepare-button" type="button" onClick={prepareChat} disabled={isPreparing}>{isPreparing ? 'Reading your resume...' : 'Prepare chat'} <span>↗</span></button>}
          </div>
          {error && <p className="error-message" role="alert">{error}</p>}
          <p className="aside-footer">Session encrypted locally<br />No resume data is stored here.</p>
        </aside>
        <section className="chat-panel">
          <div className="chat-heading"><div><p className="eyebrow">YOUR RESUME READER</p><h1>What would you like to know?</h1></div><span className="chat-count">{messages.length ? `${messages.length} messages` : 'New conversation'}</span></div>
          <div className="messages" aria-live="polite">
            {!messages.length && <div className="empty-state"><div className="quote-mark">“</div><p>Ask about strengths, experience,<br />or the story your resume tells.</p><span>Start with a question below</span></div>}
            {messages.map((message, index) => <div className={`message ${message.role}`} key={`${message.role}-${index}`}><span className="message-label">{message.role === 'user' ? 'You' : 'Reader'}</span><p>{message.content || <span className="typing"><i /><i /><i /></span>}</p></div>)}
            <div ref={messagesEndRef} />
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={isPrepared ? 'Ask anything about your resume...' : 'Upload and prepare your resume to begin'} disabled={!isPrepared || isSending} />
            <button type="submit" aria-label="Send message" disabled={!isPrepared || !prompt.trim() || isSending}>↑</button>
          </form>
          <p className="chat-disclaimer">AI can make mistakes. Check important details against your original resume.</p>
        </section>
      </div>
    </main>
  )
}

export default App
