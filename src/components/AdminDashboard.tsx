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
import { Input } from "@/components/ui/input";
import { ShieldCheck, Users, Database, Settings, Activity, Lock, FileText, ChevronLeft, BookOpen, Search, ExternalLink, CheckCircle2, XCircle, FileCheck, Link as LinkIcon, Eye, Upload, Mail, BarChart3, GraduationCap } from "lucide-react";
import { collection, query, where, getDocs, orderBy, doc, updateDoc, serverTimestamp, deleteDoc, addDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { pdfService, PDFResource } from "../lib/pdfService";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

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

interface AdminDashboardProps {
  user: any;
  userProfile: any;
  onProfileUpdate: () => void;
}

const DEPARTMENTS = ["COMP", "IOT", "EXTC", "ENTC", "MECH", "CIVIL", "ENCS", "ES AND H"];
const YEARS = ["1", "2", "3", "4"];
const SEMESTERS = ["1", "2"];
const DIVISIONS = ["A", "B", "C", "D", "E", "F", "G"];

export default function AdminDashboard({ user, userProfile, onProfileUpdate }: AdminDashboardProps) {
  const [activeView, setActiveView] = React.useState<"main" | "exams" | "users" | "generate-paper" | "generate-paper-ai" | "generate-answers" | "approvals" | "analytics" | "students">("main");
  const [selectedDept, setSelectedDept] = React.useState("");
  const [selectedYear, setSelectedYear] = React.useState("");
  const [selectedSem, setSelectedSem] = React.useState("");
  const [selectedSubject, setSelectedSubject] = React.useState("");
  const [difficulty, setDifficulty] = React.useState("medium");
  const [maxMarks, setMaxMarks] = React.useState("100");
  const [pyqFiles, setPyqFiles] = React.useState<PDFResource[]>([]);
  const [qbFiles, setQbFiles] = React.useState<PDFResource[]>([]);
  const [pendingResources, setPendingResources] = React.useState<PDFResource[]>([]);
  const [managedUsers, setManagedUsers] = React.useState<any[]>([]);
  const [allStudents, setAllStudents] = React.useState<any[]>([]);
  const [allQuestions, setAllQuestions] = React.useState<any[]>([]);
  const [repeatedQuestionsData, setRepeatedQuestionsData] = React.useState<any[]>([]);
  const [selectedManagementDept, setSelectedManagementDept] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [generatedPaper, setGeneratedPaper] = React.useState<string | null>(null);
  const [generatedAnswers, setGeneratedAnswers] = React.useState<string | null>(null);
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Upload & Search states
  const [uploadTitle, setUploadTitle] = React.useState("");
  const [uploadSubject, setUploadSubject] = React.useState("");
  const [uploadUrl, setUploadUrl] = React.useState("");
  const [uploadCategory, setUploadCategory] = React.useState<"qb" | "pyq" | "library" | "resources">("qb");
  const [uploadDept, setUploadDept] = React.useState("");
  const [uploadYear, setUploadYear] = React.useState("1");
  const [uploadSem, setUploadSem] = React.useState("1");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isUpdating, setIsUpdating] = React.useState(false);

  const [allResources, setAllResources] = React.useState<PDFResource[]>([]);

  React.useEffect(() => {
    const unsubscribe = pdfService.subscribeToAll((resources) => {
      setAllResources(resources);
    });
    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    setPendingResources(allResources.filter(p => p.status === 'pending'));
    
    if (selectedDept && selectedYear && selectedSem) {
      setPyqFiles(allResources.filter(f => 
        f.department === selectedDept && 
        f.year === selectedYear && 
        f.semester === selectedSem && 
        f.category === 'pyq' && 
        f.status === 'approved'
      ));
      
      if (selectedSubject) {
        setQbFiles(allResources.filter(f => 
          f.department === selectedDept && 
          f.year === selectedYear && 
          f.semester === selectedSem && 
          f.subject.trim().toLowerCase() === selectedSubject.trim().toLowerCase() && 
          f.category === 'qb' && 
          f.status === 'approved'
        ));
      }
    }
  }, [allResources, selectedDept, selectedYear, selectedSem, selectedSubject]);

  const handleApprove = async (id: string) => {
    try {
      await pdfService.updateStatus(id, 'approved');
      toast.success("Resource approved!");
    } catch (error) {
      toast.error("Failed to approve");
    }
  };

  const handleReject = async (id: string) => {
    try {
      await pdfService.updateStatus(id, 'rejected');
      toast.success("Resource rejected");
    } catch (error) {
      toast.error("Failed to reject");
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle || !uploadSubject || !uploadUrl || !uploadDept) {
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
        department: uploadDept,
        year: uploadYear,
        semester: uploadSem,
        teacherName: userProfile.name,
        teacherId: userProfile.erpId,
        uploaderRole: 'admin',
        status: 'approved'
      });
      
      toast.success("Document uploaded and approved!");
      setUploadTitle("");
      setUploadSubject("");
      setUploadUrl("");
    } catch (error) {
      toast.error("Failed to upload document");
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredResources = allResources.filter(res => {
    const matchesSearch = 
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch && res.status === 'approved';
  });

  const fetchQBs = () => {
    if (!selectedDept || !selectedYear || !selectedSem || !selectedSubject) {
      toast.error("Please select all filters");
      return;
    }
  };

  const fetchPYQs = () => {
    if (!selectedDept || !selectedYear || !selectedSem) {
      toast.error("Please select all filters");
      return;
    }
  };

  const generatePaper = async () => {
    if (qbFiles.length === 0) {
      toast.error("No approved question banks found for this subject");
      return;
    }

    setIsGenerating(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const prompt = `You are an expert exam paper setter. Generate a professional question paper for the subject "${selectedSubject}" in the "${selectedDept}" department for Year ${selectedYear}, Semester ${selectedSem}.
      
      The difficulty level of the paper should be: ${difficulty.toUpperCase()}.
      The maximum marks for the paper should be: ${maxMarks}.
      
      The paper should follow this structure:
      1. Header with College Name (IES College of Engineering), Subject, Year, Semester, Max Marks (${maxMarks}), and Time (adjusted based on marks).
      2. Instructions for students.
      3. A balanced distribution of questions based on the ${maxMarks} marks total.
      
      Use the following question bank titles as context for the topics to cover:
      ${qbFiles.map(f => `- ${f.title}`).join("\n")}
      
      Ensure the questions are challenging and cover the breadth of the subject. Format the output in clean Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setGeneratedPaper(response.text || "Failed to generate paper.");
      toast.success("Question paper generated successfully!");
    } catch (error) {
      console.error("Error generating paper:", error);
      toast.error("Failed to generate question paper");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadPDF = async () => {
    if (!generatedPaper) return;
    
    const element = document.getElementById('paper-content');
    if (!element) return;

    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedSubject}_Question_Paper.pdf`);
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const generateAnswers = async () => {
    if (qbFiles.length === 0) {
      toast.error("No approved question banks found for this subject");
      return;
    }

    setIsGenerating(true);
    try {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const prompt = `You are an expert academic tutor. Generate detailed, accurate, and professional answers for the questions found in the following Question Banks for the subject "${selectedSubject}" (${selectedDept} Department).
      
      Question Banks to process:
      ${qbFiles.map(f => `- ${f.title}`).join("\n")}
      
      Instructions:
      1. Provide comprehensive answers for each topic/question mentioned in the banks.
      2. Use clear headings and bullet points.
      3. Include diagrams descriptions or mathematical formulas where relevant.
      4. Ensure the tone is educational and professional.
      5. Format the output in clean Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setGeneratedAnswers(response.text || "Failed to generate answers.");
      toast.success("Answers generated successfully!");
    } catch (error) {
      console.error("Error generating answers:", error);
      toast.error("Failed to generate answers");
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAnswersPDF = async () => {
    if (!generatedAnswers) return;
    
    const element = document.getElementById('answers-content');
    if (!element) return;

    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;
      
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`${selectedSubject}_Answers.pdf`);
      toast.success("Answers PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const fetchManagedUsers = async (dept: string) => {
    if (!dept) return;
    setIsLoading(true);
    try {
      // Fetch HODs and Teachers for the department
      const q = query(
        collection(db, "users"),
        where("department", "==", dept),
        where("role", "in", ["hod", "teacher"])
      );
      
      const snapshot = await getDocs(q);
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort: HOD first, then Teachers by year (1, 2, 3, 4)
      const sortedUsers = users.sort((a: any, b: any) => {
        if (a.role === "hod") return -1;
        if (b.role === "hod") return 1;
        
        // Both are teachers, sort by teachingYear
        const yearA = parseInt(a.teachingYear || "99");
        const yearB = parseInt(b.teachingYear || "99");
        return yearA - yearB;
      });
      
      setManagedUsers(sortedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (activeView === "users" && selectedManagementDept) {
      fetchManagedUsers(selectedManagementDept);
    }
    if (activeView === "students") {
      fetchAllStudents();
    }
    if (activeView === "analytics") {
      fetchAnalyticsData();
    }
  }, [activeView, selectedManagementDept]);

  const fetchAllStudents = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "users"), where("role", "==", "student"));
      const snapshot = await getDocs(q);
      const students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllStudents(students);
    } catch (error) {
      console.error("Error fetching students:", error);
      toast.error("Failed to load students");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      // Fetch all questions from question_banks
      const q = query(collection(db, "question_banks"));
      const snapshot = await getDocs(q);
      const questions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllQuestions(questions);

      // Analyze repetitions
      const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
      
      const counts: Record<string, { text: string, count: number, depts: Set<string>, years: Set<string> }> = {};
      
      questions.forEach((q: any) => {
        const normalized = normalize(q.question);
        if (!counts[normalized]) {
          counts[normalized] = { text: q.question, count: 0, depts: new Set(), years: new Set() };
        }
        counts[normalized].count += 1;
        counts[normalized].depts.add(q.department);
        counts[normalized].years.add(q.year);
      });

      const repeated = Object.values(counts)
        .filter(item => item.count > 1)
        .sort((a, b) => b.count - a.count)
        .map(item => ({
          ...item,
          depts: Array.from(item.depts).join(", "),
          years: Array.from(item.years).join(", ")
        }));

      setRepeatedQuestionsData(repeated);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setIsLoading(false);
    }
  };

  if (activeView === "exams") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Exam Repository</h1>
            <p className="text-muted-foreground">Access and manage uploaded Previous Year Question papers</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Filter PYQs</CardTitle>
            <CardDescription>Select criteria to find specific exam papers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Semester</Label>
                <Select value={selectedSem} onValueChange={setSelectedSem}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Sem" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map(sem => (
                      <SelectItem key={sem} value={sem}>Sem {sem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full mt-6 gap-2" onClick={fetchPYQs} disabled={isLoading}>
              <Search className="w-4 h-4" />
              {isLoading ? "Searching..." : "Search Papers"}
            </Button>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pyqFiles.length === 0 && !isLoading ? (
            <div className="col-span-full py-20 text-center text-muted-foreground bg-white rounded-xl border border-dashed">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No papers found for the selected criteria.</p>
            </div>
          ) : (
            pyqFiles.map((file) => (
              <Card key={file.id} className="border-none shadow-sm bg-white hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                    <a 
                      href={file.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                  <CardTitle className="text-lg mt-4">{file.title}</CardTitle>
                  <CardDescription className="uppercase font-medium text-xs">{file.subject}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">Dept: {file.department}</span>
                    <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded-full">Sem: {file.semester}</span>
                    <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">By {file.teacherName}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeView === "users") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage faculty hierarchy by department</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Select Department</CardTitle>
            <CardDescription>Filter faculty members by their department</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-w-xs">
              <Select value={selectedManagementDept} onValueChange={setSelectedManagementDept}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(dept => (
                    <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          {!selectedManagementDept ? (
            <div className="py-20 text-center text-muted-foreground bg-white rounded-xl border border-dashed">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>Please select a department to view faculty members.</p>
            </div>
          ) : isLoading ? (
            <div className="py-20 text-center text-muted-foreground bg-white rounded-xl border border-dashed">
              <Activity className="w-12 h-12 mx-auto mb-4 animate-pulse opacity-20" />
              <p>Loading faculty members...</p>
            </div>
          ) : managedUsers.length === 0 ? (
            <div className="py-20 text-center text-muted-foreground bg-white rounded-xl border border-dashed">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
              <p>No faculty members found for this department.</p>
            </div>
          ) : (
            managedUsers.map((u) => (
              <Card key={u.id} className="border-none shadow-sm bg-white overflow-hidden">
                <div className="flex items-center p-4 gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg ${
                    u.role === 'hod' ? 'bg-indigo-500' : 'bg-blue-400'
                  }`}>
                    {u.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg">{u.name}</h3>
                      {u.role === 'hod' && (
                        <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase">
                          HOD
                        </span>
                      )}
                      {u.role === 'teacher' && (
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">
                          Teacher
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      {u.role === 'hod' ? 'Department Head' : `Year ${u.teachingYear || 'N/A'}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {u.department} {u.division ? `• Div ${u.division}` : ''}
                    </p>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  if (activeView === "generate-paper") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Generate Paper & Global Resources</h1>
            <p className="text-muted-foreground">Upload, search and manage academic materials across all departments</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm bg-white h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-orange-500" />
                Upload New Document
              </CardTitle>
              <CardDescription>Share materials globally with all users</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                <div className="space-y-2">
                  <Label>Document Title</Label>
                  <Input 
                    placeholder="e.g. Unit 1 Question Bank" 
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subject</Label>
                  <Input 
                    placeholder="e.g. Operating Systems" 
                    value={uploadSubject}
                    onChange={(e) => setUploadSubject(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Department</Label>
                    <Select value={uploadDept} onValueChange={setUploadDept}>
                      <SelectTrigger>
                        <SelectValue placeholder="Dept" />
                      </SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={uploadCategory} onValueChange={(val: any) => setUploadCategory(val)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="qb">Question Bank</SelectItem>
                        <SelectItem value="pyq">PYQ Paper</SelectItem>
                        <SelectItem value="library">Textbook</SelectItem>
                        <SelectItem value="resources">General Resource</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Year</Label>
                    <Select value={uploadYear} onValueChange={setUploadYear}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {YEARS.map(y => <SelectItem key={y} value={y}>Year {y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Semester</Label>
                    <Select value={uploadSem} onValueChange={setUploadSem}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEMESTERS.map(s => <SelectItem key={s} value={s}>Sem {s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Drive/File Link</Label>
                  <Input 
                    placeholder="https://drive.google.com/..." 
                    value={uploadUrl}
                    onChange={(e) => setUploadUrl(e.target.value)}
                  />
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600" disabled={isUpdating}>
                  {isUpdating ? "Uploading..." : "Upload & Approve"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-none shadow-sm bg-white">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle>Global Repository</CardTitle>
                  <CardDescription>Search and access shared materials</CardDescription>
                </div>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search documents..." 
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredResources.length === 0 ? (
                <div className="py-20 text-center text-muted-foreground italic">
                  No documents found matching your search.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredResources.map((res) => (
                    <div key={res.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-100 shadow-sm">
                          <FileText className={cn(
                            "w-5 h-5",
                            res.category === 'qb' ? "text-blue-500" : 
                            res.category === 'pyq' ? "text-purple-500" : 
                            res.category === 'library' ? "text-emerald-500" : "text-indigo-500"
                          )} />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm">{res.title}</h3>
                          <p className="text-xs text-muted-foreground uppercase font-medium">
                            {res.subject} • {res.category.toUpperCase()} • {res.department}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            Uploaded by <span className="font-bold text-gray-700">{res.teacherName}</span> 
                            <span className="bg-gray-200 px-1 rounded text-[8px] uppercase">{res.uploaderRole || 'teacher'}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <a 
                          href={res.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "h-8 text-xs")}
                        >
                          <Eye className="w-3 h-3 mr-2" /> View
                        </a>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => pdfService.delete(res.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (activeView === "generate-paper-ai") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => {
              setActiveView("main");
              setGeneratedPaper(null);
              setQbFiles([]);
            }} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Generate Question Paper</h1>
            <p className="text-muted-foreground">AI-powered exam paper generation from approved question banks</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Paper Configuration</CardTitle>
            <CardDescription>Select criteria to fetch question banks and generate a paper</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Semester</Label>
                <Select value={selectedSem} onValueChange={setSelectedSem}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Sem" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map(sem => (
                      <SelectItem key={sem} value={sem}>Sem {sem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input 
                  placeholder="e.g. Data Structures" 
                  value={selectedSubject} 
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div className="space-y-2">
                <Label>Difficulty Level</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Max Marks</Label>
                <Select value={maxMarks} onValueChange={setMaxMarks}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Marks" />
                  </SelectTrigger>
                  <SelectContent>
                    {["10", "20", "40", "60", "80", "100"].map(m => (
                      <SelectItem key={m} value={m}>{m} Marks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <Button variant="outline" className="flex-1 gap-2" onClick={fetchQBs} disabled={isLoading}>
                <Search className="w-4 h-4" />
                {isLoading ? "Searching..." : "Fetch Question Banks"}
              </Button>
              <Button 
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700" 
                onClick={generatePaper} 
                disabled={isGenerating || qbFiles.length === 0}
              >
                <Activity className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? "Generating..." : "Generate Paper"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {qbFiles.length > 0 && !generatedPaper && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Available Question Banks ({qbFiles.length})</CardTitle>
              <CardDescription>These will be used as context for generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {qbFiles.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">{f.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">By {f.teacherName}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {generatedPaper && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Question Paper</CardTitle>
                <CardDescription>Review the AI-generated exam paper</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([generatedPaper], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedSubject}_Question_Paper.md`;
                  a.click();
                }}>
                  Download Markdown
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={downloadPDF}>
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="bg-gray-50 p-6 rounded-xl border border-gray-100 overflow-auto max-h-[800px]">
              <div id="paper-content" className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-white p-8 shadow-sm min-h-[297mm] w-full max-w-[210mm] mx-auto">
                {generatedPaper}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (activeView === "generate-answers") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => {
              setActiveView("main");
              setGeneratedAnswers(null);
              setQbFiles([]);
            }} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">AI Answer Generator</h1>
            <p className="text-muted-foreground">Generate comprehensive answers from approved faculty question banks</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Select subject details to fetch question banks and generate answers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Dept" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Year</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year}>Year {year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Semester</Label>
                <Select value={selectedSem} onValueChange={setSelectedSem}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="Select Sem" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEMESTERS.map(sem => (
                      <SelectItem key={sem} value={sem}>Sem {sem}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Subject Name</Label>
                <Input 
                  placeholder="e.g. Data Structures" 
                  value={selectedSubject} 
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="flex gap-4 mt-6">
              <Button variant="outline" className="flex-1 gap-2" onClick={fetchQBs} disabled={isLoading}>
                <Search className="w-4 h-4" />
                {isLoading ? "Searching..." : "Fetch Question Banks"}
              </Button>
              <Button 
                className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" 
                onClick={generateAnswers} 
                disabled={isGenerating || qbFiles.length === 0}
              >
                <BookOpen className={`w-4 h-4 ${isGenerating ? 'animate-spin' : ''}`} />
                {isGenerating ? "Generating Answers..." : "Generate Answers"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {qbFiles.length > 0 && !generatedAnswers && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Available Question Banks ({qbFiles.length})</CardTitle>
              <CardDescription>Answers will be generated based on these resources</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {qbFiles.map(f => (
                  <div key={f.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-emerald-500" />
                      <span className="text-sm font-medium">{f.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">By {f.teacherName}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {generatedAnswers && (
          <Card className="border-none shadow-sm bg-white">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Generated Answers</CardTitle>
                <CardDescription>Review the AI-generated study material</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => {
                  const blob = new Blob([generatedAnswers], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${selectedSubject}_Answers.md`;
                  a.click();
                }}>
                  Download Markdown
                </Button>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={downloadAnswersPDF}>
                  Download PDF
                </Button>
              </div>
            </CardHeader>
            <CardContent className="bg-gray-50 p-6 rounded-xl border border-gray-100 overflow-auto max-h-[800px]">
              <div id="answers-content" className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-white p-8 shadow-sm min-h-[297mm] w-full max-w-[210mm] mx-auto">
                <h1 className="text-2xl font-bold mb-6 text-center border-b pb-4">{selectedSubject} - Study Material</h1>
                {generatedAnswers}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  if (activeView === "analytics") {
    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];
    
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Question Analytics</h1>
            <p className="text-muted-foreground">Insights into question repetition and resource distribution</p>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Top Repeated Questions</CardTitle>
              <CardDescription>Frequency of questions appearing across different years/banks</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {repeatedQuestionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={repeatedQuestionsData.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="text" 
                      hide 
                    />
                    <YAxis />
                    <Tooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-4 border rounded-lg shadow-lg max-w-xs">
                              <p className="text-sm font-bold mb-1">{payload[0].payload.text}</p>
                              <p className="text-xs text-blue-600 font-bold">Repeated: {payload[0].value} times</p>
                              <p className="text-[10px] text-muted-foreground mt-1">Depts: {payload[0].payload.depts}</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground italic">
                  No repeated questions detected yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Summary Stats</CardTitle>
              <CardDescription>Quick overview of the question bank</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                <p className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">Total Questions</p>
                <p className="text-3xl font-black text-indigo-900">{allQuestions.length}</p>
              </div>
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Repeated Questions</p>
                <p className="text-3xl font-black text-orange-900">{repeatedQuestionsData.length}</p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">Repetition Rate</p>
                <p className="text-3xl font-black text-emerald-900">
                  {allQuestions.length > 0 ? ((repeatedQuestionsData.length / allQuestions.length) * 100).toFixed(1) : 0}%
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Detailed Repetition List</CardTitle>
            <CardDescription>Complete list of questions found multiple times in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {repeatedQuestionsData.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground italic">No repeated questions found.</div>
              ) : (
                repeatedQuestionsData.map((item, idx) => (
                  <div key={idx} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold text-sm mb-1">{item.text}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200">Depts: {item.depts}</span>
                        <span className="text-[10px] bg-white px-2 py-0.5 rounded-full border border-gray-200">Years: {item.years}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-xs font-bold text-indigo-600 uppercase">Repeated</p>
                        <p className="text-xl font-black">{item.count}x</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeView === "students") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Student Directory</h1>
            <p className="text-muted-foreground">List of all registered students across all departments</p>
          </div>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search students..." 
              className="pl-9 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Student Name</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">ERP ID / Email</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Academic Details</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {allStudents
                    .filter(s => 
                      s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      s.erpId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      s.email?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs">
                            {student.name?.charAt(0) || 'S'}
                          </div>
                          <span className="font-semibold text-sm">{student.name}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold">{student.erpId}</p>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            {student.email}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium bg-gray-100 px-2 py-1 rounded-md">
                          {student.department}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="text-[10px] space-y-1">
                          <p><span className="text-muted-foreground">Year:</span> {student.academicYear}</p>
                          <p><span className="text-muted-foreground">Sem/Div:</span> {student.semester} / {student.division}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        {student.profileComplete ? (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Active</span>
                        ) : (
                          <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allStudents.length === 0 && (
                <div className="py-20 text-center text-muted-foreground italic">
                  No students found in the system.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeView === "approvals") {
    return (
      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setActiveView("main")} className="mb-2 gap-2">
              <ChevronLeft className="w-4 h-4" /> Back to Dashboard
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">Global Approvals</h1>
            <p className="text-muted-foreground">Verify and approve academic materials across all departments</p>
          </div>
        </header>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Approval Queue</CardTitle>
            <CardDescription>Materials waiting for administrative verification</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center">Loading pending resources...</div>
            ) : pendingResources.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground italic">No pending approvals at this time.</div>
            ) : (
              <div className="space-y-4">
                {pendingResources.map((res) => (
                  <div key={res.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center border border-gray-100 shadow-sm">
                        {res.category === "qb" ? <FileText className="text-blue-500" /> : 
                         res.category === "pyq" ? <FileCheck className="text-purple-500" /> :
                         res.category === "library" ? <BookOpen className="text-emerald-500" /> :
                         <LinkIcon className="text-indigo-500" />}
                      </div>
                      <div>
                        <h3 className="font-bold">{res.title}</h3>
                        <p className="text-sm text-muted-foreground uppercase font-medium">
                          {res.category === "qb" ? "Question Bank" : 
                           res.category === "pyq" ? "Previous Year Paper" :
                           res.category === "library" ? "Digital Library" : "Resource"} • {res.subject}
                        </p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded-full">{res.department}</span>
                          <span className="text-[10px] bg-gray-200 px-2 py-0.5 rounded-full">Year {res.year}</span>
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">By {res.teacherName}</span>
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
                        <Eye className="w-4 h-4 mr-2" /> View
                      </a>
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => handleApprove(res.id)}>
                        <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleReject(res.id)}>
                        <XCircle className="w-4 h-4 mr-2" /> Reject
                      </Button>
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
          <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
          <p className="text-muted-foreground">
            Full Platform Control • {userProfile.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            System Logs
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("users")}
        >
          <CardHeader>
            <Users className="w-8 h-8 text-blue-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>User Management</CardTitle>
            <CardDescription>Manage faculty hierarchy</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("exams")}
        >
          <CardHeader>
            <FileText className="w-8 h-8 text-purple-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Exam Repository</CardTitle>
            <CardDescription>Access verified papers</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("approvals")}
        >
          <CardHeader>
            <ShieldCheck className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Approvals</CardTitle>
            <CardDescription>Global resource verification</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("generate-paper")}
        >
          <CardHeader>
            <Upload className="w-8 h-8 text-orange-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Generate Paper</CardTitle>
            <CardDescription>Upload & Search Resources</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("generate-paper-ai")}
        >
          <CardHeader>
            <Activity className="w-8 h-8 text-indigo-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>AI Paper Gen</CardTitle>
            <CardDescription>AI-powered generation</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("generate-answers")}
        >
          <CardHeader>
            <BookOpen className="w-8 h-8 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Generate Answers</CardTitle>
            <CardDescription>AI study material generator</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("analytics")}
        >
          <CardHeader>
            <BarChart3 className="w-8 h-8 text-pink-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Analytics</CardTitle>
            <CardDescription>Question repetition insights</CardDescription>
          </CardHeader>
        </Card>

        <Card 
          className="hover:shadow-md transition-all cursor-pointer group border-none shadow-sm bg-white"
          onClick={() => setActiveView("students")}
        >
          <CardHeader>
            <GraduationCap className="w-8 h-8 text-cyan-500 mb-2 group-hover:scale-110 transition-transform" />
            <CardTitle>Students</CardTitle>
            <CardDescription>Complete student directory</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>System Health</CardTitle>
              <Activity className="w-5 h-5 text-emerald-500" />
            </div>
            <CardDescription>Real-time platform performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Database Load</span>
                  <span className="font-medium text-emerald-600">Optimal</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 w-[15%]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Storage Usage</span>
                  <span className="font-medium text-blue-600">2.4 GB / 50 GB</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 w-[5%]" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Active Sessions</span>
                  <span className="font-medium text-purple-600">12 Users Online</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-500 w-[25%]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common admin tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-2">
              <ShieldCheck className="w-4 h-4" />
              Verify New Faculty
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
