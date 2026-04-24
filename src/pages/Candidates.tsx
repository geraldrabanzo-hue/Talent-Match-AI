import { useState, useEffect, ChangeEvent, useCallback } from "react";
import { Users, Upload, Search, FileText, Trash2, Plus, Loader2, ZoomIn, ZoomOut, Maximize2, X as CloseIcon, Eye, Briefcase, GraduationCap } from "lucide-react";
import { CVViewerDialog } from "../components/CVViewerDialog";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Candidate } from "../types";
import { extractCVData } from "../lib/gemini";
import { useUpload } from "../context/UploadContext";
import { useMatching } from "../context/MatchingContext";
import { useNavigation } from "../context/NavigationContext";
import { Sparkles } from "lucide-react";

// Mock PDF extraction for demo purposes
const mockExtractText = async (file: File): Promise<string> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`Extracted text from ${file.name}. Experience: 5 years. Skills: React, Node.js.`);
    }, 1000);
  });
};

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | null>(null);
  const [zoom, setZoom] = useState(100);
  const { startUpload, onUploadComplete } = useUpload();
  const { isMatching, startMatching, selectedRole } = useMatching();
  const { setActivePage } = useNavigation();

  useEffect(() => {
    const loadCandidates = () => {
      fetch("/api/candidates").then(res => res.json()).then(setCandidates);
    };
    
    loadCandidates();
    onUploadComplete(loadCandidates);
  }, [onUploadComplete]);

  const handleStartMatch = async () => {
    // We need the roles to start matching
    const res = await fetch("/api/roles");
    const roles = await res.json();
    
    startMatching(candidates, roles, () => {
      setActivePage("matching");
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploadFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png']
    }
  } as any);

  const handleUpload = async () => {
    if (uploadFiles.length === 0) return;
    
    // Start background upload and close modal immediately
    startUpload(uploadFiles);
    setIsUploadModalOpen(false);
    setUploadFiles([]);
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      const res = await fetch(`/api/candidates/${deleteConfirmId}`, { method: "DELETE" });
      if (res.ok) {
        setCandidates(prev => prev.filter(c => c.id !== deleteConfirmId));
        toast.success("Candidate removed from library");
        setDeleteConfirmId(null);
      } else {
        throw new Error("Delete failed");
      }
    } catch (error) {
      toast.error("Failed to delete candidate");
    }
  };

  const handleCleanup = async () => {
    try {
      const res = await fetch("/api/candidates/cleanup", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        fetch("/api/candidates").then(res => res.json()).then(setCandidates);
        toast.success(`Library Cleaned: ${data.summary.normalized} names formatted, ${data.summary.removed} duplicates removed.`);
      } else {
        throw new Error("Cleanup failed");
      }
    } catch (error) {
      toast.error("Failed to clean library");
    }
  };

  const filteredCandidates = candidates.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
    c.recentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.field.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
            <Input 
              placeholder="Search candidates by name, email, title..." 
              className="sleek-input pl-10 h-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="h-10 border-border text-text-main gap-2" onClick={handleCleanup}>
            Clean Library
          </Button>
          <Button 
            className="h-10 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 gap-2 font-bold" 
            onClick={handleStartMatch}
            disabled={isMatching || candidates.length === 0}
          >
            {isMatching ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Match Candidates
          </Button>
        </div>
        <Button className="sleek-btn-primary w-auto px-6 gap-2" onClick={() => setIsUploadModalOpen(true)}>
          <Plus size={18} /> Add Candidate
        </Button>
      </div>

      <Card className="sleek-card border-none shadow-sleek overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-bg border-b border-border">
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Candidate Name & Email</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Recent Job Title</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Field / Specialization</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCandidates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-text-secondary">
                  No candidates found.
                </TableCell>
              </TableRow>
            ) : (
              filteredCandidates.map((candidate) => (
                <TableRow key={candidate.id} className="group hover:bg-bg transition-colors border-b border-border last:border-0">
                  <TableCell className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {candidate.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-text-main">{candidate.name}</p>
                        <p className="text-[11px] text-text-secondary">{candidate.email || "No email available"}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-[13px] text-text-main">{candidate.recentTitle}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="secondary" className="bg-primary-light text-primary font-semibold text-[11px] rounded-[4px] border-none">
                      {candidate.field}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 px-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-text-secondary hover:text-primary"
                        onClick={() => {
                          setPreviewCandidate(candidate);
                          setZoom(100);
                        }}
                      >
                        <Eye size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-text-secondary hover:text-red-600"
                        onClick={() => setDeleteConfirmId(candidate.id)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Candidate?</DialogTitle>
            <DialogDescription>
              This candidate and their CV will be permanently removed from the library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete Candidate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={setIsUploadModalOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Upload Candidate CVs</DialogTitle>
            <DialogDescription>
              Drag and drop multiple PDF, Word, or Image files. AI will extract details automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-6">
            <div 
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer ${
                isDragActive ? "border-primary bg-primary-light/50" : "border-border hover:border-primary/50 hover:bg-bg"
              }`}
            >
              <input {...getInputProps()} />
              <div className="w-12 h-12 rounded-full bg-primary-light text-primary flex items-center justify-center mb-4">
                <Upload size={24} />
              </div>
              <p className="font-medium text-text-main">Click to upload or drag and drop</p>
              <p className="text-[11px] text-text-secondary mt-1 uppercase tracking-wider font-bold">PDF, DOCX, JPG, PNG (Max 10MB)</p>
            </div>

            {uploadFiles.length > 0 && (
              <div className="mt-6 space-y-2 max-h-[200px] overflow-y-auto pr-2">
                {uploadFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-bg rounded-lg border border-border group">
                    <div className="flex items-center gap-3">
                      <FileText size={18} className="text-primary" />
                      <div>
                        <p className="text-sm font-medium text-text-main truncate max-w-[300px]">{file.name}</p>
                        <p className="text-[10px] text-text-secondary">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-text-secondary hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadFiles(uploadFiles.filter((_, i) => i !== idx));
                      }}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsUploadModalOpen(false);
              setUploadFiles([]);
            }}>Cancel</Button>
            <Button 
              className="sleek-btn-primary w-auto px-8" 
              disabled={uploadFiles.length === 0}
              onClick={handleUpload}
            >
              Upload & Process {uploadFiles.length} File{uploadFiles.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CV Viewer Dialog */}
      <CVViewerDialog 
        candidate={previewCandidate}
        open={!!previewCandidate}
        onOpenChange={(open) => !open && setPreviewCandidate(null)}
        zoom={zoom}
        setZoom={setZoom}
      />
    </div>
  );
}
