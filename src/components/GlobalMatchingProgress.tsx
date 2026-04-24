import React from 'react';
import { useMatching } from '../context/MatchingContext';
import { useNavigation } from '../context/NavigationContext';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Loader2, ChevronRight } from 'lucide-react';
import { Progress } from "@/components/ui/progress";

export const GlobalMatchingProgress: React.FC = () => {
  const { isMatching, matchStep, results } = useMatching();
  const { activePage, setActivePage } = useNavigation();

  // Only show if matching is active AND we are NOT on the matching page
  const shouldShow = isMatching && activePage !== 'matching';

  if (!shouldShow) return null;

  const getStepLabel = () => {
    switch (matchStep) {
      case 'preparing': return 'Preparing analysis...';
      case 'reading': return 'Reading CV data...';
      case 'matching': return 'AI Talent Matching...';
      case 'ranking': return 'Ranking results...';
      default: return 'Processing...';
    }
  };

  const progressValue = matchStep === 'ranking' ? 90 : matchStep === 'matching' ? 60 : 30;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 right-6 z-50 w-80 bg-white border border-primary/20 shadow-2xl rounded-xl overflow-hidden"
      >
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles size={16} className="animate-pulse" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-text-main">AI Smart Match Running</p>
                <p className="text-[11px] text-text-secondary uppercase font-bold tracking-tighter">{getStepLabel()}</p>
              </div>
            </div>
            <button 
              onClick={() => setActivePage('matching')}
              className="p-2 hover:bg-bg rounded-full text-primary transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          
          <div className="space-y-1">
            <Progress value={progressValue} className="h-1.5" />
            <div className="flex justify-between text-[11px] font-bold text-text-secondary">
              <span>{results.length} matched</span>
              <span>AI Thinking...</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
