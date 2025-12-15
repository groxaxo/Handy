import { useState, useEffect, useRef, useCallback } from 'react';
import './Chatbox.css';

interface Message {
  id: string;
  text: string;
  timestamp: Date;
  type: 'user' | 'system';
  isPartial?: boolean;
}

export default function Chatbox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [partialText, setPartialText] = useState('');
  const [volume, setVolume] = useState(0);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [theme, setTheme] = useState<'classic' | 'retro' | 'dark'>('retro');
  const [error, setError] = useState('');
  
  const ws = useRef<WebSocket | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioChunks = useRef<Blob[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      // For Cloudflare deployment, replace with your actual WebSocket endpoint
      const wsUrl = window.location.hostname === 'localhost' 
        ? 'ws://localhost:8000/ws'
        : `wss://948874391e98.ngrok-free.app/ws`; // Replace with actual ngrok URL
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        setError('');
        addMessage('Connected to transcription server', 'system');
      };
      
      ws.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'partial') {
          setPartialText(data.text);
        } else if (data.type === 'final') {
          if (data.text.trim()) {
            addMessage(data.text, 'user');
          }
          setPartialText('');
        }
      };
      
      ws.current.onclose = () => {
        setIsConnected(false);
        addMessage('Disconnected from transcription server', 'system');
      };
      
      ws.current.onerror = () => {
        addMessage('WebSocket connection error', 'system');
        setError('Failed to connect to transcription server');
      };
    } catch (error) {
      setError('Failed to create WebSocket connection');
    }
  }, []);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (mediaRecorder.current) {
        mediaRecorder.current.stop();
      }
    };
  }, [connectWebSocket]);

  const addMessage = (text: string, type: 'user' | 'system') => {
    const newMessage: Message = {
      id: Date.now().toString(),
      text,
      timestamp: new Date(),
      type
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const setupAudioAnalyser = (stream: MediaStream) => {
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 256;
      microphone.current = audioContext.current.createMediaStreamSource(stream);
      microphone.current.connect(analyser.current);
      
      const updateVolume = () => {
        if (analyser.current) {
          const dataArray = new Uint8Array(analyser.current.frequencyBinCount);
          analyser.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setVolume(average / 255);
        }
        requestAnimationFrame(updateVolume);
      };
      updateVolume();
    } catch (error) {
      console.error('Audio analyser setup failed:', error);
    }
  };

  const startRecording = async () => {
    try {
      setError('');
      setPartialText('');
      
      // Request microphone access with specific constraints
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      setupAudioAnalyser(stream);
      
      // Try different MIME types for better browser compatibility
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/webm';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'audio/mp4';
      }
      
      mediaRecorder.current = new MediaRecorder(stream, {
        mimeType
      });
      
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.current.push(event.data);
        }
      };
      
      mediaRecorder.current.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunks.current, { type: mimeType });
          const arrayBuffer = await audioBlob.arrayBuffer();
          
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(arrayBuffer);
          }
          
          // Auto-restart for continuous recording
          setTimeout(() => {
            if (isRecording) {
              startRecording();
            }
          }, 100);
        } catch (error) {
          console.error('Audio processing error:', error);
        }
      };
      
      mediaRecorder.current.start(1000); // Record in 1-second chunks
      setIsRecording(true);
      addMessage('🎙️ Recording started... Speak now!', 'system');
      
    } catch (error: any) {
      console.error('Microphone access error:', error);
      
      let errorMessage = 'Failed to access microphone';
      if (error.name === 'NotAllowedError') {
        errorMessage = '🚫 Microphone access denied. Please allow microphone access in your browser settings and refresh the page.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '🎤 No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '🎤 Microphone is already in use by another application.';
      } else {
        errorMessage = `🎤 Microphone error: ${error.message || 'Unknown error'}`;
      }
      
      setError(errorMessage);
      addMessage(errorMessage, 'system');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
      mediaRecorder.current.stop();
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
    
    if (audioContext.current) {
      audioContext.current.close();
    }
    
    if (microphone.current) {
      microphone.current.disconnect();
    }
    
    setIsRecording(false);
    setVolume(0);
    setPartialText('');
    addMessage('🔇 Recording stopped', 'system');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Request microphone permission on component mount
  useEffect(() => {
    const requestPermission = async () => {
      try {
        const result = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        if (result.state === 'denied') {
          setError('🚫 Microphone permission denied. Please enable microphone access in your browser settings.');
        }
      } catch (error) {
        // Permission API not supported, ignore
      }
    };
    requestPermission();
  }, []);

  return (
    <div className={`chatbox-container ${theme}`}>
      <div className="chat-header">
        <h1>📟 Handy Voice Chat</h1>
        <div className="status-bar">
          <span className={`status-indicator ${isConnected ? 'online' : 'offline'}`}>
            {isConnected ? '🟢 Online' : '🔴 Offline'}
          </span>
          {volume > 0 && (
            <span className="volume-indicator">
              🔊 {Math.round(volume * 100)}%
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      <div className="messages-container">
        {messages.length === 0 && (
          <div className="welcome-message">
            <h2>🎙️ Welcome to Handy Voice Chat!</h2>
            <p>Click "Start Recording" to begin voice transcription.</p>
            <p>Make sure you allow microphone access when prompted.</p>
          </div>
        )}
        
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            {showTimestamps && (
              <span className="timestamp">
                [{formatTime(message.timestamp)}]
              </span>
            )}
            <span className="message-text">
              {message.type === 'system' ? '*** ' : ''}
              {message.text}
            </span>
          </div>
        ))}
        
        {partialText && (
          <div className="message user partial">
            {showTimestamps && (
              <span className="timestamp">
                [{formatTime(new Date())}]
              </span>
            )}
            <span className="message-text">
              {partialText}
              <span className="cursor">_</span>
            </span>
          </div>
        )}
        
        {isRecording && (
          <div className="message system recording">
            <span className="recording-indicator">
              🔴 Recording... (Voice: {Math.round(volume * 100)}%)
            </span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="controls">
        <button
          className={`record-btn ${isRecording ? 'recording' : ''}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={error.includes('denied')}
        >
          {isRecording ? '🔴 Stop' : '🎙️ Start'} Recording
        </button>
        
        <div className="theme-selector">
          <label>Theme: </label>
          <select value={theme} onChange={(e) => setTheme(e.target.value as any)}>
            <option value="classic">Classic (2000s)</option>
            <option value="retro">Retro Green</option>
            <option value="dark">Dark Mode</option>
          </select>
        </div>
        
        <div className="options">
          <label>
            <input
              type="checkbox"
              checked={showTimestamps}
              onChange={(e) => setShowTimestamps(e.target.checked)}
            />
            Show timestamps
          </label>
        </div>
      </div>
    </div>
  );
}