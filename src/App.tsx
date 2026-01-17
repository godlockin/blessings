import { useState } from 'react'
import './App.css'

// Priority: VITE_BACKEND_URL > VITE_API_BASE > Default to /api via proxy or direct

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string>('')
  const [status, setStatus] = useState<string>('IDLE')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reviewDetails] = useState<{
    current_attempt?: number;
    max_attempts?: number;
    last_review?: {
      approved: boolean;
      overall_score: number;
      scores: {
        face_match: number;
        outfit: number;
        pose: number;
        full_body: number;
        quality: number;
        cultural: number;
        realism: number;
      };
      issues: string[];
      suggestions: string[];
    };
  } | null>(null)

  // API base path - use relative path for single-app architecture
  const apiBase = '/api'

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
    setStatus('GENERATING')
    setError(null)
    setResultUrl(null)

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

      if (data.success && data.imageUrl) {
        // Synchronous mode - result is returned directly
        setResultUrl(data.imageUrl)
        setStatus('COMPLETED')
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      } else {
        setError('An unknown error occurred')
      }
      setStatus('FAILED')
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




  // Robust check for processing state (includes all ATTEMPT statuses)
  // Only enable button if IDLE, COMPLETED, or FAILED
  const isProcessing = !['IDLE', 'COMPLETED', 'FAILED'].includes(status)

  const getCurrentStep = () => {
    if (status === 'COMPLETED') return 4
    if (status.startsWith('GENERATING') || status.startsWith('REVIEWING') || status.startsWith('REGENERATING')) return 3
    if (status === 'ANALYZING') return 2
    return 1 // IDLE, UPLOADING, PENDING
  }

  const currentStep = getCurrentStep()

  return (
    <>
      {/* Decorative Lanterns */}
      <div className="lantern-left">🏮</div>
      <div className="lantern-right">🏮</div>

      <div className="container">
        <h1>🧧 新年祝福生成器</h1>
        <p className="subtitle">Upload your photo and create a festive Chinese New Year blessing</p>

        {/* Progress Stepper */}
        <div className="stepper-container">
          <div className={`step-item ${currentStep >= 1 ? 'active' : ''} ${currentStep > 1 ? 'completed' : ''}`}>
            <div className="step-circle">{currentStep > 1 ? '✓' : '1'}</div>
            <span className="step-label">上传 Upload</span>
          </div>
          <div className={`step-line ${currentStep >= 2 ? 'active' : ''}`}></div>
          <div className={`step-item ${currentStep >= 2 ? 'active' : ''} ${currentStep > 2 ? 'completed' : ''}`}>
            <div className="step-circle">{currentStep > 2 ? '✓' : '2'}</div>
            <span className="step-label">分析 Analysis</span>
          </div>
          <div className={`step-line ${currentStep >= 3 ? 'active' : ''}`}></div>
          <div className={`step-item ${currentStep >= 3 ? 'active' : ''} ${currentStep > 3 ? 'completed' : ''}`}>
            <div className="step-circle">{currentStep > 3 ? '✓' : '3'}</div>
            <span className="step-label">生成 Creation</span>
          </div>
        </div>

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
              <>
                <p className={`status-text ${getStatusClass()}`}>
                  {isProcessing && <span className="spinner"></span>}
                  {getStatusText()}
                </p>

                {/* Attempt Progress */}
                {reviewDetails?.current_attempt && isProcessing && (
                  <p className="attempt-progress">
                    尝试次数: {reviewDetails.current_attempt} / {reviewDetails.max_attempts || 3}
                  </p>
                )}
              </>
            )}

            {/* Expert Review Feedback */}
            {reviewDetails?.last_review && isProcessing && (
              <div className="review-feedback">
                <div className="review-header">
                  <span className="review-icon">⚠️</span>
                  <span>上一次生成未通过专家评审</span>
                </div>

                <div className="review-scores">
                  <div className="overall-score">
                    综合评分: <strong>{reviewDetails.last_review.overall_score.toFixed(1)}</strong>/10
                  </div>
                  <div className="score-grid">
                    {Object.entries({
                      '人脸匹配': reviewDetails.last_review.scores.face_match,
                      '服装': reviewDetails.last_review.scores.outfit,
                      '姿势': reviewDetails.last_review.scores.pose,
                      '全身': reviewDetails.last_review.scores.full_body,
                      '质量': reviewDetails.last_review.scores.quality,
                      '文化': reviewDetails.last_review.scores.cultural,
                      '写实度': reviewDetails.last_review.scores.realism
                    }).map(([label, score]) => (
                      <div key={label} className={`score-item ${score < 7 ? 'low-score' : ''}`}>
                        <span className="score-label">{label}</span>
                        <span className="score-value">{score}/10</span>
                      </div>
                    ))}
                  </div>
                </div>

                {reviewDetails.last_review.issues.length > 0 && (
                  <div className="review-issues">
                    <p className="issues-title">发现的问题:</p>
                    <ul>
                      {reviewDetails.last_review.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="review-tip">💡 系统正在根据反馈优化生成...</p>
              </div>
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
