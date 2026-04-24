/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { 
  Users, 
  Briefcase, 
  Building2, 
  Search, 
  FileText, 
  LayoutDashboard,
  Plus,
  Upload,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster, toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { UploadProvider } from "./context/UploadContext";
import { MatchingProvider } from "./context/MatchingContext";
import { NavigationProvider, useNavigation } from "./context/NavigationContext";
import { GlobalUploadProgress } from "./components/GlobalUploadProgress";
import { GlobalMatchingProgress } from "./components/GlobalMatchingProgress";
import MatchingPage from "./pages/Matching";
import CandidatesPage from "./pages/Candidates";
import JobRolesPage from "./pages/JobRoles";
import DepartmentsPage from "./pages/Departments";

function AppContent() {
  const { activePage, setActivePage } = useNavigation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const navItems = [
    { id: "matching" as const, label: "Talent Matching", icon: LayoutDashboard },
    { id: "candidates" as const, label: "Candidate Library", icon: Users },
    { id: "roles" as const, label: "Job Roles", icon: Briefcase },
    { id: "departments" as const, label: "Departments", icon: Building2 },
  ];

  return (
    <div className="min-h-screen bg-bg flex font-sans text-text-main">
      <Toaster position="top-right" />
      <GlobalUploadProgress />
      <GlobalMatchingProgress />
      
      {/* Sidebar */}
      <aside 
        className={`bg-sidebar-bg border-r border-border transition-all duration-300 flex flex-col ${
          isSidebarOpen ? "w-[240px]" : "w-20"
        }`}
      >
        <div className="p-6 flex items-center gap-2.5">
          <div className="text-2xl font-extrabold text-primary shrink-0">
            ◈
          </div>
          {isSidebarOpen && <span className="font-extrabold text-xl text-primary tracking-tight">MatchAI</span>}
        </div>

        <nav className="flex-1 py-6 space-y-0">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 text-sm font-medium transition-all relative ${
                activePage === item.id 
                  ? "text-primary bg-primary-light border-r-[3px] border-primary" 
                  : "text-text-secondary hover:text-text-main"
              }`}
            >
              <item.icon size={18} />
              {isSidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <Button 
            variant="ghost" 
            size="sm" 
            className="w-full justify-start text-text-secondary hover:text-text-main"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            {isSidebarOpen ? <X size={18} className="mr-2" /> : <Menu size={18} />}
            {isSidebarOpen && "Collapse Sidebar"}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white border-b border-border flex items-center justify-between px-8 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={14} />
            <input 
              type="text" 
              className="bg-bg border border-border py-2 pl-9 pr-4 rounded-md w-[300px] text-[13px] outline-none focus:border-primary transition-colors" 
              placeholder="Search candidates or roles..."
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="text-[12px] font-semibold text-text-main">
              Admin Portal
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-200 border border-border" />
          </div>
        </header>

        <div className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {activePage === "matching" && <MatchingPage />}
              {activePage === "candidates" && <CandidatesPage />}
              {activePage === "roles" && <JobRolesPage />}
              {activePage === "departments" && <DepartmentsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <UploadProvider>
        <MatchingProvider>
          <AppContent />
        </MatchingProvider>
      </UploadProvider>
    </NavigationProvider>
  );
}

