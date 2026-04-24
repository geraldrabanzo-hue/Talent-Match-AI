import { useState, useEffect, ChangeEvent } from "react";
import { Briefcase, Plus, Search, Trash2, Edit2, FileDown, FileUp, Loader2 } from "lucide-react";
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { JobRole, Department } from "../types";
import { useMatching } from "../context/MatchingContext";
import { useNavigation } from "../context/NavigationContext";
import { Sparkles } from "lucide-react";

export default function JobRolesPage() {
  const [roles, setRoles] = useState<JobRole[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { isMatching, startMatching, setSelectedRole } = useMatching();
  const { setActivePage } = useNavigation();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newRole, setNewRole] = useState({
    title: "",
    departmentId: "",
    description: ""
  });

  const [editingRole, setEditingRole] = useState<JobRole | null>(null);

  useEffect(() => {
    fetch("/api/roles").then(res => res.json()).then(setRoles);
    fetch("/api/departments").then(res => res.json()).then(setDepartments);
  }, []);

  const handleAddRole = async () => {
    if (!newRole.title || !newRole.departmentId || !newRole.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRole)
      });
      const savedRole = await res.json();
      setRoles([...roles, savedRole]);
      toast.success("Job role created successfully");
      setIsAddModalOpen(false);
      setNewRole({ title: "", departmentId: "", description: "" });
    } catch (error) {
      toast.error("Failed to create job role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditRole = async () => {
    if (!editingRole || !editingRole.title || !editingRole.departmentId || !editingRole.description) {
      toast.error("Please fill in all fields");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${editingRole.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingRole)
      });
      const updated = await res.json();
      setRoles(roles.map(r => r.id === updated.id ? updated : r));
      toast.success("Job role updated successfully");
      setIsEditModalOpen(false);
      setEditingRole(null);
    } catch (error) {
      toast.error("Failed to update job role");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteRole = async () => {
    if (!deleteConfirmId) return;

    try {
      await fetch(`/api/roles/${deleteConfirmId}`, { method: "DELETE" });
      setRoles(roles.filter(r => r.id !== deleteConfirmId));
      toast.success("Job role removed successfully");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("Failed to remove job role");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { "Job Title": "Senior Frontend Developer", "Department Name": "Engineering", "Job Description": "Expertise in React, TypeScript, Tailwind..." },
      { "Job Title": "Product Manager", "Department Name": "Product", "Job Description": "AI/ML product roadmap experience..." },
      { "Job Title": "UX Designer", "Department Name": "Design", "Job Description": "Figma expertise, user research..." }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Job Roles Template");
    XLSX.writeFile(wb, "Job_Roles_Template.xlsx");
  };

  const handleBulkUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const dataBuffer = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(dataBuffer, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        const formattedRoles = (jsonData as any[]).map((row: any) => {
          const keys = Object.keys(row);
          
          // Flexible mapping
          const findKey = (keywords: string[]) => 
            keys.find(k => keywords.some(kw => k.toLowerCase().includes(kw))) || "";

          const titleKey = findKey(["title", "role", "job"]);
          const deptKey = findKey(["dept", "department"]);
          const descKey = findKey(["desc", "requirement", "responsibility"]);

          return {
            title: row[titleKey] || row["Job Title"] || row["Title"] || "",
            departmentName: row[deptKey] || row["Department Name"] || row["Department"] || "",
            description: row[descKey] || row["Job Description"] || row["Description"] || ""
          };
        }).filter(r => r.title && r.departmentName);

        if (formattedRoles.length === 0) {
          toast.error("No valid job roles found. Please ensure your Excel has 'Title' and 'Department' columns.");
          return;
        }

        const res = await fetch("/api/roles/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formattedRoles)
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Bulk upload failed on server");
        }

        const result = await res.json();
        
        // Refresh both lists because departments might have been auto-created
        const [rolesRes, deptsRes] = await Promise.all([
          fetch("/api/roles"),
          fetch("/api/departments")
        ]);
        
        const [rolesData, deptsData] = await Promise.all([
          rolesRes.json(),
          deptsRes.json()
        ]);

        setRoles(rolesData);
        setDepartments(deptsData);
        
        let msg = `Upload complete: ${result.summary.added} added, ${result.summary.updated} updated.`;
        if (result.summary.departmentsCreated > 0) {
          msg += ` ${result.summary.departmentsCreated} new departments created.`;
        }
        toast.success(msg);
        setIsBulkModalOpen(false);
      } catch (error) {
        toast.error("Failed to process bulk upload. Please check file format.");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredRoles = roles.filter(r => 
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    departments.find(d => d.id === r.departmentId)?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isAddingNewDept, setIsAddingNewDept] = useState(false);
  const [newDeptInput, setNewDeptInput] = useState("");

  const handleAddNewDept = async () => {
    if (!newDeptInput) return;
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptInput })
      });
      const savedDept = await res.json();
      setDepartments([...departments, savedDept]);
      setNewRole({ ...newRole, departmentId: savedDept.id });
      setIsAddingNewDept(false);
      setNewDeptInput("");
      toast.success(`Department "${savedDept.name}" created`);
    } catch (error) {
      toast.error("Failed to create department");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
          <Input 
            placeholder="Search roles or departments..." 
            className="sleek-input pl-10 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button id="btn-open-bulk-roles" variant="outline" className="h-10 border-border text-text-main hover:bg-bg" onClick={() => setIsBulkModalOpen(true)}>
            <FileUp size={18} className="mr-2" /> Bulk Upload
          </Button>
          <Button id="btn-open-add-role" className="sleek-btn-primary w-auto px-6 gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Role
          </Button>
        </div>
      </div>

      <Card className="sleek-card border-none shadow-sleek overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-bg border-b border-border">
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Job Title</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Department</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6">Description Preview</TableHead>
              <TableHead className="text-[11px] uppercase font-bold text-text-secondary px-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRoles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center text-text-secondary">
                  No job roles found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRoles.map((role) => (
                <TableRow key={role.id} className="group hover:bg-bg transition-colors border-b border-border last:border-0">
                  <TableCell className="px-6 py-4 font-semibold text-text-main">{role.title}</TableCell>
                  <TableCell className="px-6 py-4">
                    <Badge variant="secondary" className="bg-primary-light text-primary font-semibold text-[11px] rounded-[4px] border-none">
                      {departments.find(d => d.id === role.departmentId)?.name || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <p className="text-[13px] text-text-secondary line-clamp-1 max-w-md">{role.description}</p>
                  </TableCell>
                  <TableCell className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 text-border">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-text-secondary hover:text-primary transition-colors"
                        onClick={() => {
                          setEditingRole(role);
                          setIsEditModalOpen(true);
                        }}
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-primary hover:bg-primary/10 transition-colors"
                        disabled={isMatching}
                        onClick={async () => {
                          const res = await fetch("/api/candidates");
                          const candidates = await res.json();
                          setSelectedRole(role.id);
                          startMatching(candidates, roles, () => {
                            setActivePage("matching");
                          });
                        }}
                      >
                        <Sparkles size={16} />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-text-secondary hover:text-red-600 transition-colors"
                        onClick={() => setDeleteConfirmId(role.id)}
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

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Job Role?</DialogTitle>
            <DialogDescription>
              This will permanently remove the role and its description. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteRole}>Delete Role</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Role Modal */}
      {/* ... keeping existing dialog ... */}

      {/* Edit Role Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Edit Job Role</DialogTitle>
            <DialogDescription>Update the role details and requirements.</DialogDescription>
          </DialogHeader>
          
          {editingRole && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              <div className="space-y-2">
                <label className="font-bold">Job Title</label>
                <Input 
                  placeholder="e.g. Senior Product Manager" 
                  className="sleek-input"
                  value={editingRole.title}
                  onChange={(e) => setEditingRole({ ...editingRole, title: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="font-bold">Department</label>
                <Select 
                  value={editingRole.departmentId} 
                  onValueChange={(val) => setEditingRole({ ...editingRole, departmentId: val })}
                >
                  <SelectTrigger className="sleek-input">
                    <SelectValue>
                      {departments.find(d => d.id === editingRole.departmentId)?.name || "Select Department"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="font-bold">Job Description</label>
                <Textarea 
                  placeholder="Paste the full job description here..." 
                  className="min-h-[300px] sleek-input resize-none"
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter className="p-6 pt-2 border-t border-border bg-bg/50">
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setEditingRole(null);
            }}>Cancel</Button>
            <Button className="sleek-btn-primary w-auto px-8" onClick={handleEditRole} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[600px] h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle>Add New Job Role</DialogTitle>
            <DialogDescription>Define a new job role and its description for AI matching.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
            <div className="space-y-2">
              <label>Job Title</label>
              <Input 
                placeholder="e.g. Senior Product Manager" 
                className="sleek-input"
                value={newRole.title}
                onChange={(e) => setNewRole({ ...newRole, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label>Department</label>
              {isAddingNewDept ? (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Enter new department name..." 
                    className="sleek-input"
                    value={newDeptInput}
                    onChange={(e) => setNewDeptInput(e.target.value)}
                    autoFocus
                  />
                  <Button size="sm" className="bg-primary" onClick={handleAddNewDept}>Add</Button>
                  <Button size="sm" variant="ghost" onClick={() => setIsAddingNewDept(false)}>Cancel</Button>
                </div>
              ) : (
                <Select 
                  value={newRole.departmentId} 
                  onValueChange={(val) => {
                    if (val === "ADD_NEW") {
                      setIsAddingNewDept(true);
                    } else {
                      setNewRole({ ...newRole, departmentId: val });
                    }
                  }}
                >
                  <SelectTrigger className="sleek-input">
                    <SelectValue>
                      {departments.find(d => d.id === newRole.departmentId)?.name || "Select Department"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                    <div className="border-t border-border mt-1 pt-1">
                      <SelectItem value="ADD_NEW" className="text-primary font-bold">
                        + Add New Department
                      </SelectItem>
                    </div>
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label>Job Description</label>
              <Textarea 
                placeholder="Paste the full job description here..." 
                className="min-h-[300px] sleek-input resize-none"
                value={newRole.description}
                onChange={(e) => setNewRole({ ...newRole, description: e.target.value })}
              />
              <p className="text-[11px] text-text-secondary italic">
                The more detailed the description, the better the AI matching results.
              </p>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t border-border bg-bg/50">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button className="sleek-btn-primary w-auto px-8" onClick={handleAddRole} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Job Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Modal */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Upload Job Roles</DialogTitle>
            <DialogDescription>Upload an Excel file with multiple job roles at once.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-6">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white rounded border text-blue-600">
                  <FileDown size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium">Download Template</p>
                  <p className="text-xs text-slate-500">Get the Excel format required</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>Download</Button>
            </div>

            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center border-slate-200 hover:border-blue-300 hover:bg-slate-50 transition-colors">
              <FileUp size={32} className="text-slate-400 mb-4" />
              <p className="text-sm font-medium text-slate-700">Upload your filled template</p>
              <input 
                type="file" 
                className="hidden" 
                id="bulk-upload" 
                accept=".xlsx,.xls"
                onChange={handleBulkUpload}
              />
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-4"
                onClick={() => document.getElementById("bulk-upload")?.click()}
              >
                Select Excel File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
