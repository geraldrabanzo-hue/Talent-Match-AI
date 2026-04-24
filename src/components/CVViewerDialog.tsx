import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ZoomIn, ZoomOut, Maximize2, Loader2, X, ChevronDown } from "lucide-react";
import { Candidate } from "../types";
import * as pdfjs from 'pdfjs-dist';

// Use same worker setup as parser
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PageSnapshotProps {
  pdf: any;
  pageNumber: number;
  scale: number;
  onVisible?: () => void;
}

const PageSnapshot: React.FC<PageSnapshotProps> = ({ pdf, pageNumber, scale, onVisible }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isTooFar, setIsTooFar] = useState(false);
  const [renderState, setRenderState] = useState<'idle' | 'rendering' | 'completed'>('idle');
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setIsTooFar(false);
          onVisible?.();
        } else {
          // If way out of view, we could mark as too far to save memory
          // but for now let's just keep the state
        }
      },
      { rootMargin: '600px' } 
    );
    
    const farObserver = new IntersectionObserver(
      ([entry]) => {
        setIsTooFar(!entry.isIntersecting);
      },
      { rootMargin: '2000px' } // Very far away
    );

    if (canvasRef.current) {
      observer.observe(canvasRef.current);
      farObserver.observe(canvasRef.current);
    }
    return () => {
      observer.disconnect();
      farObserver.disconnect();
    };
  }, [onVisible]);

  useEffect(() => {
    if (!isVisible || !pdf || isTooFar) return;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      setRenderState('rendering');
      try {
        const page = await pdf.getPage(pageNumber);
        // Use a slightly higher base multiplier for crispness (1.5x of scale)
        const renderScale = scale * window.devicePixelRatio; 
        const viewport = page.getViewport({ scale: renderScale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        canvas.style.width = `${viewport.width / window.devicePixelRatio}px`;
        canvas.style.height = `${viewport.height / window.devicePixelRatio}px`;

        renderTaskRef.current = page.render({ 
          canvasContext: context, 
          viewport,
          intent: 'display'
        });
        await renderTaskRef.current.promise;
        setRenderState('completed');
      } catch (err: any) {
        if (err.name !== 'RenderingCancelledException') {
          console.error("Render error", err);
        }
      }
    };

    renderPage();
    
    return () => {
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [isVisible, pdf, pageNumber, scale, isTooFar]);

  return (
    <div 
      className="relative bg-white shadow-md mb-8 mx-auto transition-opacity duration-300" 
      style={{ 
        minHeight: '600px', 
        width: 'fit-content',
        opacity: renderState === 'completed' ? 1 : 0.6
      }}
    >
      <canvas ref={canvasRef} className="max-w-full" />
      {renderState !== 'completed' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 gap-2">
          <Loader2 className="animate-spin text-primary" size={32} />
          <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Rendering Page {pageNumber}...</span>
        </div>
      )}
    </div>
  );
};

interface CVViewerDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zoom: number;
  setZoom: (zoom: number) => void;
}

