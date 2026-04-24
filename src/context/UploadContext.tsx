import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { extractCVData } from '../lib/gemini';
import { extractTextFromFile } from '../lib/parser';
import { supabase } from '../lib/supabase';

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

    for (let i = 0; i < files.length; i++) {
      if (cancelRef.current) break;

      const file = files[i];

      try {
        // 1. Upload file to Supabase Storage
        const fileName = `${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('cvs')
          .upload(fileName, file);

        if (uploadError) {
          console.error(uploadError);
          toast.error(`Upload failed: ${file.name}`);
          continue;
        }

        const { data } = supabase.storage
          .from('cvs')
          .getPublicUrl(fileName);

        const fileUrl = data.publicUrl;

        // 2. Extract text (for AI only)
        const text = await extractTextFromFile(file);
        if (cancelRef.current) return;

        // 3. AI processing
        const extractedData = await extractCVData(text);
        if (cancelRef.current) return;

        const newCandidate = {
          ...extractedData,
          cvText: text,
          file_url: fileUrl,
          fileType: file.type
        };

        if (!newCandidate.email) newCandidate.email = "";

        // 4. Save to DB via API
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
        toast.error(`Error processing ${file.name}`);
      }

      // delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!cancelRef.current) {
      toast.success(`Successfully added ${completed} candidates`);
    } else {
      toast.info(`Upload stopped. ${completed} saved.`);
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