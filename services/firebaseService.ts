// services/firebaseService.ts
// Centralized Firebase service layer for SwachhSnap
// Handles users, complaints, images, and volunteer events

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";

import {
  ref,
  uploadString,
  getDownloadURL,
} from "firebase/storage";

import { db, storage } from "../lib/firebase";
import {
  User,
  Complaint,
  VolunteerEvent,
} from "../types";

// ==========================
// USER OPERATIONS
// ==========================
export const firebaseService = {
  /**
   * Save or update a user profile in Firestore
   */
  async saveUser(user: User) {
    await setDoc(doc(db, "users", user.uid), {
      ...user,
      createdAt: Timestamp.now(),
    });
  },

  /**
   * Fetch a user by UID
   */
  async getUser(uid: string): Promise<User | null> {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as User) : null;
  },

  /**
   * Get all users with role = sweeper
   */
  async getAllSweepers(): Promise<User[]> {
    const q = query(
      collection(db, "users"),
      where("role", "==", "sweeper")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as User);
  },

  // ==========================
  // IMAGE UPLOAD
  // ==========================
  /**
   * Upload base64 image to Firebase Storage
   * Returns public download URL
   */
  async uploadImage(base64Data: string, path: string): Promise<string> {
    const storageRef = ref(storage, path);

    // uploadString supports base64 data URLs (camera images)
    await uploadString(storageRef, base64Data, "data_url");

    return await getDownloadURL(storageRef);
  },

  // ==========================
  // COMPLAINTS
  // ==========================
  /**
   * Create a new complaint
   * Status is automatically set to 'submitted'
   */
  async createComplaint(
    data: Omit<Complaint, "id" | "createdAt" | "status">
  ) {
    const docRef = await addDoc(collection(db, "complaints"), {
      ...data,
      status: "submitted",
      createdAt: Timestamp.now(),
    });

    return docRef.id;
  },

  /**
   * Update complaint fields (status, assigned sweeper, feedback, etc.)
   */
  async updateComplaint(id: string, updates: Partial<Complaint>) {
    const docRef = doc(db, "complaints", id);
    await updateDoc(docRef, updates);
  },

  /**
   * Real-time complaint subscription
   * Used by user, admin, and sweeper dashboards
   */
  subscribeToComplaints(
    callback: (complaints: Complaint[]) => void,
    filters?: {
      userId?: string;
      assignedSweeperId?: string;
    }
  ) {
    let qRef = query(
      collection(db, "complaints"),
      orderBy("createdAt", "desc")
    );

    if (filters?.userId) {
      qRef = query(
        collection(db, "complaints"),
        where("userId", "==", filters.userId),
        orderBy("createdAt", "desc")
      );
    }

    if (filters?.assignedSweeperId) {
      qRef = query(
        collection(db, "complaints"),
        where("assignedSweeperId", "==", filters.assignedSweeperId),
        orderBy("createdAt", "desc")
      );
    }

    return onSnapshot(qRef, (snap) => {
      const complaints = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as Complaint)
      );
      callback(complaints);
    });
  },

  // ==========================
  // VOLUNTEER EVENTS
  // ==========================
  /**
   * Create a volunteer clean-up event
   */
  async createEvent(
    event: Omit<VolunteerEvent, "id" | "createdAt">
  ) {
    const docRef = await addDoc(collection(db, "volunteer_events"), {
      ...event,
      createdAt: Timestamp.now(),
    });
    return docRef.id;
  },

  /**
   * Real-time volunteer events listener
   */
  subscribeToEvents(
    callback: (events: VolunteerEvent[]) => void
  ) {
    const qRef = query(
      collection(db, "volunteer_events"),
      orderBy("date", "asc")
    );

    return onSnapshot(qRef, (snap) => {
      const events = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() } as VolunteerEvent)
      );
      callback(events);
    });
  },

  /**
   * Join or leave a volunteer event
   */
  async toggleEventJoin(
    eventId: string,
    userId: string,
    isJoining: boolean
  ) {
    const docRef = doc(db, "volunteer_events", eventId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) return;

    const participants: string[] = snap.data().participants || [];

    const updatedParticipants = isJoining
      ? Array.from(new Set([...participants, userId]))
      : participants.filter((id) => id !== userId);

    await updateDoc(docRef, {
      participants: updatedParticipants,
    });
  },
};
