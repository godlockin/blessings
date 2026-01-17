import { useState, useCallback } from 'react'
import './App.css'

// Image compression threshold (500KB)
const COMPRESSION_THRESHOLD = 500 * 1024
const MAX_IMAGE_DIMENSION = 1920
const COMPRESSION_QUALITY = 0.8

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [inviteCode, setInviteCode] = useState<string>('')
  const [status, setStatus] = useState<string>('IDLE')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)

  const apiBase = '/api'

  // Compress image if needed
  const compressImage = useCallback(async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      // If file is small enough, return as is
      if (file.size <= COMPRESSION_THRESHOLD) {
        resolve(file)
        return
      }

      const img = new Image()
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      img.onload = () => {
        let { width, height } = img

        // Calculate new dimensions
        if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
          if (width > height) {
            height = (height / width) * MAX_IMAGE_DIMENSION
            width = MAX_IMAGE_DIMENSION
          } else {
            width = (width / height) * MAX_IMAGE_DIMENSION
            height = MAX_IMAGE_DIMENSION
          }
        }

        canvas.width = width
        canvas.height = height
        ctx?.drawImage(img, 0, 0, width, height)

        canvas.toBlob(
          (blob) => {
            if (blob) {
              console.log(`Compressed: ${(file.size / 1024).toFixed(1)}KB → ${(blob.size / 1024).toFixed(1)}KB`)
              resolve(blob)
            } else {
              reject(new Error('Failed to compress image'))
            }
          },
          'image/jpeg',
          COMPRESSION_QUALITY
        )
      }

      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setStatus('IDLE')
      setResultUrl(null)
      setError(null)
      setTaskId(null)
    }
  }

  const pollStatus = useCallback(async (tid: string) => {
    let pollCount = 0
    const maxPolls = 300 // 10 minutes max (2s interval)

    const poll = async () => {
      try {
        pollCount++
        if (pollCount > maxPolls) {
          setError('处理超时，请重试 (Processing timeout, please retry)')
          setStatus('FAILED')
          return
        }

        const res = await fetch(`${apiBase}/status/${tid}`)
        const data = await res.json()

        if (!res.ok) {
          if (data.code === 'TASK_NOT_FOUND') {
            // Task may have been processed by different instance
            setError('任务状态丢失，请重新上传 (Task state lost, please re-upload)')
            setStatus('FAILED')
            return
          }
          throw new Error(data.error || 'Status check failed')
        }

        setStatus(data.status)

        if (data.status === 'COMPLETED') {
          await fetchResult(tid)
        } else if (data.status === 'FAILED') {
          setError(data.errorMessage || '处理失败 (Processing failed)')
          setStatus('FAILED')
        } else {
          // Continue polling
          setTimeout(poll, 2000)
        }
      } catch (e: any) {
        console.error('Poll error:', e)
        // Continue polling on transient errors
        if (pollCount < maxPolls) {
          setTimeout(poll, 2000)
        } else {
          setError(e.message || '轮询失败 (Polling failed)')
          setStatus('FAILED')
        }
      }
    }

    poll()
  }, [])

  const fetchResult = async (tid: string) => {
    try {
      const res = await fetch(`${apiBase}/result/${tid}`)
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch result')
      }

      setResultUrl(data.imageUrl)
      setStatus('COMPLETED')
    } catch (e: any) {
      console.error('Fetch result error:', e)
      setError(e.message || '获取结果失败 (Failed to fetch result)')
      setStatus('FAILED')
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('UPLOADING')
    setError(null)
    setResultUrl(null)
    setTaskId(null)

    try {
      // Compress image if needed
      let imageToUpload: Blob = file
      if (file.size > COMPRESSION_THRESHOLD) {
        setStatus('COMPRESSING')
        imageToUpload = await compressImage(file)
      }

      setStatus('UPLOADING')
      const formData = new FormData()
      formData.append('image', imageToUpload, file.name)
      if (inviteCode) {
        formData.append('invite_code', inviteCode)
      }

      const res = await fetch(`${apiBase}/upload`, {
        method: 'POST',
        body: formData
      })

      const data = await res.json()

      if (!res.ok) {
        let errorMsg = data.error || 'Upload failed'
        if (data.code === 'INVALID_INVITE_CODE') {
          errorMsg = '邀请码无效 (Invalid invite code)'
        } else if (data.code === 'NO_IMAGE') {
          errorMsg = '请选择图片 (Please select an image)'
        } else if (data.code === 'IMAGE_TOO_LARGE') {
          errorMsg = '图片太大，最大10MB (Image too large, max 10MB)'
        }
        throw new Error(errorMsg)
      }

      if (data.taskId) {
        setTaskId(data.taskId)
        setStatus(data.status || 'ANALYZING')
        pollStatus(data.taskId)
      } else {
        throw new Error('No task ID returned')
      }
    } catch (e: any) {
      console.error('Upload error:', e)
      setError(e.message || '上传失败 (Upload failed)')
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
    if (status.startsWith('GENERATING') || status.startsWith('REVIEWING') || status.startsWith('REGENERATING')) {
      return 'generating'
    }
    return status.toLowerCase()
  }

  const getStatusText = () => {
    const statusMap: Record<string, string> = {
      'IDLE': '',
      'COMPRESSING': '🗜️ 压缩图片中... Compressing...',
      'UPLOADING': '📤 上传中... Uploading...',
      'ANALYZING': '🔍 AI 分析中... AI analyzing...',
      'GENERATING': '✨ 生成中... Generating...',
      'COMPLETED': '🎉 完成! Complete!',
      'FAILED': '❌ 失败 Failed'
    }

    // Handle attempt statuses
    if (status.startsWith('GENERATING_ATTEMPT_')) {
      const attempt = status.split('_').pop()
      return `✨ 生成中 (第${attempt}次尝试)... Generating (Attempt ${attempt})...`
    }
    if (status.startsWith('REVIEWING_ATTEMPT_')) {
      const attempt = status.split('_').pop()
      return `🧐 专家评审中 (第${attempt}次)... Expert reviewing (Attempt ${attempt})...`
    }

    return statusMap[status] || `⏳ ${status}...`
  }

  const isProcessing = !['IDLE', 'COMPLETED', 'FAILED'].includes(status)

  const getCurrentStep = () => {
    if (status === 'COMPLETED') return 4
    if (status.startsWith('GENERATING') || status.startsWith('REVIEWING') || status.startsWith('REGENERATING')) return 3
    if (status === 'ANALYZING') return 2
    return 1
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
                  &nbsp; 处理中... Processing...
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
                {taskId && isProcessing && (
                  <p className="task-id-hint">Task: {taskId.slice(0, 8)}...</p>
                )}
              </>
            )}

            {error && (
              <div className="error">
                <p>⚠️ {error}</p>
                <button
                  className="retry-btn"
                  onClick={() => {
                    setError(null)
                    setStatus('IDLE')
                  }}
                >
                  重试 Retry
                </button>
              </div>
            )}
          </div>

          {/* Result Section */}
          {resultUrl && (
            <div className="result-section">
              <h2>🎊 Your Blessing Photo</h2>
              <div className="comparison-container">
                {preview && (
                  <div className="image-wrapper">
                    <p>原图 Original</p>
                    <img src={preview} alt="Original" className="result-img" />
                  </div>
                )}
                <div className="image-wrapper">
                  <p>生成 Generated</p>
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
