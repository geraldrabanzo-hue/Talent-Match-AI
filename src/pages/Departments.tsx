import { useState, useEffect, ChangeEvent } from "react";
import { Building2, Plus, Search, Trash2, Edit2, FileUp, FileDown, Loader2 } from "lucide-react";
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
import * as XLSX from "xlsx";
import { Department } from "../types";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [editingDept, setEditingDept] = useState<Department | null>(null);

  useEffect(() => {
    fetch("/api/departments").then(res => res.json()).then(setDepartments);
  }, []);

  const handleAddDept = async () => {
    if (!newDeptName) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDeptName })
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to add department");
        return;
      }
      
      const savedDept = await res.json();
      setDepartments([...departments, savedDept]);
      toast.success("Department added successfully");
      setIsAddModalOpen(false);
      setNewDeptName("");
    } catch (error) {
      toast.error("Failed to add department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditDept = async () => {
    if (!editingDept || !editingDept.name) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/departments/${editingDept.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingDept.name })
      });
      const updatedDept = await res.json();
      setDepartments(departments.map(d => d.id === updatedDept.id ? updatedDept : d));
      toast.success("Department updated successfully");
      setIsEditModalOpen(false);
      setEditingDept(null);
    } catch (error) {
      toast.error("Failed to update department");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteDept = async () => {
    if (!deleteConfirmId) return;

    try {
      await fetch(`/api/departments/${deleteConfirmId}`, { method: "DELETE" });
      setDepartments(departments.filter(d => d.id !== deleteConfirmId));
      toast.success("Department and its roles removed");
      setDeleteConfirmId(null);
    } catch (error) {
      toast.error("Failed to remove department");
    }
  };

  const downloadTemplate = () => {
    const template = [
      { "Department Name": "Engineering" },
      { "Department Name": "Human Resources" },
      { "Department Name": "Finance" },
      { "Department Name": "Operations" },
      { "Department Name": "Legal" }
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Departments Template");
    XLSX.writeFile(wb, "Departments_Template.xlsx");
  };

  const handleBulkUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json(ws);

        const newDepts = (jsonData as any[]).map(row => {
          // Flexible header detection: search all keys for "dept" or "name" or just use the first column
          const keys = Object.keys(row);
          const deptKey = keys.find(k => 
            k.toLowerCase().includes("dept") || 
            k.toLowerCase().includes("name")
          ) || keys[0];
          
          const nameValue = row[deptKey];
          return { name: nameValue ? String(nameValue).trim() : "" };
        }).filter(d => d.name && d.name.length > 0);
        
        if (newDepts.length === 0) {
          toast.error("No valid department records found. Please check your Excel headers.");
          return;
        }

        const res = await fetch("/api/departments/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newDepts)
        });
        
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || "Bulk upload failed on server");
        }
        
        const result = await res.json();
        
        // Ensure state is synced with server after bulk operation
        const updatedRes = await fetch("/api/departments");
        const updatedData = await updatedRes.json();
        setDepartments(updatedData);
        
        toast.success(`Bulk Upload Complete: ${result.summary.added} departments added, ${result.summary.skipped} skipped.`);
      } catch (error) {
        toast.error("Failed to parse or upload Excel file. Check format.");
      } finally {
        // Clear input to allow uploading the same file again
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const filteredDepts = departments.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="relative w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={16} />
          <Input 
            placeholder="Search departments..." 
            className="sleek-input pl-10 h-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button id="btn-download-template" variant="outline" className="h-10 border-border text-text-main hover:bg-bg gap-2" onClick={downloadTemplate}>
            <FileDown size={18} /> Template
          </Button>
          <label id="bulk-upload-label-departments" className="cursor-pointer">
            <Button variant="outline" className="h-10 border-border text-text-main hover:bg-bg gap-2 pointer-events-none">
              <FileUp size={18} /> Bulk Upload
            </Button>
            <input id="input-bulk-upload-departments" type="file" className="hidden" accept=".xlsx,.xls" onChange={handleBulkUpload} />
          </label>
          <Button id="btn-add-department" className="sleek-btn-primary w-auto px-6 gap-2" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Department
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredDepts.map((dept) => (
          <Card key={dept.id} className="sleek-card border-none shadow-sleek group hover:border-primary transition-all">
            <CardContent className="p-0">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-light rounded-xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-main text-[16px]">{dept.name}</h3>
                    <p className="text-[11px] text-text-secondary uppercase tracking-widest font-bold mt-1">Department</p>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-text-secondary hover:text-primary"
                    onClick={() => {
                      setEditingDept(dept);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <Edit2 size={14} />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-text-secondary hover:text-red-600"
                    onClick={() => setDeleteConfirmId(dept.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Department?</DialogTitle>
            <DialogDescription>
              This action cannot be undone. All job roles associated with this department will also be removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteDept}>Delete Department</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Department</DialogTitle>
            <DialogDescription>Create a new organizational department.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block font-bold">Department Name</label>
            <Input 
              placeholder="e.g. Research & Development" 
              value={newDeptName}
              onChange={(e) => setNewDeptName(e.target.value)}
              className="sleek-input"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button className="sleek-btn-primary" onClick={handleAddDept} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Department
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Department</DialogTitle>
            <DialogDescription>Update the department name.</DialogDescription>
          </DialogHeader>
          {editingDept && (
            <div className="py-4">
              <label className="text-sm font-medium mb-2 block font-bold">Department Name</label>
              <Input 
                placeholder="e.g. Research & Development" 
                value={editingDept.name}
                onChange={(e) => setEditingDept({ ...editingDept, name: e.target.value })}
                className="sleek-input"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditModalOpen(false);
              setEditingDept(null);
            }}>Cancel</Button>
            <Button className="sleek-btn-primary" onClick={handleEditDept} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
