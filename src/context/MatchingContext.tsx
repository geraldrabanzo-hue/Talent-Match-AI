import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { JobRole, Candidate, MatchResult } from '../types';
import { matchCandidate } from '../lib/gemini';

interface MatchingContextType {
  isMatching: boolean;
  matchStep: "preparing" | "reading" | "matching" | "ranking" | "completed" | "idle";
  results: (Candidate & MatchResult)[];
  selectedDept: string;
  selectedRole: string;
  keywords: string;
  setSelectedDept: (dept: string) => void;
  setSelectedRole: (role: string) => void;
  setKeywords: (keywords: string) => void;
  startMatching: (candidates: Candidate[], roles: JobRole[], onComplete?: () => void) => Promise<void>;
  resetMatching: () => void;
}

const MatchingContext = createContext<MatchingContextType | undefined>(undefined);

export const MatchingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMatching, setIsMatching] = useState(false);
  const [matchStep, setMatchStep] = useState<"preparing" | "reading" | "matching" | "ranking" | "completed" | "idle">("idle");
  const [results, setResults] = useState<(Candidate & MatchResult)[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("all");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [keywords, setKeywords] = useState("");

  const resetMatching = useCallback(() => {
    setIsMatching(false);
    setMatchStep("idle");
    setResults([]);
  }, []);

  const startMatching = useCallback(async (candidates: Candidate[], roles: JobRole[], onComplete?: () => void) => {
    if (!selectedRole) {
      toast.error("Please select a job role first");
      return;
    }

    const role = roles.find(r => r.id === selectedRole);
    if (!role) return;

    if (candidates.length === 0) {
      toast.error("No candidates found in library to match.");
      return;
    }

    setIsMatching(true);
    setResults([]);
    setMatchStep("preparing");
    
    try {
      await new Promise(r => setTimeout(r, 600));
      setMatchStep("reading");
      await new Promise(r => setTimeout(r, 800));
      setMatchStep("matching");

      const matchedResults: (Candidate & MatchResult)[] = [];
      const batchSize = 1; // Serialize for maximum stability
      
      for (let i = 0; i < candidates.length; i += batchSize) {
        const batch = candidates.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(async (candidate) => {
          const match = await matchCandidate(candidate.cvText, role.description, keywords);
          return { ...candidate, ...match };
        }));
        matchedResults.push(...batchResults);
        
        // Progressive results update
        setResults([...matchedResults]);

        // Add a small breather between tasks
        if (i + batchSize < candidates.length) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }

      setMatchStep("ranking");
      await new Promise(r => setTimeout(r, 600));

      const sortedResults = [...matchedResults].sort((a, b) => b.score - a.score);
      setResults(sortedResults);
      setMatchStep("completed");
      toast.success(`Matched ${candidates.length} candidates successfully`);
      
      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("Matching Error:", error);
      toast.error("Failed to perform AI matching");
      setMatchStep("idle");
    } finally {
      setIsMatching(false);
    }
  }, [selectedRole, keywords]); // Approximation for dependencies

  return (
    <MatchingContext.Provider value={{ 
      isMatching, 
      matchStep, 
      results, 
      selectedDept, 
      selectedRole, 
      keywords,
      setSelectedDept,
      setSelectedRole,
      setKeywords,
      startMatching,
      resetMatching
    }}>
      {children}
    </MatchingContext.Provider>
  );
};

export const useMatching = () => {
  const context = useContext(MatchingContext);
  if (!context) throw new Error('useMatching must be used within a MatchingProvider');
  return context;
};
