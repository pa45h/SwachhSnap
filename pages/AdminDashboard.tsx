import React, { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { firebaseService } from "../services/firebaseService";
import { Complaint, User, VolunteerEvent } from "../types";
import { CATEGORIES, STATUS_COLORS } from "../constants";
import { getCurrentPosition } from "../services/locationHelper";

export const AdminDashboard: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [sweepers, setSweepers] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(
    null
  );
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersGroup = useRef<L.FeatureGroup | null>(null);

  // Event Form State
  const [showEventForm, setShowEventForm] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  // ==========================
  // LOGOUT
  // ==========================
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // ==========================
  // DATA SUBSCRIPTIONS
  // ==========================
  useEffect(() => {
    const unsubscribe = firebaseService.subscribeToComplaints((allC) => {
      const sorted = [...allC].sort((a, b) => {
        if (a.priority === "high" && b.priority !== "high") return -1;
        if (a.priority !== "high" && b.priority === "high") return 1;
        return b.createdAt - a.createdAt;
      });

      setComplaints(sorted);
      console.log("complaints---", sorted);

      setStats({
        total: allC.length,
        pending: allC.filter((c) => c.status !== "done").length,
        completed: allC.filter((c) => c.status === "done").length,
      });
    });

    const fetchSweepers = async () => {
      const allS = await firebaseService.getAllSweepers();
      setSweepers(allS);
    };

    fetchSweepers();
    return () => unsubscribe();
  }, []);

  // ==========================
  // MAP INITIALIZATION
  // ==========================
  useEffect(() => {
    if (viewMode === "map" && mapRef.current) {
      // Initialize map if it doesn't exist
      if (!mapInstance.current) {
        mapInstance.current = L.map(mapRef.current).setView([22.3051776, 73.187328], 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
        }).addTo(mapInstance.current);

        markersGroup.current = L.featureGroup().addTo(mapInstance.current);
      } else {
        // Fix map display after switching back from list view
        setTimeout(() => {
          mapInstance.current?.invalidateSize();
        }, 100);
      }

      if (markersGroup.current) {
        markersGroup.current.clearLayers();
      }

      complaints.forEach((c) => {
        const color =
          c.status === "done"
            ? "#34A853"
            : c.priority === "high"
            ? "#EA4335"
            : "#1A73E8";

        const html = `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white;"></div>`;

        const marker = L.marker([c.latitude, c.longitude], {
          icon: L.divIcon({
            html: html,
            className: "",
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
        });

        marker.on("click", () => setSelectedComplaint(c));

        if (markersGroup.current) {
          marker.addTo(markersGroup.current);
        }
      });

      if (mapInstance.current && complaints.length > 0 && markersGroup.current) {
        mapInstance.current.fitBounds(markersGroup.current.getBounds());
      }
    }
  }, [viewMode, complaints]);

  // ==========================
  // ACTIONS
  // ==========================
  const assignTask = async (complaintId: string, sweeperId: string) => {
    const sweeper = sweepers.find((s) => s.uid === sweeperId);
    if (!sweeper) return;

    await firebaseService.updateComplaint(complaintId, {
      status: "review",
      assignedSweeperId: sweeperId,
      assignedSweeperName: sweeper.name,
    });
  };

  const approveResolution = async (complaintId: string) => {
    await firebaseService.updateComplaint(complaintId, { status: "done" });
    setSelectedComplaint(null);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingEvent(true);

    try {
      const pos = await getCurrentPosition();
      await firebaseService.createEvent({
        title: eventTitle,
        date: new Date(eventDate).getTime(),
        description: eventDesc,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        participants: [],
      });

      setEventTitle("");
      setEventDate("");
      setEventDesc("");
      setShowEventForm(false);
      alert("Event created!");
    } catch {
      alert("GPS required to create event.");
    } finally {
      setIsCreatingEvent(false);
    }
  };

  // ==========================
  // UI
  // ==========================
  return (
    <div className="space-y-8 text-black">
      {/* ACTION BAR */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h2 className="text-2xl font-bold">Admin Console</h2>

        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
            className="px-6 py-3 rounded-xl font-bold border"
          >
            {viewMode === "list" ? "🗺 Map View" : "📋 List View"}
          </button>

          <button
            onClick={() => setShowEventForm(true)}
            className="bg-[#34A853] text-white px-6 py-3 rounded-xl font-bold"
          >
            📅 Host Drive
          </button>

          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold border border-red-200"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium">Total Reports</p>
          <h3 className="text-4xl font-black text-[#1A73E8]">{stats.total}</h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium">Pending Action</p>
          <h3 className="text-4xl font-black text-[#FBBC05]">
            {stats.pending}
          </h3>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
          <p className="text-gray-500 text-sm font-medium">Cleaned Up</p>
          <h3 className="text-4xl font-black text-[#34A853]">
            {stats.completed}
          </h3>
        </div>
      </div>

      {viewMode === "map" ? (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden h-150 relative">
          <div ref={mapRef} className="w-full h-full" />
          <div className="absolute top-4 left-4 z-10 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-md border border-gray-100 text-[10px] space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <div className="w-2 h-2 rounded-full bg-[#EA4335]"></div> High
              Priority
            </div>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-2 h-2 rounded-full bg-[#1A73E8]"></div> Normal
              Case
            </div>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-2 h-2 rounded-full bg-[#34A853]"></div> Resolved
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-xl font-bold">Complaints Queue</h3>
            <div className="flex gap-2">
              <span className="bg-red-50 text-red-600 px-2 py-1 rounded text-[10px] font-black uppercase">
                High Priority First
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                    Evidence
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                    Reporter
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                    Category
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase">
                    Assignee
                  </th>
                  <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {complaints.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-gray-400"
                    >
                      No complaints reported yet.
                    </td>
                  </tr>
                ) : (
                  complaints.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div
                          className="w-40 h-40 rounded-lg overflow-hidden bg-gray-100 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setSelectedComplaint(c)}
                        >
                          <img
                            src={c.beforeImage}
                            alt="Before"
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold">{c.userName}</div>
                        <div className="text-[10px] text-gray-400">
                          {new Date(c.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {
                              CATEGORIES.find((cat) => cat.value === c.category)
                                ?.label
                            }
                          </span>
                          <span
                            className={`w-max mt-1 px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${
                              c.priority === "high"
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {c.priority}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            STATUS_COLORS[c.status]
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {c.assignedSweeperName || "Not Assigned"}
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedComplaint(c)}
                          className="text-xs bg-gray-100 text-gray-600 font-bold px-3 py-2 rounded hover:bg-gray-200 transition-colors"
                        >
                          👁️ View
                        </button>
                        {c.status === "submitted" && (
                          <select
                            onChange={(e) => assignTask(c.id, e.target.value)}
                            className="text-xs bg-blue-50 text-[#1A73E8] border-none font-bold rounded p-2 outline-none"
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Assign Sweeper
                            </option>
                            {sweepers.map((s) => (
                              <option key={s.uid} value={s.uid}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        )}
                        {c.status === "review" && c.afterImage && (
                          <button
                            onClick={() => approveResolution(c.id)}
                            className="bg-green-100 text-green-700 text-xs font-bold px-3 py-2 rounded hover:bg-green-200 transition-colors"
                          >
                            ✅ Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EVENT FORM MODAL */}
      {showEventForm && (
        <div className="fixed inset-0 bg-black/60 z-110 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-xl font-bold">Host Clean-up Event</h3>
              <button
                onClick={() => setShowEventForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  Event Title
                </label>
                <input
                  required
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g. Riverside Cleaning Drive"
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#34A853]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  Date & Time
                </label>
                <input
                  required
                  type="datetime-local"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#34A853]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                  Description
                </label>
                <textarea
                  value={eventDesc}
                  onChange={(e) => setEventDesc(e.target.value)}
                  placeholder="Details for volunteers..."
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-[#34A853] h-24 resize-none"
                />
              </div>
              <p className="text-[10px] text-gray-400">
                * Event location will be set to your current GPS position.
              </p>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEventForm(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingEvent}
                  className="flex-1 px-4 py-3 bg-[#34A853] text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {isCreatingEvent ? "Setting up..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
