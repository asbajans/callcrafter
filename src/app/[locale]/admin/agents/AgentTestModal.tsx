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
  voice?: string | null
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
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const chatRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
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
      if (tab === 'voice') speakViaTTS(data.response)
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
    } finally {
      setSending(false)
    }
  }, [agent.id, messages, sending, tab])

  const speakViaTTS = async (text: string) => {
    const voiceId = agent.voice || 'tr_TR-female-medium'
    try {
      setPlaying(true)
      const res = await fetch(`/api/voices/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(text)}`)
      if (!res.ok) throw new Error('TTS failed')
      const audioBlob = await res.blob()
      const url = URL.createObjectURL(audioBlob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setPlaying(false); URL.revokeObjectURL(url) }
      audio.onerror = () => { setPlaying(false); URL.revokeObjectURL(url) }
      audio.play()
    } catch {
      setPlaying(false)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunksRef.current = []
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        setRecording(false)
        await transcribeAudio(audioBlob)
      }
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setRecording(true)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Mikrofon erişimi reddedildi. Tarayıcı ayarlarından izin verin.' }])
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
  }

  const transcribeAudio = async (audioBlob: Blob) => {
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      const res = await fetch('/api/stt/transcribe', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Transcription failed')
      if (data.text?.trim()) {
        await sendMessage(data.text)
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'Ses algılanamadı, lütfen tekrar deneyin.' }])
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `STT hatası: ${err.message}` }])
    } finally {
      setSending(false)
    }
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
              onClick={recording ? stopRecording : startRecording}
              disabled={sending}
              className={`p-4 rounded-full transition-all ${recording ? 'bg-red-500 text-white scale-110 animate-pulse' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}
              title={recording ? 'Kaydı durdur' : 'Konuşmak için basılı tut'}
            >
              {recording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>
            {playing && (
              <div className="flex items-center gap-2 text-sm text-indigo-500">
                <Volume2 className="w-4 h-4 animate-pulse" />
                Yanıt çalınıyor...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
