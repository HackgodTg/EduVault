import * as React from "react";
import { motion } from "motion/react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { UserCog, BarChart3, Users, ShieldCheck, FileCheck, Settings, CheckCircle2, XCircle, ExternalLink, FileText, BookOpen, Link as LinkIcon, Eye, Upload, Search, Trash2 } from "lucide-react";
import { doc, updateDoc, collection, query, where, getDocs, orderBy, serverTimestamp, deleteDoc, addDoc, onSnapshot } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { toast } from "sonner";
import { pdfService, PDFResource } from "../lib/pdfService";
import { Input } from "@/components/ui/input";

const StatusBadge = ({ status }: { status: string }) => {
  const colors = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    approved: "bg-green-100 text-green-700 border-green-200",
    rejected: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[status as keyof typeof colors]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

interface HODDashboardProps {
  user: any;
  userProfile: any;
  onProfileUpdate: () => void;
}

type HODView = "main" | "approvals" | "faculty" | "analytics" | "students";

export default function HODDashboard({ user, userProfile, onProfileUpdate }: HODDashboardProps) {
  const [activeView, setActiveView] = React.useState<HODView>("main");
  const [department, setDepartment] = React.useState(userProfile?.department || "");
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [pendingResources, setPendingResources] = React.useState<PDFResource[]>([]);
  const [allResources, setAllResources] = React.useState<PDFResource[]>([]);
  const [isLoadingPending, setIsLoadingPending] = React.useState(false);
  const [activeTeachersCount, setActiveTeachersCount] = React.useState(0);
  const [departmentTeachers, setDepartmentTeachers] = React.useState<any[]>([]);
  const [departmentStudents, setDepartmentStudents] = React.useState<any[]>([]);
  
  // Generate Paper State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploadSubject, setUploadSubject] = React.useState("");
  const [uploadUrl, setUploadUrl] = React.useState("");
  const [uploadCategory, setUploadCategory] = React.useState<"qb" | "pyq" | "library" | "resources">("qb");

  const isProfileComplete = !!userProfile?.department;

  React.useEffect(() => {
    if (!userProfile?.department) return;

    const unsubscribe = pdfService.subscribeToDepartmentResources(userProfile.department, (resources) => {
      setAllResources(resources);
      setPendingResources(resources.filter(r => r.status === 'pending'));
    });

    // Fetch active teachers count
    const teachersQuery = query(
      collection(db, "users"),
      where("department", "==", userProfile.department),
      where("role", "==", "teacher")
    );

    const unsubscribeTeachers = onSnapshot(teachersQuery, (snapshot) => {
      setActiveTeachersCount(snapshot.size);
      setDepartmentTeachers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    // Fetch department students
    const studentsQuery = query(
      collection(db, "users"),
      where("department", "==", userProfile.department),
      where("role", "==", "student")
    );

    const unsubscribeStudents = onSnapshot(studentsQuery, (snapshot) => {
      setDepartmentStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "users");
    });

    return () => {
      unsubscribe();
      unsubscribeTeachers();
      unsubscribeStudents();
    };
  }, [userProfile?.department]);

  const handleApprove = async (id: string) => {
    try {
      await pdfService.updateStatus(id, 'approved');
      toast.success("Resource approved!");
    } catch (error) {
      toast.error("Failed to approve resource");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await pdfService.updateStatus(id, 'rejected');
      toast.success("Resource rejected");
    } catch (error) {
      toast.error("Failed to reject resource");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !uploadSubject || !uploadUrl) {
      toast.error("Please fill all fields");
      return;
    }

    setIsUpdating(true);
    try {
      await pdfService.add({
        title: uploadTitle,
        subject: uploadSubject,
        url: uploadUrl,
        category: uploadCategory,
        department: userProfile.department,
        teacherName: userProfile.name,
        teacherId: userProfile.erpId,
        uploaderRole: "hod",
        year: "ALL",
        semester: "ALL"
      });
      
      // HOD uploads are auto-approved in some systems, but let's keep it pending for consistency or auto-approve if uploader is HOD
      // Actually, let's auto-approve HOD uploads
      const resources = await getDocs(query(collection(db, "academic_resources"), where("url", "==", uploadUrl)));
      if (!resources.empty) {
        await pdfService.updateStatus(resources.docs[0].id, 'approved');
      }

      toast.success("Document uploaded and shared!");
      setUploadTitle("");
      setUploadSubject("");
      setUploadUrl("");
    } catch (error) {
      toast.error("Upload failed");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    try {
      await pdfService.delete(id);
      toast.success("Document deleted");
    } catch (error) {
      toast.error("Delete failed");
    }
  };

  const filteredResources = allResources.filter(r => 
    r.status === 'approved' && (
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.teacherName.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  const handleSaveProfile = async () => {
    if (!department) {
      toast.error("Please select your department");
      return;
    }

    setIsUpdating(true);
    try {
      const erpId = userProfile.erpId;
      const userDocRef = doc(db, "users", erpId);
      
      await updateDoc(userDocRef, {
        department,
        profileComplete: true
      });

      toast.success("Profile updated successfully!");
      onProfileUpdate();
    } catch (error: any) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isProfileComplete) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <UserCog className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">HOD Onboarding</CardTitle>
              <CardDescription>
                Select your department to oversee question banks and faculty contributions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={department} onValueChange={setDepartment}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {["ES AND H", "IOT", "COMP", "CIVIL", "MECH", "EXTC", "ENTC", "ENCS"].map((dept) => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                className="w-full" 
                onClick={handleSaveProfile} 
                disabled={isUpdating}
              >
                {isUpdating ? "Saving..." : "Enter Dashboard"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (activeView === "faculty") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2">
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Faculty Contributions</h1>
            <p className="text-muted-foreground">Monitor uploads and activity of department teachers</p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6">
          {departmentTeachers.length === 0 ? (
            <Card className="border-none shadow-sm bg-white">
              <CardContent className="py-12 text-center text-muted-foreground italic">
                No teachers found in this department.
              </CardContent>
            </Card>
          ) : (
            departmentTeachers.map((teacher) => {
              const teacherResources = allResources.filter(r => r.teacherId === teacher.erpId);
              return (
                <Card key={teacher.id} className="border-none shadow-sm bg-white overflow-hidden">
                  <CardHeader className="bg-gray-50/50 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{teacher.name}</CardTitle>
                          <CardDescription>ERP ID: {teacher.erpId} • {teacher.email}</CardDescription>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">{teacherResources.length}</p>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Uploads</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {teacherResources.length === 0 ? (
                      <div className="p-8 text-center text-sm text-muted-foreground italic">
                        No documents uploaded yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100">
                        {teacherResources.map((res) => (
                          <div key={res.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3">
                              <FileText className={cn(
                                "w-4 h-4",
                                res.category === 'qb' ? "text-blue-500" : 
                                res.category === 'pyq' ? "text-purple-500" : 
                                res.category === 'library' ? "text-emerald-500" : "text-indigo-500"
                              )} />
                              <div>
                                <p className="text-sm font-medium">{res.title}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">{res.subject} • {res.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <StatusBadge status={res.status} />
                              <a 
                                href={res.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 w-8 p-0")}
                              >
                                <Eye className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  if (activeView === "students") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2">
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Student Directory</h1>
            <p className="text-muted-foreground">List of all students in {userProfile.department} department</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Students</CardTitle>
                <CardDescription>Total: {departmentStudents.length} students</CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 font-bold">Name</th>
                    <th className="px-4 py-3 font-bold">ERP ID</th>
                    <th className="px-4 py-3 font-bold">Year</th>
                    <th className="px-4 py-3 font-bold">Semester</th>
                    <th className="px-4 py-3 font-bold">Division</th>
                    <th className="px-4 py-3 font-bold">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {departmentStudents
                    .filter(s => 
                      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.erpId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 font-medium">{student.name}</td>
                      <td className="px-4 py-4">{student.erpId}</td>
                      <td className="px-4 py-4 uppercase">{student.year}</td>
                      <td className="px-4 py-4">{student.semester}</td>
                      <td className="px-4 py-4">{student.division}</td>
                      <td className="px-4 py-4 text-muted-foreground">{student.email}</td>
                    </tr>
                  ))}
                  {departmentStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground italic">
                        No students found in this department.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeView === "analytics") {
    const categoryData = [
      { name: 'Question Banks', value: allResources.filter(r => r.category === 'qb').length },
      { name: 'PYQ Papers', value: allResources.filter(r => r.category === 'pyq').length },
      { name: 'Library', value: allResources.filter(r => r.category === 'library').length },
      { name: 'Resources', value: allResources.filter(r => r.category === 'resources').length },
    ];

    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2">
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Department Analytics</h1>
            <p className="text-muted-foreground">Growth and distribution metrics for {userProfile.department}</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Resource Distribution</CardTitle>
              <CardDescription>Breakdown by category</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px] flex items-end justify-around gap-2 pb-8">
              {categoryData.map((item) => {
                const max = Math.max(...categoryData.map(d => d.value), 1);
                const height = (item.value / max) * 100;
                return (
                  <div key={item.name} className="flex flex-col items-center gap-2 w-full">
                    <div className="w-full bg-gray-50 rounded-t-lg relative group h-full flex items-end">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        className="w-full bg-primary/20 group-hover:bg-primary/30 transition-colors rounded-t-lg flex items-center justify-center"
                      >
                        <span className="text-xs font-bold text-primary mb-2">{item.value}</span>
                      </motion.div>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground text-center line-clamp-1">{item.name}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Top Contributors</CardTitle>
              <CardDescription>Teachers with most uploads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {departmentTeachers
                  .map(t => ({
                    name: t.name,
                    count: allResources.filter(r => r.teacherId === t.erpId).length
                  }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map((contributor, idx) => (
                    <div key={contributor.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-muted-foreground w-4">{idx + 1}.</span>
                        <span className="text-sm font-medium">{contributor.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary" 
                            style={{ width: `${(contributor.count / Math.max(...allResources.length ? [allResources.length] : [1])) * 100}%` }} 
                          />
                        </div>
                        <span className="text-xs font-bold">{contributor.count}</span>
                      </div>
                    </div>
                  ))
                }
                {departmentTeachers.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground italic py-8">No data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeView === "approvals") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2">
              Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Pending Approvals</h1>
            <p className="text-muted-foreground">Review and approve academic materials for {userProfile.department}</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Resource Queue</CardTitle>
            <CardDescription>Materials waiting for your verification</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingPending ? (
              <div className="py-12 text-center">Loading pending resources...</div>
            ) : pendingResources.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground italic">No pending approvals at this time.</div>
            ) : (
              <div className="space-y-4">
                {pendingResources.map((res) => (
                  <div key={res.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-100 shadow-sm">
                        <FileText className="text-blue-500" />
                      </div>
                      <div>
                        <h3 className="font-bold">{res.title}</h3>
                        <p className="text-sm text-muted-foreground uppercase font-medium">
                          {res.subject} • By {res.teacherName}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <StatusBadge status={res.status} />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a 
                        href={res.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Eye className="w-4 h-4 mr-2" /> View Link
                      </a>
                      {res.status === 'pending' && (
                        <>
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(res.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">HOD Dashboard</h1>
          <p className="text-muted-foreground">
            Head of Department • {userProfile.department}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("analytics")}
        >
          <CardHeader>
            <BarChart3 className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Monitor repository growth and usage</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("faculty")}
        >
          <CardHeader>
            <Users className="w-8 h-8 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Faculty Contributions</CardTitle>
            <CardDescription>Review uploads by department teachers</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("approvals")}
        >
          <CardHeader>
            <FileCheck className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Approvals</CardTitle>
            <CardDescription>Verify and approve new question banks</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("students")}
        >
          <CardHeader>
            <ShieldCheck className="w-8 h-8 text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Student Directory</CardTitle>
            <CardDescription>View all students in your department</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Department Overview</CardTitle>
            <CardDescription>Status of subject repositories in {userProfile.department}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                <Settings className="w-6 h-6 text-gray-300" />
              </div>
              <p>No department data available yet.</p>
              <p className="text-sm">Data will appear as teachers start contributing.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Department Stats</CardTitle>
            <CardDescription>Quick metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Active Teachers</span>
              <span className="text-xl font-bold text-primary">{activeTeachersCount}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Total Documents</span>
              <span className="text-xl font-bold text-primary">{allResources.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium">Pending Reviews</span>
              <span className="text-xl font-bold text-primary">{pendingResources.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
