import { useState } from 'react'
import './App.css'

// Priority: VITE_BACKEND_URL > VITE_API_BASE > Default to /api via proxy or direct

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string>('')
  const [, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('IDLE')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Settings state (Internal or hidden now, prioritizing env vars)
  // We keep internal state for API base but remove manual UI as requested
  // Priority: VITE_BACKEND_URL > VITE_API_BASE > Default to /api
  const apiBase = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_BASE || '/api'

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setStatus('IDLE')
      setResultUrl(null)
      setOriginalUrl(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('UPLOADING')
    setError(null)

    const formData = new FormData()
    formData.append('image', file)
    if (inviteCode) {
      formData.append('invite_code', inviteCode)
    }

    try {
      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        let errorMsg = 'Upload failed';
        try {
          const err = await res.json()
          errorMsg = err.error || errorMsg
        } catch (jsonErr) {
          console.error("Failed to parse error response JSON:", jsonErr)
          const text = await res.text().catch(() => '')
          if (text) errorMsg += `: ${text}`
        }
        throw new Error(errorMsg)
      }

      const data = await res.json()
      setTaskId(data.task_id)
      setStatus('PENDING')
      pollStatus(data.task_id)
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('An unknown error occurred')
      }
      setStatus('FAILED')
    }
  }

  const pollStatus = async (tid: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/status/${tid}`)
        const data = await res.json()

        setStatus(data.status)

        if (data.status === 'COMPLETED') {
          clearInterval(interval)
          fetchResult(tid)
        } else if (data.status === 'FAILED') {
          clearInterval(interval)
          let errorMsg = 'Processing failed'
          try {
            const analysisResult = JSON.parse(data.analysis_result || '{}')
            errorMsg = analysisResult.error || analysisResult.issues?.join(', ') || errorMsg
          } catch {
            errorMsg = data.analysis_result || errorMsg
          }
          setError(errorMsg)
        }
      } catch (e) {
        console.error(e)
        // ignore transient errors
      }
    }, 2000)
  }

  const fetchResult = async (tid: string) => {
    try {
      const res = await fetch(`${apiBase}/result/${tid}`)
      const data = await res.json()
      setResultUrl(data.url)
      setOriginalUrl(data.originalUrl)
    } catch (e) {
      console.error(e)
      setError('Failed to fetch result')
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `blessing_${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const getStatusClass = () => {
    return status.toLowerCase()
  }

  const getStatusText = () => {
    const statusMap: Record<string, string> = {
      'IDLE': '',
      'UPLOADING': '📤 Uploading...',
      'PENDING': '⏳ Processing request...',
      'ANALYZING': '🔍 AI analyzing your photo...',
      'GENERATING': '✨ Creating your blessing...',
      'COMPLETED': '🎉 Complete!',
      'FAILED': '❌ Failed'
    }

    // Handle attempt statuses (e.g., GENERATING_ATTEMPT_2)
    if (status.startsWith('GENERATING_ATTEMPT_')) {
      const attempt = status.split('_').pop()
      return `✨ Creating your blessing (Attempt ${attempt})...`
    }
    if (status.startsWith('REVIEWING_ATTEMPT_')) {
      const attempt = status.split('_').pop()
      return `🧐 Expert Reviewing (Attempt ${attempt})...`
    }
    if (status.startsWith('REGENERATING_ATTEMPT_')) {
      const attempt = status.split('_').pop()
      return `🔄 Optimizing details (Attempt ${attempt})...`
    }

    return statusMap[status] || status
  }

  const isProcessing = ['UPLOADING', 'PENDING', 'ANALYZING', 'GENERATING'].includes(status)

  return (
    <>
      {/* Decorative Lanterns */}
      <div className="lantern-left">🏮</div>
      <div className="lantern-right">🏮</div>

      <div className="container">
        <h1>🧧 新年祝福生成器</h1>
        <p className="subtitle">Upload your photo and create a festive Chinese New Year blessing</p>

        <div className="card">
          <div className="upload-section">
            {/* File Upload Area */}
            <div className={`file-input-wrapper ${file ? 'has-file' : ''}`}>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={isProcessing}
              />
              {!preview ? (
                <>
                  <div className="upload-icon">📷</div>
                  <p className="upload-text">
                    Drop your photo here or <span>browse</span>
                  </p>
                </>
              ) : (
                <div className="image-container">
                  <p>Your Photo</p>
                  <img src={preview} alt="Preview" className="preview-img" />
                </div>
              )}
            </div>

            {/* Invite Code Input */}
            <div className="invite-code-section">
              <input
                type="text"
                className="invite-code-input"
                placeholder="Enter invite code (邀请码)"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={isProcessing}
              />
            </div>

            {/* Generate Button */}
            <button
              className="generate-btn"
              onClick={handleUpload}
              disabled={!file || isProcessing}
            >
              {isProcessing ? (
                <>
                  <span className="spinner"></span>
                  &nbsp; Generating...
                </>
              ) : (
                '🎆 Generate Blessing'
              )}
            </button>
          </div>

          {/* Status Section */}
          <div className="status-section">
            {status !== 'IDLE' && (
              <p className={`status-text ${getStatusClass()}`}>
                {isProcessing && <span className="spinner"></span>}
                {getStatusText()}
              </p>
            )}
            {error && <p className="error">⚠️ {error}</p>}
          </div>

          {/* Result Section */}
          {resultUrl && (
            <div className="result-section">
              <h2>🎊 Your Blessing Photo</h2>
              <div className="comparison-container">
                {originalUrl && (
                  <div className="image-wrapper">
                    <p>Original</p>
                    <img src={originalUrl} alt="Original" className="result-img" />
                  </div>
                )}
                <div className="image-wrapper">
                  <p>Generated</p>
                  <img src={resultUrl} alt="Generated" className="result-img" />
                </div>
              </div>
              <button className="download-btn" onClick={handleDownload}>
                📥 Download High Resolution
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p style={{ marginTop: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Happy Year • Powered by Steven
        </p>
      </div>
    </>
  )
}

export default App
