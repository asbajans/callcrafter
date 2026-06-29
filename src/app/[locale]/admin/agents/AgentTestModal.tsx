'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Mic, MicOff, Volume2, Loader2, Bot, User, Phone, PhoneOff } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Agent {
  id: number | string
  name: string
  model?: string | null
  voice?: string | null
  ttsProvider?: string | null
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
  const [inCall, setInCall] = useState(false)
  const [statusText, setStatusText] = useState('')
  const chatRef = useRef<HTMLDivElement>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const speechBufferRef = useRef<Blob[]>([])
  const isSpeakingRef = useRef(false)
  const silenceStartRef = useRef(0)
  const listeningRef = useRef(false)
  const vadIntervalRef = useRef<any>(null)

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    return () => {
      cleanupCall()
    }
  }, [])

  const cleanupCall = () => {
    if (vadIntervalRef.current) clearInterval(vadIntervalRef.current)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    if (audioContextRef.current) audioContextRef.current.close()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    setInCall(false)
    setStatusText('')
    listeningRef.current = false
  }

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || sending) return
    const userMsg: Message = { role: 'user', content: text }
    setMessages(prev => [...prev, userMsg])
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
      return data.response
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }])
      return null
    } finally {
      setSending(false)
    }
  }, [agent.id, messages, sending])

  const speakViaTTS = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      const voiceId = agent.voice || 'tr_TR-dfki-medium'
      const ttsProvider = agent.ttsProvider || 'auto'
      const cleanText = text
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()
      if (!cleanText) { resolve(); return }
      setStatusText('Yanıt seslendiriliyor...')
      fetch(`/api/voices/tts?voice=${encodeURIComponent(voiceId)}&text=${encodeURIComponent(cleanText)}&provider=${encodeURIComponent(ttsProvider)}`)
        .then(res => {
          if (!res.ok) throw new Error('TTS failed')
          return res.blob()
        })
        .then(audioBlob => {
          const url = URL.createObjectURL(audioBlob)
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
          audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve() }
          audio.play()
        })
        .catch((err) => {
          console.error('TTS playback error:', err)
          setStatusText('Seslendirme hatası')
          setTimeout(() => { if (inCall) { setStatusText('Dinliyor...'); listeningRef.current = true } }, 1500)
          resolve()
        })
    })
  }

  const startVAD = () => {
    const analyser = analyserRef.current!
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const SILENCE_THRESHOLD = 30
    const SILENCE_TIMEOUT = 1500

    isSpeakingRef.current = false
    silenceStartRef.current = 0
    speechBufferRef.current = []

    vadIntervalRef.current = setInterval(() => {
      if (!listeningRef.current || !analyser) return

      analyser.getByteTimeDomainData(dataArray)
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        const value = (dataArray[i] - 128) / 128
        sum += value * value
      }
      const rms = Math.sqrt(sum / bufferLength)

      if (rms > SILENCE_THRESHOLD / 128) {
        if (!isSpeakingRef.current) {
          isSpeakingRef.current = true
          setStatusText('Dinliyor...')
          speechBufferRef.current = []
        }
        silenceStartRef.current = 0
      } else if (isSpeakingRef.current) {
        if (silenceStartRef.current === 0) {
          silenceStartRef.current = Date.now()
        } else if (Date.now() - silenceStartRef.current > SILENCE_TIMEOUT) {
          isSpeakingRef.current = false
          silenceStartRef.current = 0
          const chunks = [...speechBufferRef.current]
          speechBufferRef.current = []
          if (chunks.length > 0) {
            processSpeechChunks(chunks)
          }
        }
      }
    }, 150)
  }

  const processSpeechChunks = async (chunks: Blob[]) => {
    listeningRef.current = false
    setStatusText('Konuşmanız işleniyor...')
    setSending(true)

    try {
      const audioBlob = new Blob(chunks, { type: 'audio/webm' })
      const formData = new FormData()
      formData.append('audio', audioBlob, 'speech.webm')

      const sttRes = await fetch('/api/stt/transcribe', {
        method: 'POST',
        body: formData,
      })
      const sttData = await sttRes.json()
      if (!sttRes.ok) throw new Error(sttData.error || 'STT failed')

      const transcript = sttData.text?.trim()
      if (!transcript) {
        setStatusText('Ses algılanamadı, dinliyor...')
        listeningRef.current = true
        setSending(false)
        return
      }

      const userMsg: Message = { role: 'user', content: transcript }
      setMessages(prev => [...prev, userMsg])

      setStatusText('AI yanıtı bekleniyor...')
      const response = await sendMessage(transcript)

      if (response && inCall) {
        await speakViaTTS(response)
      }

      if (inCall) {
        setStatusText('Dinliyor...')
        listeningRef.current = true
      } else {
        setStatusText('')
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Hata: ${err.message}` }])
      if (inCall) {
        setStatusText('Dinliyor...')
        listeningRef.current = true
      } else {
        setStatusText('')
      }
    } finally {
      setSending(false)
    }
  }

  const startCall = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0 && listeningRef.current) {
          speechBufferRef.current.push(e.data)
        }
      }
      mediaRecorder.start(200)
      mediaRecorderRef.current = mediaRecorder

      setInCall(true)
      setMessages([])
      listeningRef.current = true
      setStatusText('Dinliyor...')

      startVAD()

      const greeting = await sendMessage('Merhaba')
      if (greeting && !sending) {
        await speakViaTTS(greeting)
        if (inCall) {
          setStatusText('Dinliyor...')
          listeningRef.current = true
        }
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Mikrofon hatası: ${err.message}` }])
      cleanupCall()
    }
  }

  const endCall = () => {
    cleanupCall()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
      setInput('')
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
              <p>{tab === 'voice' ? 'Telefon butonuna basarak aramayı başlatın' : 'Asistanla konuşmaya başlamak için mesaj yazın'}</p>
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
              onClick={() => { sendMessage(input); setInput('') }}
              disabled={sending || !input.trim()}
              className="px-3 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="border-t border-slate-200 p-4">
            {!inCall ? (
              <div className="flex flex-col items-center gap-3">
                <button
                  onClick={startCall}
                  className="p-5 rounded-full bg-green-500 text-white hover:bg-green-600 transition-all shadow-lg hover:shadow-xl"
                  title="Aramayı Başlat"
                >
                  <Phone className="w-7 h-7" />
                </button>
                <span className="text-xs text-slate-400">Aramayı başlatmak için tıklayın</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-indigo-600 font-medium">
                  {statusText && (
                    <>
                      {statusText === 'Dinliyor...' && <Mic className="w-4 h-4 animate-pulse" />}
                      {statusText === 'Yanıt seslendiriliyor...' && <Volume2 className="w-4 h-4 animate-pulse" />}
                      <span>{statusText}</span>
                    </>
                  )}
                </div>
                <button
                  onClick={endCall}
                  className="p-4 rounded-full bg-red-500 text-white hover:bg-red-600 transition-all shadow-lg"
                  title="Aramayı Sonlandır"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
                <span className="text-xs text-red-400">Görüşmeyi sonlandır</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
