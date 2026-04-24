import React from 'react';
import { useUpload } from '../context/UploadContext';
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const GlobalUploadProgress: React.FC = () => {
  const { activeUpload, cancelUpload } = useUpload();

  return (
    <AnimatePresence>
      {activeUpload && (
        <motion.div 
          initial={{ y: -100 }}
          animate={{ y: 0 }}
          exit={{ y: -100 }}
          className="fixed top-0 left-0 right-0 z-[100] bg-white border-b border-border shadow-md px-6 py-3 flex items-center gap-6"
        >
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary">
              <Loader2 size={18} className="animate-spin" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-main">Uploading CVs...</p>
              <p className="text-[10px] text-text-secondary uppercase tracking-wider font-bold">
                {activeUpload.completedFiles} of {activeUpload.totalFiles} processed
              </p>
            </div>
          </div>

          <div className="flex-1 max-w-2xl">
            <Progress value={activeUpload.progress} className="h-2 bg-bg" />
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2 h-9 px-4 font-bold text-xs"
            onClick={cancelUpload}
          >
            <X size={14} /> Stop Upload
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
