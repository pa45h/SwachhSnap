import React, { useState, useEffect, useRef } from "react";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { firebaseService } from "../services/firebaseService";
import { Complaint, User } from "../types";
import { CATEGORIES, STATUS_COLORS } from "../constants";
import { getCurrentPosition } from "../services/locationHelper";

/* ==========================
   SAFE NUMBER HELPER
========================== */
const toNumber = (val: any): number | null => {
  const num = Number(val);
  return isNaN(num) ? null : num;
};

export const AdminDashboard: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [sweepers, setSweepers] = useState<User[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0 });
  const [selectedComplaint, setSelectedComplaint] =
    useState<Complaint | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersGroup = useRef<L.FeatureGroup | null>(null);

  // ==========================
  // LOGOUT
  // ==========================
  const handleLogout = async () => {
    await signOut(auth);
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
    if (viewMode !== "map" || !mapRef.current) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView(
        [22.3051776, 73.187328],
        5
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(mapInstance.current);

      markersGroup.current = L.featureGroup().addTo(mapInstance.current);
    } else {
      setTimeout(() => mapInstance.current?.invalidateSize(), 100);
    }

    markersGroup.current?.clearLayers();

    complaints.forEach((c) => {
      const lat = toNumber(c.latitude);
      const lng = toNumber(c.longitude);
      if (lat === null || lng === null) return;

      const color =
        c.status === "done"
          ? "#34A853"
          : c.priority === "high"
            ? "#EA4335"
            : "#1A73E8";

      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="background:${color};width:18px;height:18px;border-radius:50%;border:2px solid white"></div>`,
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        }),
      });

      marker.on("click", () => setSelectedComplaint(c));
      marker.addTo(markersGroup.current!);
    });

    if (markersGroup.current && complaints.length > 0) {
      mapInstance.current.fitBounds(markersGroup.current.getBounds());
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

  // ==========================
  // UI
  // ==========================
  return (
    <div className="space-y-8 text-black">
      {/* HEADER */}
      <div className="flex justify-between">
        <h2 className="text-2xl font-bold">Admin Console</h2>
        <div className="flex gap-3">
          <button
            onClick={() => setViewMode(viewMode === "list" ? "map" : "list")}
            className="px-6 py-3 rounded-xl font-bold border"
          >
            {viewMode === "list" ? "🗺 Map View" : "📋 List View"}
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold border"
          >
            Logout
          </button>
        </div>
      </div>

      {/* STATS */}
      <div className="grid md:grid-cols-3 gap-4">
        {[
          ["Total Reports", stats.total, "#1A73E8"],
          ["Pending Action", stats.pending, "#FBBC05"],
          ["Cleaned Up", stats.completed, "#34A853"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="bg-white p-6 rounded-3xl border">
            <p className="text-sm text-gray-500">{label}</p>
            <h3 className="text-4xl font-black">
              {value}
            </h3>
          </div>
        ))}
      </div>

      {/* MAP VIEW */}
      {viewMode === "map" && (
        <div className="bg-white rounded-3xl border h-125">
          <div ref={mapRef} className="w-full h-full" />
        </div>
      )}

      {/* LIST VIEW */}
      {viewMode === "list" && (
        <div className="bg-white rounded-3xl border overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-xs">Evidence</th>
                <th className="px-6 py-4 text-xs">Reporter</th>
                <th className="px-6 py-4 text-xs">Category</th>
                <th className="px-6 py-4 text-xs">Status</th>
                <th className="px-6 py-4 text-xs">Location</th>
                <th className="px-6 py-4 text-xs text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((c) => {
                const lat = toNumber(c.latitude);
                const lng = toNumber(c.longitude);

                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-6 py-4">
                      <img
                        src={c.beforeImage}
                        className="w-32 h-32 object-cover rounded cursor-pointer"
                        onClick={() => setSelectedComplaint(c)}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-bold">{c.userName}</div>
                      <div className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {
                        CATEGORIES.find((cat) => cat.value === c.category)
                          ?.label
                      }
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${STATUS_COLORS[c.status]
                          }`}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {lat && lng ? (
                        <>
                          📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                          <br />
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            View Map
                          </a>
                        </>
                      ) : (
                        <span className="text-gray-400">No GPS</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedComplaint(c)}
                        className="text-xs bg-gray-100 text-gray-700 font-bold px-3 py-2 rounded hover:bg-gray-200"
                      >
                        👁️ View
                      </button>

                      {/* {c.status === "submitted" && (
                        <select
                          onChange={(e) => assignTask(c.id, e.target.value)}
                          defaultValue=""
                          className="text-xs bg-blue-50 rounded p-2"
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
                      )} */}

                      {c.status === "review" && c.afterImage && (
                        <button
                          onClick={() => approveResolution(c.id)}
                          className="bg-green-100 text-green-700 text-xs font-bold px-3 py-2 rounded"
                        >
                          ✅ Approve
                        </button>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {c.status === "submitted" && (
                        <select
                          onChange={(e) =>
                            assignTask(c.id, e.target.value)
                          }
                          defaultValue=""
                          className="text-xs bg-blue-50 rounded p-2"
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
                      {c.status === "review" && (
                        <button
                          onClick={() => approveResolution(c.id)}
                          className="ml-2 bg-green-100 text-green-700 px-3 py-2 rounded text-xs font-bold"
                        >
                          ✅ Approve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {selectedComplaint && (() => {
            const lat = toNumber(selectedComplaint.latitude);
            const lng = toNumber(selectedComplaint.longitude);

            return (
              <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl overflow-hidden">

                  {/* HEADER */}
                  <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">Complaint Details</h3>
                    <button
                      onClick={() => setSelectedComplaint(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  </div>

                  {/* BODY */}
                  <div className="p-6 grid md:grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs font-bold mb-2">Before</p>
                      <img
                        src={selectedComplaint.beforeImage}
                        className="w-full h-64 object-cover rounded-xl border"
                      />
                    </div>

                    <div>
                      <p className="text-xs font-bold mb-2">After</p>
                      {selectedComplaint.afterImage ? (
                        <img
                          src={selectedComplaint.afterImage}
                          className="w-full h-64 object-cover rounded-xl border"
                        />
                      ) : (
                        <div className="h-64 flex items-center justify-center border rounded-xl text-gray-400 text-sm">
                          Sweeper has not uploaded image yet
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-2 text-sm space-y-1">
                      <p>
                        <b>Category:</b>{" "}
                        {CATEGORIES.find(
                          (cat) => cat.value === selectedComplaint.category
                        )?.label}
                      </p>
                      <p><b>Status:</b> {selectedComplaint.status}</p>

                      {lat && lng && (
                        <p>
                          <b>Location:</b>{" "}
                          <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            View on Map
                          </a>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="p-4 border-t flex justify-end gap-3">
                    {selectedComplaint.status === "review" &&
                      selectedComplaint.afterImage && (
                        <button
                          onClick={() => approveResolution(selectedComplaint.id)}
                          className="bg-green-600 text-white px-5 py-2 rounded-xl font-bold"
                        >
                          ✅ Approve Resolution
                        </button>
                      )}
                  </div>
                </div>
              </div>
            );
          })()}

        </div>

      )}
    </div>
  );
};
