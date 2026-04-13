
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  getDocs
} from "firebase/firestore";
import { db } from "../../lib/firebase";

export interface PDFResource {
  id: string;
  title: string;
  url: string;
  subject: string;
  teacherName: string;
  teacherId: string;
  department: string;
  category: 'qb' | 'pyq' | 'library' | 'resources';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  year?: string;
  semester?: string;
  uploaderRole?: string;
}

export const pdfService = {
  // We'll keep a local cache for synchronous access if needed, 
  // but components should ideally use the Firestore listeners.
  
  add: async (pdf: Omit<PDFResource, 'id' | 'status' | 'createdAt'> & { status?: 'pending' | 'approved' | 'rejected' }) => {
    try {
      const docRef = await addDoc(collection(db, "academic_resources"), {
        ...pdf,
        status: pdf.status || 'pending',
        createdAt: serverTimestamp(),
      });
      return docRef.id;
    } catch (error) {
      console.error("Error adding PDF to Firestore:", error);
      throw error;
    }
  },

  updateStatus: async (id: string, status: 'approved' | 'rejected') => {
    try {
      const docRef = doc(db, "academic_resources", id);
      await updateDoc(docRef, { status });
    } catch (error) {
      console.error("Error updating PDF status:", error);
      throw error;
    }
  },

  delete: async (id: string) => {
    try {
      await deleteDoc(doc(db, "academic_resources", id));
    } catch (error) {
      console.error("Error deleting PDF:", error);
      throw error;
    }
  },

  // Helper to get all resources for a department (real-time)
  subscribeToDepartmentResources: (department: string, callback: (resources: PDFResource[]) => void) => {
    const q = query(
      collection(db, "academic_resources"),
      where("department", "==", department),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const resources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PDFResource[];
      callback(resources);
    });
  },

  // Helper for global search (approved only)
  subscribeToAllApproved: (callback: (resources: PDFResource[]) => void) => {
    const q = query(
      collection(db, "academic_resources"),
      where("status", "==", "approved"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const resources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PDFResource[];
      callback(resources);
    });
  },

  // Helper for Admin (all resources)
  subscribeToAll: (callback: (resources: PDFResource[]) => void) => {
    const q = query(
      collection(db, "academic_resources"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      const resources = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PDFResource[];
      callback(resources);
    });
  }
};
