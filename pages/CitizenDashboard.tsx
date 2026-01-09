import React, { useState, useEffect } from "react";
import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

import { firebaseService } from "../services/firebaseService";
import { CameraView } from "../components/CameraView";
import {
  Complaint,
  ComplaintCategory,
  FeedbackType,
  VolunteerEvent,
} from "../types";
import { CATEGORIES, STATUS_COLORS } from "../constants";
import {
  getCurrentPosition,
  checkPriority,
} from "../services/locationHelper";

// Cloudinary
import { uploadToCloudinary } from "../services/cloudinaryUpload";

export const CitizenDashboard: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [events, setEvents] = useState<VolunteerEvent[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] =
    useState<ComplaintCategory>("garbage");
  const [description, setDescription] = useState("");

  const currentUser = auth.currentUser;

  // ==========================
  // SIGN OUT
  // ==========================
  const handleSignOut = async () => {
    await signOut(auth);
  };

  // ==========================
  // DATA SUBSCRIPTIONS
  // ==========================
  useEffect(() => {
    if (!currentUser) return;

    const unsubComplaints =
      firebaseService.subscribeToComplaints(
        setComplaints,
        { userId: currentUser.uid }
      );

    const unsubEvents =
      firebaseService.subscribeToEvents(setEvents);

    return () => {
      unsubComplaints();
      unsubEvents();
    };
  }, [currentUser]);

  // ==========================
  // REPORT FLOW
  // ==========================
  const handleNewReport = async () => {
    try {
      await getCurrentPosition();
      setShowCamera(true);
    } catch {
      alert("Location permission required");
    }
  };

  const submitReport = async (image: string) => {
    if (!currentUser) return;

    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      const latitude = pos.coords.latitude;
      const longitude = pos.coords.longitude;

      const imageUrl = await uploadToCloudinary(image);

      await firebaseService.createComplaint({
        userId: currentUser.uid,
        userName: currentUser.displayName || "Citizen",
        category,
        description,
        beforeImage: imageUrl,
        afterImage: null,
        latitude,
        longitude,
        priority: checkPriority(latitude, longitude)
          ? "high"
          : "normal",
        assignedSweeperId: null,
        assignedSweeperName: null,
        feedback: null,
      });

      setShowCamera(false);
      setDescription("");
      alert("Complaint submitted!");
    } catch (err) {
      console.error(err);
      alert("Submission failed");
    } finally {
      setLoading(false);
    }
  };

  // ==========================
  // FEEDBACK & EVENTS
  // ==========================
  const handleFeedback = async (
    complaintId: string,
    rating: FeedbackType
  ) => {
    await firebaseService.updateComplaint(complaintId, {
      feedback: rating,
    });
  };

  const toggleJoinEvent = async (
    eventId: string,
    isJoining: boolean
  ) => {
    if (!currentUser) return;
    await firebaseService.toggleEventJoin(
      eventId,
      currentUser.uid,
      isJoining
    );
  };

  // ==========================
  // UI
  // ==========================
  return (
    <div className="space-y-12 pb-20 text-black">

      {/* HEADER */}
      <section className="bg-white rounded-2xl p-6 shadow border">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Report an Issue</h2>

          <div className="flex gap-3">
            <button
              onClick={handleNewReport}
              disabled={loading}
              className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold"
            >
              📸 New Report
            </button>

            {/* 🔴 SIGN OUT BUTTON */}
            <button
              onClick={handleSignOut}
              className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold border border-red-200"
            >
              Sign Out
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() =>
                setCategory(cat.value as ComplaintCategory)
              }
              className={`p-4 rounded-xl border-2 flex flex-col items-center ${
                category === cat.value
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-200"
              }`}
            >
              <span className="text-2xl">{cat.icon}</span>
              <span className="text-xs font-bold uppercase">
                {cat.label}
              </span>
            </button>
          ))}
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add description..."
          className="w-full mt-6 p-4 bg-gray-50 border rounded-xl h-24"
        />
      </section>

      {/* EVENTS */}
      <section>
        <h3 className="text-xl font-bold mb-4">
          Clean-up Drives
        </h3>
        <div className="grid md:grid-cols-3 gap-4">
          {events.map((event) => {
            const joined =
              event.participants?.includes(
                currentUser?.uid || ""
              );

            return (
              <div
                key={event.id}
                className="bg-white p-5 rounded-xl border"
              >
                <h4 className="font-bold">{event.title}</h4>
                <p className="text-sm text-gray-500">
                  {event.description}
                </p>
                <button
                  onClick={() =>
                    toggleJoinEvent(event.id, !joined)
                  }
                  className={`mt-4 px-4 py-2 rounded text-xs font-bold ${
                    joined
                      ? "bg-green-100 text-green-700"
                      : "bg-blue-600 text-white"
                  }`}
                >
                  {joined ? "✓ Joined" : "Join Event"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* MY COMPLAINTS */}
      <section>
        <h3 className="text-xl font-bold mb-4">My Issues</h3>
        <div className="grid md:grid-cols-2 gap-6">
          {complaints.map((c) => (
            <div
              key={c.id}
              className="bg-white rounded-2xl overflow-hidden border"
            >
              <img
                src={c.beforeImage}
                className="w-full h-48 object-cover"
              />

              <div className="p-5">
                <div className="flex justify-between">
                  <h4 className="font-bold">
                    {
                      CATEGORIES.find(
                        (cat) => cat.value === c.category
                      )?.label
                    }
                  </h4>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded ${
                      STATUS_COLORS[c.status]
                    }`}
                  >
                    {c.status}
                  </span>
                </div>

                <p className="text-xs text-gray-500 mt-1">
                  {Number(c.latitude).toFixed(5)},{" "}
                  {Number(c.longitude).toFixed(5)}
                </p>

                <a
                  href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 underline"
                >
                  View on Map
                </a>

                {c.status === "done" && c.afterImage && (
                  <div className="mt-4 border-t pt-4">
                    <img
                      src={c.afterImage}
                      className="w-full h-32 object-cover rounded mb-3"
                    />
                    {!c.feedback ? (
                      <div className="flex gap-2">
                        <button onClick={() => handleFeedback(c.id, "good")}>😊</button>
                        <button onClick={() => handleFeedback(c.id, "avg")}>😐</button>
                        <button onClick={() => handleFeedback(c.id, "poor")}>😞</button>
                      </div>
                    ) : (
                      <p className="text-green-600 text-sm">
                        Feedback submitted
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {showCamera && (
        <CameraView
          onCapture={submitReport}
          onCancel={() => setShowCamera(false)}
        />
      )}
    </div>
  );
};
