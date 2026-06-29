'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Mic, MicOff, Volume2, Loader2, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Agent {
  id: number
  name: string
  model?: string | null
  systemPrompt?: string | null
}

declare global {
  interface Window {
    SpeechRecognition: any
    webkitSpeechRecognition: any
  }
}

export default function AgentTestModal({
  agent,
  defaultTab = 'text',
  onClose,
}: {
  agent: Agent
  defaultTab?: 'text' | 'voice'
  onClose: () => void
}) {
  const [tab, setTab] = useState<'text' | 'voice'>(defaultTab)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (recognitionRef.current) recognitionRef.current.abort()
      if (speechSynthRef.current) window.speechSynthesis.cancel()
    }
  }, [])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agentId: agent.id,
          message: text,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      const assistantMsg: Message = { role: 'assistant', content: data.response }
      setMessages(prev => [...prev, assistantMsg])
      if (tab === 'voice') speakText(data.response)
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setSending(false)
    }
  }, [agent.id, messages, sending, tab])

  const speakText = (text: string) => {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'tr-TR'
    utterance.rate = 1
    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    speechSynthRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Voice recognition not supported in this browser. Use Chrome.' }])
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'tr-TR'
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript
      setListening(false)
      if (transcript.trim()) sendMessage(transcript)
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 text-indigo-500" />
            <div>
              <h3 className="font-semibold text-slate-900 text-sm">{agent.name}</h3>
              <p className="text-xs text-slate-400 font-mono">{agent.model || 'gpt-4o'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setTab('text')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'text' ? 'text-indigo-600 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Yazılı Test
          </button>
          <button
            onClick={() => setTab('voice')}
            className={`flex-1 py-2.5 text-sm font-medium text-center transition-colors ${tab === 'voice' ? 'text-indigo-600 border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Sesli Test
          </button>
        </div>

        <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[400px]">
          {messages.length === 0 && (
            <div className="text-center text-slate-400 text-sm py-12">
              <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>{tab === 'voice' ? 'Mikrofon butonuna basarak konuşmaya başlayın' : 'Asistanla konuşmaya başlamak için mesaj yazın'}</p>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-4 h-4 text-indigo-500" />
                </div>
              )}
              <div className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-indigo-500 text-white rounded-br-md'
                  : 'bg-slate-100 text-slate-800 rounded-bl-md'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-1">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="bg-slate-100 rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {tab === 'text' ? (
          <div className="border-t border-slate-200 p-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mesaj yazın..."
              className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={sending}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-200 p-4 flex items-center justify-center gap-4">
            <button
              onClick={startListening}
              disabled={listening || sending}
              className={`p-4 rounded-full transition-all ${listening ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
              title={listening ? 'Dinliyor...' : 'Konuşmak için tıkla'}
            >
              {listening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {speaking && (
              <div className="flex items-center gap-2 text-sm text-indigo-500">
                <Volume2 className="w-4 h-4 animate-pulse" />
                Yanıt okunuyor...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
