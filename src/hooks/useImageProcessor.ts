import { useState, useCallback, useRef, useEffect } from 'react';
import { STEP_CONFIG, type ProcessingState, type StepStatus, type ApiResponse, type DeityOption } from '@/types';
import { retryWithBackoff } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface UseImageProcessorProps {
  onSuccess?: (result: string) => void;
  onError?: (error: Error) => void;
}

interface SSELineResult {
  eventType: string | null;
  data: string;
}

export function useImageProcessor({ onSuccess, onError }: UseImageProcessorProps = {}) {
  const { inviteCode } = useAuthStore();
  const abortControllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<ProcessingState>({
    file: null,
    preview: null,
    result: null,
    isProcessing: false,
    steps: STEP_CONFIG.map(s => ({ ...s })),
    logs: [],
    errorMessage: null,
    fileError: null, // Added for client-side file validation errors
  });

  const [selectedDeity, setSelectedDeity] = useState<DeityOption>('none');

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const logEntry = `[${timestamp}] ${msg}`;
    console.log(logEntry);
    setState(prev => ({
      ...prev,
      logs: [...prev.logs, logEntry].slice(-100)
    }));
  }, []);

  const updateStepStatus = useCallback((stepId: string, status: StepStatus) => {
    setState(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, status } : s)
    }));
  }, []);

  const resetState = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      file: null,
      preview: null,
      result: null,
      isProcessing: false,
      steps: STEP_CONFIG.map(s => ({ ...s, status: 'pending' })),
      logs: [],
      errorMessage: null,
      fileError: null, // Reset file error on reset
    });
  }, []);

  const setFile = useCallback((file: File, preview: string) => {
    setState(prev => ({
      ...prev,
      file,
      preview,
      result: null,
      errorMessage: null,
      fileError: null, // Clear file error when new file is set
      steps: STEP_CONFIG.map(s => ({ ...s, status: 'pending' })),
      logs: [] // Clear logs on new file
    }));
    log('File loaded successfully');
  }, [log]);

  const setFileError = useCallback((error: string | null) => {
    if (error) {
      log(`File validation error: ${error}`);
    }
    setState(prev => ({ ...prev, fileError: error }));
  }, [log]);

  const processServerSentEvents = useCallback(async (
    reader: ReadableStreamDefaultReader<Uint8Array>,
    signal: AbortSignal
  ): Promise<void> => {
    const decoder = new TextDecoder();
    let buffer = '';
    const base64Parts: string[] = [];
    
    // Track current event context
    let currentEvent = { type: null as string | null, data: '' };

    const parseSSELine = (line: string): SSELineResult => {
      if (line.startsWith('event: ')) return { eventType: line.slice(7).trim(), data: '' };
      if (line.startsWith('data: ')) return { eventType: null, data: line.slice(6) };
      return { eventType: null, data: '' };
    };

    try {
      while (true) {
        if (signal.aborted) throw new Error('AbortError');

        const { done, value } = await reader.read();
        if (done) {
          log('Stream connection closed');
          break;
        }

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;
        
        const lines = buffer.split(/\r\n|\n/);
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
            if (!line.trim()) {
                // Empty line triggers event dispatch if we have data
                if (currentEvent.type && currentEvent.data) {
                    try {
                        if (currentEvent.data.trim() === '[DONE]') {
                            currentEvent = { type: null, data: '' };
                            continue;
                        }

                        // Parse JSON data
                        const parsedData = JSON.parse(currentEvent.data);
                        
                        // Handle specific event types
                        switch (currentEvent.type) {
                            case 'step':
                                log(`Step update: ${parsedData.id} -> ${parsedData.status}`);
                                updateStepStatus(parsedData.id, parsedData.status);
                                break;
                                
                            case 'image_chunk':
                                if (parsedData.chunk) {
                                    base64Parts.push(parsedData.chunk);
                                }
                                break;
                                
                            case 'complete': {
                                log('Processing complete, assembling image...');
                                const fullBase64 = base64Parts.join('').replace(/\s/g, '');
                                if (!fullBase64) throw new Error('Received empty image data');
                                
                                const imageUrl = `data:image/png;base64,${fullBase64}`;
                                setState(prev => ({ ...prev, result: imageUrl }));
                                onSuccess?.(imageUrl);
                                break;
                            }
                            
                            case 'error':
                                throw new Error(parsedData.message || 'Unknown server error');
                        }
                    } catch (e) {
                         // Don't throw for non-fatal JSON errors in logs
                        const msg = e instanceof Error ? e.message : 'Event processing error';
                        if (currentEvent.type === 'error') throw e; // Re-throw actual errors
                        console.warn(`Failed to process event ${currentEvent.type}:`, msg);
                    }
                    // Reset for next event
                    currentEvent = { type: null, data: '' };
                }
                continue;
            }

            const result = parseSSELine(line);
            if (result.eventType !== null) currentEvent.type = result.eventType;
            if (result.data) currentEvent.data += result.data;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'AbortError') {
         throw error;
      }
      throw error;
    }
  }, [log, updateStepStatus, onSuccess]);

  const startProcessing = useCallback(async () => {
    if (!state.preview || !inviteCode) {
      const error = new Error('Missing requirements: Image or Invite Code');
      setState(prev => ({ ...prev, errorMessage: error.message }));
      onError?.(error);
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isProcessing: true,
      logs: [],
      errorMessage: null,
      steps: STEP_CONFIG.map(s => ({ ...s, status: 'pending' }))
    }));

    log('Starting secure image processing...');

    try {
      const base64Data = state.preview.split(',')[1];
      if (!base64Data) throw new Error('Invalid image data');

      const makeRequest = async () => {
        const response = await fetch('/api/process-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
          },
          body: JSON.stringify({
            image: base64Data,
            inviteCode: inviteCode.trim(),
            selectedDeity
          }),
          signal: abortControllerRef.current?.signal ?? null
        });
        return response;
      };

      const response = await retryWithBackoff(
        makeRequest, 
        3, 
        1000, 
        (attempt) => log(`Connection attempt ${attempt} failed, retrying...`)
      );

      if (!response.ok) {
        const errorData: ApiResponse = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Response body is not a stream');

      await processServerSentEvents(reader, abortControllerRef.current.signal);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        log('Processing cancelled by user');
        setState(prev => ({ ...prev, errorMessage: 'Processing cancelled', isProcessing: false }));
        return;
      }

      const message = error instanceof Error ? error.message : 'Unknown error occurred';
      log(`Error: ${message}`);
      setState(prev => ({
        ...prev,
        errorMessage: message,
        steps: prev.steps.map(s => s.status === 'processing' ? { ...s, status: 'failed' } : s)
      }));
      onError?.(error instanceof Error ? error : new Error(message));
    } finally {
      setState(prev => ({ ...prev, isProcessing: false }));
      abortControllerRef.current = null;
    }
  }, [state.preview, inviteCode, selectedDeity, log, onError, processServerSentEvents]);

  const cancelProcessing = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        log('User initiated cancellation');
    }
  }, [log]);

  return {
    state,
    selectedDeity,
    setSelectedDeity,
    setFile,
    setFileError,
    startProcessing,
    cancelProcessing,
    resetState
  };
}
