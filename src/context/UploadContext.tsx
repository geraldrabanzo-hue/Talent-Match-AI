import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { extractCVData } from '../lib/gemini';
import { extractTextFromFile } from '../lib/parser';

interface UploadTask {
  id: string;
  files: File[];
  progress: number;
  isCancelled: boolean;
  totalFiles: number;
  completedFiles: number;
}

interface UploadContextType {
  activeUpload: UploadTask | null;
  startUpload: (files: File[]) => void;
  cancelUpload: () => void;
  onUploadComplete: (callback: () => void) => void;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const UploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeUpload, setActiveUpload] = useState<UploadTask | null>(null);
  const cancelRef = useRef(false);
  const completionCallbacks = useRef<(() => void)[]>([]);

  const onUploadComplete = useCallback((callback: () => void) => {
    completionCallbacks.current.push(callback);
  }, []);

  const triggerCompletion = useCallback(() => {
    completionCallbacks.current.forEach(cb => cb());
    completionCallbacks.current = [];
  }, []);

  const startUpload = useCallback(async (files: File[]) => {
    const uploadId = Math.random().toString(36).substring(7);
    cancelRef.current = false;
    
    setActiveUpload({
      id: uploadId,
      files,
      progress: 0,
      isCancelled: false,
      totalFiles: files.length,
      completedFiles: 0
    });

    let completed = 0;
    
    // Process one by one for maximum reliability
    const batchSize = 1;
    for (let i = 0; i < files.length; i += batchSize) {
      if (cancelRef.current) break;

      const batch = files.slice(i, i + batchSize);
      await Promise.all(batch.map(async (file) => {
        if (cancelRef.current) return;

        try {
          // Step 1: Parse Text
          const text = await extractTextFromFile(file);
          if (cancelRef.current) return;
          
          // Step 2: AI Extract metadata
          // Note: We save extracted text instead of Base64 file data.
          // This avoids Vercel payload limits during uploads.
          const extractedData = await extractCVData(text);
          if (cancelRef.current) return;
          
          const newCandidate = {
            ...extractedData,
            cvText: text,
            cvUrl: "",
            fileType: "TXT"
          };
          
          // Ensure we have at least an empty string for email if missing
          if (!newCandidate.email) newCandidate.email = "";

          // Step 3: Save to Supabase-backed API
          await fetch("/api/candidates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newCandidate)
          });

          completed++;
          setActiveUpload(prev => prev ? {
            ...prev,
            completedFiles: Math.min(completed, files.length),
            progress: (completed / files.length) * 100
          } : null);
        } catch (error) {
          console.error(`Failed to process ${file.name}`, error);
          toast.error(`Error processing ${file.name}. High AI demand.`);
        }
      }));

      // Small delay between items to respect rate limits
      if (i + batchSize < files.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }

    if (!cancelRef.current) {
      toast.success(`Successfully added ${completed} candidates to the library`);
    } else {
      toast.info(`Upload stopped manually. ${completed} records saved.`);
    }
    
    triggerCompletion();
    setActiveUpload(null);
  }, [triggerCompletion]);

  const cancelUpload = useCallback(() => {
    cancelRef.current = true;
    setActiveUpload(prev => prev ? { ...prev, isCancelled: true } : null);
  }, []);

  return (
    <UploadContext.Provider value={{ activeUpload, startUpload, cancelUpload, onUploadComplete }}>
      {children}
    </UploadContext.Provider>
  );
};

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) throw new Error('useUpload must be used within an UploadProvider');
  return context;
};
