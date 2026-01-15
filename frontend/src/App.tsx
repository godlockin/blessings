import { useState } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [taskId, setTaskId] = useState<string | null>(null)
  const [status, setStatus] = useState<string>('IDLE')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0]
      setFile(f)
      setPreview(URL.createObjectURL(f))
      setStatus('IDLE')
      setResultUrl(null)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return
    setStatus('UPLOADING')
    setError(null)

    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Upload failed')
      }
      
      const data = await res.json()
      setTaskId(data.task_id)
      setStatus('PENDING')
      pollStatus(data.task_id)
    } catch (e: any) {
      setError(e.message)
      setStatus('FAILED')
    }
  }

  const pollStatus = async (tid: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/status/${tid}`)
        const data = await res.json()
        
        setStatus(data.status)

        if (data.status === 'COMPLETED') {
          clearInterval(interval)
          fetchResult(tid)
        } else if (data.status === 'FAILED') {
          clearInterval(interval)
          setError('Processing failed: ' + (data.analysis_result || 'Unknown error'))
        }
      } catch (e) {
        // ignore transient errors
      }
    }, 2000)
  }

  const fetchResult = async (tid: string) => {
    try {
      const res = await fetch(`/api/result/${tid}`)
      const data = await res.json()
      setResultUrl(data.url)
    } catch (e) {
      setError('Failed to fetch result')
    }
  }

  return (
    <div className="container">
      <h1>Chinese New Year Blessings Generator</h1>
      
      <div className="card">
        <div className="upload-section">
            <input type="file" accept="image/*" onChange={handleFileChange} />
            {preview && (
                <div className="image-container">
                    <p>Original:</p>
                    <img src={preview} alt="Preview" className="preview-img" />
                </div>
            )}
            <button onClick={handleUpload} disabled={!file || (status !== 'IDLE' && status !== 'FAILED')}>
            {status === 'IDLE' || status === 'FAILED' ? 'Generate Blessing' : 'Processing...'}
            </button>
        </div>

        <div className="status-section">
            {status !== 'IDLE' && <p className="status-text">Status: {status}</p>}
            {error && <p className="error">{error}</p>}
        </div>

        {resultUrl && (
            <div className="result-section">
            <h2>Your Blessing Photo</h2>
            <div className="image-container">
                <img src={resultUrl} alt="Generated" className="result-img" />
            </div>
            <a href={resultUrl} download="blessing.jpg" target="_blank" rel="noreferrer">
                <button className="download-btn">Download High Res</button>
            </a>
            </div>
        )}
      </div>
    </div>
  )
}

export default App
