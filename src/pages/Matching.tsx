import { useState, useEffect } from "react";
import { Search, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Department, JobRole, Candidate, MatchResult } from "../types";
import { generateJobSummary } from "../lib/gemini";
import { CVViewerDialog } from "../components/CVViewerDialog";
import { useMatching } from "../context/MatchingContext";
import { useNavigation } from "../context/NavigationContext";

export default function MatchingPage() {
  const { 
    isMatching, 
    matchStep, 
    results, 
    selectedDept, 
    selectedRole, 
    keywords,
    setSelectedDept,
    setSelectedRole,
    setKeywords,
    startMatching 
  } = useMatching();

  const { setActivePage } = useNavigation();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  
  const [previewCandidate, setPreviewCandidate] = useState<Candidate | (Candidate & MatchResult) | null>(null);
  const [zoom, setZoom] = useState(100);

  const currentRole = roles.find(r => r.id === selectedRole);

  useEffect(() => {
    fetch("/api/departments").then(res => res.json()).then(setDepartments);
    fetch("/api/roles").then(res => res.json()).then(setRoles);
    fetch("/api/candidates").then(res => res.json()).then(setCandidates);
  }, []);

  const [baselineSummary, setBaselineSummary] = useState("");

  useEffect(() => {
    const role = roles.find(r => r.id === selectedRole);
    if (role) {
      setBaselineSummary("Generating summary...");
      generateJobSummary(role.title, role.description).then(setBaselineSummary);
    } else {
      setBaselineSummary("");
    }
  }, [selectedRole, roles]);

  const getBaselineSummary = (role: JobRole) => {
    if (!role) return "Select a role to see the smart baseline summary.";
    if (baselineSummary && baselineSummary !== "Generating summary...") return baselineSummary;
    
    // Fallback naive logic
    const sentences = role.description.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    return sentences.slice(0, 2).join(". ") + (sentences.length > 2 ? "." : "");
  };

  const filteredRoles = selectedDept === "all" 
    ? roles 
    : roles.filter(r => r.departmentId === selectedDept);

  const handleMatch = () => {
    startMatching(candidates, roles, () => {
      setActivePage("matching");
    });
  };

  const selectedDeptLabel = selectedDept === "all" ? "All Departments" : departments.find(d => d.id === selectedDept)?.name;
  const selectedRoleLabel = roles.find(r => r.id === selectedRole)?.title;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
      {/* Left Panel: Configuration */}
      <div className="space-y-6">
        <Card className="sleek-card border-none shadow-sleek">
          <CardHeader className="pb-4 px-0 pt-0">
            <CardTitle className="text-sm font-semibold text-text-main flex items-center justify-between">
              Match Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="space-y-1.5">
              <label>Department</label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="sleek-input h-10">
                  <SelectValue>{selectedDeptLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-1.5">
              <label>Target Job Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="sleek-input h-10">
                  <SelectValue>{selectedRoleLabel || "Select Role"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {filteredRoles.map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="sleek-card border-none shadow-sleek">
          <CardHeader className="pb-4 px-0 pt-0">
            <CardTitle className="text-sm font-semibold text-text-main">
              Analysis Baseline
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div className="space-y-1.5">
              <label>Talent Matching Context</label>
              <div className="text-[12px] text-text-main leading-relaxed mb-3 bg-primary-light/30 p-3 rounded-lg border border-primary/10">
                {currentRole ? getBaselineSummary(currentRole) : "Select a role to see the smart baseline summary."}
              </div>
            </div>

            <div className="space-y-1.5">
              <label>Requirement Refinement</label>
              <Input 
                placeholder="Add focus skills (comma separated)..." 
                className="sleek-input h-10"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
            </div>

            <button 
              className="sleek-btn-primary mt-2 flex items-center justify-center gap-2"
              onClick={handleMatch}
              disabled={isMatching || !selectedRole}
            >
              {isMatching ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Sparkles size={16} />
              )}
              {isMatching ? "Processing..." : "Run Smart Match"}
            </button>
            <Progress value={isMatching ? (matchStep === 'ranking' ? 75 : matchStep === 'matching' ? 50 : 25) : 0} className={`h-1.5 mt-2 ${isMatching ? 'opacity-100' : 'opacity-0'} transition-opacity`} />
          </CardContent>
        </Card>
      </div>

      {/* Right Panel: Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[18px] font-bold text-text-main flex items-center gap-2">
            Top Talent Matches
            {results.length > 0 && <span className="font-normal text-[14px] text-text-secondary ml-2">{results.length} matched candidates</span>}
          </h2>
        </div>

        {results.length === 0 && !isMatching ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-lg border border-dashed border-border">
            <div className="w-12 h-12 bg-bg rounded-full flex items-center justify-center text-text-secondary mb-4">
              <Search size={24} />
            </div>
            <h3 className="font-semibold text-text-main">Ready for Talent Matching</h3>
            <p className="text-[13px] text-text-secondary max-w-xs mt-1">
              Select a role and run the AI matching engine to identify top talent from your library.
            </p>
          </div>
        ) : isMatching ? (
          <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-lg border border-border">
             <Loader2 size={40} className="text-primary animate-spin mb-4" />
             <h3 className="font-semibold text-text-main">AI Talent Analysis in Progress</h3>
             <p className="text-[13px] text-text-secondary mt-1 uppercase tracking-widest font-bold">{matchStep}...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {results.map((res, idx) => (
              <div 
                key={res.id} 
                className="flex items-center p-4 bg-white rounded-lg border border-border hover:border-primary transition-all cursor-pointer shadow-sm group"
                onClick={() => {
                  setPreviewCandidate(res);
                  setZoom(100);
                }}
              >
                <div className={`w-12 h-12 rounded-full border-[3px] flex items-center justify-center font-extrabold text-[14px] shrink-0 mr-4 ${
                  idx === 0 ? "border-primary text-primary" : 
                  res.score > 90 ? "border-blue-400 text-blue-400" : "border-text-secondary text-text-secondary"
                }`}>
                  {res.score}%
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-[15px] text-text-main">{res.name}</div>
                  <div className="text-[12px] text-text-secondary mt-0.5">
                    {res.recentTitle} at {res.field}
                  </div>
                  <div className="text-[11px] font-bold text-primary mt-1 uppercase tracking-wider">
                    Matched Skills: {res.matchedSkills.slice(0, 3).join(", ")}
                  </div>
                </div>
                <button className="px-4 py-2 rounded-[6px] bg-bg border border-border text-[12px] font-semibold text-text-main hover:bg-slate-100 transition-colors">
                  View Match Analysis
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