export const CVViewerDialog: React.FC<CVViewerDialogProps> = ({ 
  candidate, 
  open, 
  onOpenChange, 
  zoom, 
  setZoom 
}) => {
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [renderedCount, setRenderedCount] = useState(3); // Start with 3
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !candidate || candidate.fileType !== "PDF") {
      setPdf(null);
      setNumPages(0);
      return;
    }

    const loadPdf = async () => {
      setIsLoadingPdf(true);
      try {
        const loadingTask = pdfjs.getDocument(candidate.cvUrl);
        const pdfDoc = await loadingTask.promise;
        setPdf(pdfDoc);
        setNumPages(pdfDoc.numPages);
      } catch (err) {
        console.error("PDF loading error", err);
      } finally {
        setIsLoadingPdf(false);
      }
    };

    loadPdf();
  }, [open, candidate]);

  if (!candidate) return null;

  const isPDF = candidate.fileType === "PDF";
  const isImage = ["JPG", "PNG", "JPEG"].includes(candidate.fileType);
  
  const matchData = candidate as any;
  const hasMatchAnalysis = matchData.score !== undefined && matchData.explanation !== undefined;

  // Base scale is 1.8, adjusted by zoom %
  const baseScale = 1.8;
  const currentScale = (zoom / 100) * baseScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-[95vw] h-[76vw] max-h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white rounded-xl !max-w-none">
        <DialogHeader className="p-5 border-b border-border bg-white shrink-0 flex flex-row items-center justify-between space-y-0 z-10 shadow-sm">
          <div className="flex flex-col max-w-[60%]">
            <DialogTitle className="text-xl font-bold text-text-main flex items-center gap-3 flex-wrap text-left">
              <span className="truncate">{candidate.name}</span>
              <Badge variant="outline" className="text-[10px] h-5 bg-primary-light text-primary border-none font-black px-3 shrink-0">
                {hasMatchAnalysis ? "MATCH SUCCESS" : `${candidate.fileType} SOURCE`}
              </Badge>
            </DialogTitle>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-wider mt-1 text-left">
              {isPDF && numPages > 0 ? `${numPages} PAGE OPTIMIZED READER` : 'SECURE DOCUMENT PREVIEW'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-bg rounded-lg border border-border p-1 mr-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-text-secondary hover:text-primary transition-all" 
                onClick={() => setZoom(Math.max(50, zoom - 15))}
                disabled={zoom <= 50}
              >
                <ZoomOut size={16} />
              </Button>
              <div className="w-12 text-center">
                <span className="text-[11px] font-black text-text-main">{zoom}%</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-text-secondary hover:text-primary transition-all" 
                onClick={() => setZoom(Math.min(250, zoom + 15))}
                disabled={zoom >= 250}
              >
                <ZoomIn size={16} />
              </Button>
              <div className="w-px h-4 bg-border mx-1" />
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-text-secondary hover:text-primary transition-all" 
                onClick={() => setZoom(100)}
              >
                <Maximize2 size={16} />
              </Button>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-full bg-bg hover:bg-slate-100 text-text-secondary" 
              onClick={() => onOpenChange(false)}
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>

        <div 
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-slate-100 flex flex-col items-center p-8 gap-8 scroll-smooth"
        >
          {hasMatchAnalysis && (
            <div className="w-full max-w-[1200px] bg-white rounded-2xl border border-border shadow-sm overflow-hidden shrink-0 transform transition-all">
              <div className="bg-primary/5 p-6 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black text-lg">
                    {matchData.score}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-text-main">AI Performance Snapshot</h3>
                    <p className="text-[11px] text-text-secondary font-medium tracking-tight">Technical compatibility analysis completed</p>
                  </div>
                </div>
                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none px-3 py-1 font-bold text-[10px] uppercase">
                  Verified Result
                </Badge>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2">
                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3 opacity-60">Recruiter Insights</h4>
                    <p className="text-[13px] text-text-main leading-relaxed font-medium">{matchData.explanation}</p>
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3 opacity-60">Identified Strengths</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {matchData.matchedSkills?.map((skill: string, i: number) => (
                        <Badge key={i} variant="secondary" className="bg-slate-50 text-slate-700 text-[10px] border-slate-200 px-2 py-0.5">
                          {skill}
                        </Badge>
                      ))}
                      {(!matchData.matchedSkills || matchData.matchedSkills.length === 0) && (
                        <span className="text-[11px] text-text-secondary italic">None identified</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div 
            className="w-full flex-1 flex flex-col items-center relative transition-all duration-300"
            style={{ maxWidth: `${Math.max(1200, Math.min(2200, (zoom / 100) * 1200))}px` }}
          >
            {isLoadingPdf ? (
              <div className="flex flex-col items-center justify-center h-[600px] w-full bg-white rounded-2xl border border-dashed border-border gap-4">
                <div className="relative">
                  <Loader2 className="animate-spin text-primary" size={48} />
                  <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-primary">AI</div>
                </div>
                <div className="text-center">
                  <p className="font-bold text-text-main">Warming up optimized reader...</p>
                  <p className="text-[11px] text-text-secondary">Parsing document structure for progressive delivery</p>
                </div>
              </div>
            ) : isPDF && pdf ? (
              <>
                {Array.from({ length: numPages }).map((_, i) => (
                  <PageSnapshot 
                    key={i} 
                    pdf={pdf} 
                    pageNumber={i + 1} 
                    scale={currentScale}
                    onVisible={() => {
                      // Trigger loading more pages if we approach the end of the current "renderedCount"
                      if (i >= renderedCount - 1) {
                        setRenderedCount(prev => Math.min(numPages, prev + 2));
                      }
                    }}
                  />
                ))}
                {renderedCount < numPages && (
                  <div className="p-8 flex flex-col items-center gap-3 text-text-secondary opacity-50 animate-bounce">
                    <ChevronDown size={24} />
                    <span className="text-xs font-bold uppercase tracking-widest">Scroll to load more pages</span>
                  </div>
                )}
              </>
            ) : isImage ? (
              <div 
                className="bg-white shadow-2xl transition-transform duration-200 origin-top rounded-lg overflow-hidden border border-border"
                style={{ transform: `scale(${zoom / 100})`, width: 'fit-content' }}
              >
                <img src={candidate.cvUrl} alt="CV" className="max-w-none" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <div 
                className="bg-white shadow-xl p-16 transition-all duration-200 origin-top rounded-xl border border-border"
                style={{ width: `${zoom}%`, maxWidth: '1200px', minHeight: '1000px' }}
              >
                <div className="prose prose-slate max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700 break-words overflow-hidden bg-transparent p-0 border-none">
                    {candidate.cvText}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
