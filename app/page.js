'use client';

import { useState, useEffect, useRef } from 'react';

export default function Dashboard() {
  // Device Selection States
  const [audioDevices, setAudioDevices] = useState([]);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedAudio, setSelectedAudio] = useState('');
  const [selectedVideo, setSelectedVideo] = useState('');

  // Mode & Source States
  const [selectedMode, setSelectedMode] = useState('admin');
  const jsonFiles = [
    { name: 'សំណួរ Set 1 (ប្រវត្តិសាស្ត្រ)', path: '/data/questions_set1.json' },
    { name: 'សំណួរ Set 2 (បច្ចេកវិទ្យា)', path: '/data/questions_set2.json' }
  ];
  const [selectedFile, setSelectedFile] = useState(jsonFiles[0].path);
  const [inputText, setInputText] = useState('');

  // Queue & Runtime States
  const [questions, setQuestions] = useState([
    "តើប្រាសាទអង្គរវត្តស្ថិតនៅឯណា?",
    "តើវាស្ថិតនៅក្នុងខេត្តណា និងទ្វីបណាដែរ?",
    "តើប្រាសាទនេះត្រូវបានកសាងឡើងនៅក្នុងសតវត្សរ៍ទីប៉ុន្មាន?"
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [status, setStatus] = useState("ប្រព័ន្ធត្រៀមរួចរាល់");
  const [aiResponse, setAiResponse] = useState("");
  const [finalAnswerBadge, setFinalAnswerBadge] = useState(null);

  // References
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timeoutRef = useRef(null);

  // 1. Get List of Microphones & Webcams
  useEffect(() => {
    async function getDevices() {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        const audioInputs = devices.filter(d => d.kind === 'audioinput');
        const videoInputs = devices.filter(d => d.kind === 'videoinput');
        
        setAudioDevices(audioInputs);
        setVideoDevices(videoInputs);

        if (audioInputs.length > 0) setSelectedAudio(audioInputs[0].deviceId);
        if (videoInputs.length > 0) setSelectedVideo(videoInputs[0].deviceId);
      } catch (err) {
        console.error("Device permission error:", err);
        setStatus("⚠️ សូមអនុញ្ញាតឱ្យប្រើ Webcam & Microphone");
      }
    }
    getDevices();
  }, []);

  // 2. Initialize / Switch Media Stream
  useEffect(() => {
    async function setupStream() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      try {
        const constraints = {
          audio: selectedAudio ? { deviceId: { exact: selectedAudio } } : true,
          video: selectedVideo ? { deviceId: { exact: selectedVideo }, width: 640, height: 480 } : true
        };
        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
        }
      } catch (err) {
        console.error("Media initialization failed:", err);
      }
    }

    if (selectedAudio || selectedVideo) {
      setupStream();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedAudio, selectedVideo]);

  // 3. Mode Selection Handlers
  const handleLoadJson = async (filePath) => {
    try {
      setStatus(`កំពុងទាញយក File: ${filePath}...`);
      const res = await fetch(filePath);
      const data = await res.json();
      const formatted = data.map(q => typeof q === 'string' ? q : q.text);
      setQuestions(formatted);
      setCurrentIndex(0);
      setStatus("បានផ្ទុកទិន្នន័យ JSON រួចរាល់!");
    } catch (err) {
      setStatus("❌ បរាជ័យក្នុងការទាញយក File JSON");
    }
  };

  const handleAddAdminText = () => {
    if (!inputText.trim()) return;
    const newLines = inputText.split('\n').filter(q => q.trim() !== "");
    setQuestions(prev => [...prev, ...newLines]);
    setInputText("");
    setStatus(`✅ បានបន្ថែម ${newLines.length} សំណួរចូលក្នុង Queue`);
  };

  // 4. Navigation & Signal Handling
  const handleSkipNext = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (currentIndex + 1 < questions.length) {
      setStatus("⏩ កំពុងប្ដូរទៅសំណួរបន្ទាប់...");
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsPlaying(false);
      setStatus("🎉 បានបញ្ចប់សំណួរទាំងអស់ក្នុង Queue!");
    }
  };

  const sendQuestion = (text) => {
    setStatus(`⚡ កំពុងផ្សាយ Gibberlink សំណួរទី ${currentIndex + 1}...`);
    setAiResponse("");
    setFinalAnswerBadge(null);

    // Timeout: Retry or skip if dead signal for 4 seconds
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStatus("⚠️ ដាច់ Signal! កំពុង Skip ស្វ័យប្រវត្តិ...");
      handleSkipNext();
    }, 4000);
  };

  const handleIncomingAnswer = (payload) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setAiResponse(payload.rawText || JSON.stringify(payload));
    
    // Display Final Answer onto the Camera Output HUD
    if (payload.isCompleted) {
      setFinalAnswerBadge(payload.answerText || "បានផ្ទៀងផ្ទាត់ចម្លើយត្រឹមត្រូវ (Verified)");
      setStatus("✅ ទទួលបានចម្លើយផ្លូវការ!");

      setTimeout(() => {
        handleSkipNext();
      }, 1200);
    }
  };

  useEffect(() => {
    if (isPlaying && questions.length > 0 && currentIndex < questions.length) {
      sendQuestion(questions[currentIndex]);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [currentIndex, isPlaying]);

  return (
    <div style={{ maxWidth: '1100px', margin: 'auto', padding: '24px' }}>
      <header style={{ marginBottom: '20px', borderBottom: '1px solid #334155', paddingBottom: '12px' }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#38bdf8' }}>AI Gibberlink Vision & Sound Node</h1>
        <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
          Autonomous Sound Acoustic Link with Video HUD Integration
        </p>
      </header>

      {/* Grid: Settings & Webcam */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        
        {/* Left Column: Device & Queue Settings */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Hardware Device Pickers */}
          <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#e2e8f0' }}>🎙️ ជ្រើសរើស Hardware Devices</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Microphone:</label>
                <select 
                  value={selectedAudio} 
                  onChange={(e) => setSelectedAudio(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                >
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Mic (${d.deviceId.slice(0, 8)})`}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>Webcam:</label>
                <select 
                  value={selectedVideo} 
                  onChange={(e) => setSelectedVideo(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                >
                  {videoDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera (${d.deviceId.slice(0, 8)})`}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Question Source Selection */}
          <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px' }}>
            <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#e2e8f0' }}>📂 កំណត់ប្រភពសំណួរ (Input Source)</h3>
            <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', fontSize: '14px' }}>
              <label style={{ cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="source" 
                  checked={selectedMode === 'admin'} 
                  onChange={() => setSelectedMode('admin')} 
                /> Option 1: Custom Text
              </label>
              <label style={{ cursor: 'pointer' }}>
                <input 
                  type="radio" 
                  name="source" 
                  checked={selectedMode === 'json'} 
                  onChange={() => setSelectedMode('json')} 
                /> Option 2: JSON File
              </label>
            </div>

            {selectedMode === 'admin' ? (
              <div>
                <textarea
                  rows={3}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Paste សំណួរ (ចុះបន្ទាត់ដើម្បីបំបែកសំណួរ)..."
                  style={{ width: '95%', padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#fff', border: '1px solid #475569', fontSize: '13px' }}
                />
                <button
                  onClick={handleAddAdminText}
                  style={{ marginTop: '6px', padding: '6px 14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  + បញ្ចូលទៅ Queue
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select 
                  value={selectedFile} 
                  onChange={(e) => setSelectedFile(e.target.value)}
                  style={{ flex: 1, padding: '8px', borderRadius: '4px', background: '#0f172a', color: '#fff', border: '1px solid #475569' }}
                >
                  {jsonFiles.map((file, idx) => (
                    <option key={idx} value={file.path}>{file.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => handleLoadJson(selectedFile)}
                  style={{ padding: '8px 12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Load JSON
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Video HUD & Live Overlay */}
        <div style={{ background: '#1e293b', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#e2e8f0' }}>📹 កញ្ចក់កាមេរ៉ា & Visual HUD</h3>
          
          <div style={{ position: 'relative', width: '100%', height: '280px', background: '#000', borderRadius: '6px', overflow: 'hidden', border: '1px solid #334155' }}>
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />

            {/* Visual HUD Overlays */}
            <div style={{ position: 'absolute', top: 10, left: 10, background: 'rgba(0,0,0,0.7)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', color: '#38bdf8', border: '1px solid #0284c7' }}>
              REC • {selectedMode.toUpperCase()} MODE
            </div>

            {finalAnswerBadge && (
              <div style={{ position: 'absolute', bottom: 12, left: 12, right: 12, background: 'rgba(15, 23, 42, 0.9)', border: '2px solid #22c55e', padding: '10px', borderRadius: '6px', backdropFilter: 'blur(4px)' }}>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#4ade80', display: 'block', fontWeight: 'bold' }}>
                  🎯 ផ្ទៀងផ្ទាត់ចម្លើយចុងក្រោយ (Final Answer):
                </span>
                <span style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold' }}>
                  {finalAnswerBadge}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Bottom Control & Telemetry Panel */}
      <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#38bdf8' }}>
            សំណួរទី ({questions.length > 0 ? currentIndex + 1 : 0}/{questions.length})
          </span>
          <span style={{ background: '#334155', padding: '4px 10px', borderRadius: '20px', fontSize: '12px' }}>
            ស្ថានភាព: {status}
          </span>
        </div>

        <div style={{ margin: '14px 0', padding: '14px', background: '#0f172a', borderRadius: '6px', borderLeft: '4px solid #38bdf8' }}>
          <p style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: '#f1f5f9' }}>
            {questions[currentIndex] || "គ្មានសំណួរនៅក្នុង Queue ឡើយ"}
          </p>
        </div>

        <div>
          <label style={{ fontSize: '12px', color: '#94a3b8' }}>ទិន្នន័យ Gibberlink សំឡេង (Hex/Decoded Stream):</label>
          <div style={{ background: '#020617', border: '1px solid #1e293b', color: '#4ade80', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', minHeight: '40px', marginTop: '4px' }}>
            {aiResponse || "// រង់ចាំសញ្ញា Sound Link..."}
          </div>
        </div>

        {/* Buttons Controls */}
        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{ padding: '10px 24px', background: isPlaying ? '#ef4444' : '#0284c7', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            {isPlaying ? "បញ្ឈប់ (Pause)" : "ចាប់ផ្ដើម Loop (Start)"}
          </button>

          <button
            onClick={handleSkipNext}
            disabled={!isPlaying}
            style={{ padding: '10px 20px', background: '#eab308', color: '#0f172a', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: isPlaying ? 'pointer' : 'not-allowed' }}
          >
            ⏭️ Skip Next
          </button>

          {isPlaying && (
            <button
              onClick={() => handleIncomingAnswer({ isCompleted: true, rawText: '{"status":"200","data":"ok"}', answerText: 'ប្រាសាទអង្គរវត្តស្ថិតនៅក្នុងខេត្តសៀមរាប ប្រទេសកម្ពុជា។' })}
              style={{ marginLeft: 'auto', padding: '10px 16px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
            >
              [Test] Simulate AI Answer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
