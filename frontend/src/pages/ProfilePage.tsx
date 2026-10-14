import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Medal,
  TrendingUp,
  Package,
  ArrowLeftRight,
  Edit3,
  LogOut,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { getCurrentUser, updateCurrentUser } from "@/services/index.ts";
import type { UserProfile } from "@loopin/shared";
import { formatCurrency, scoreTierColor, scoreTierLabel } from "@/lib/utils.ts";
import { ScoreRing, Modal, FormField, SuccessMessage } from "@/components/ui/shared.tsx";
import { useAuth } from "@/lib/authContext.tsx";

export function ProfilePage() {
  const navigate = useNavigate();
  const { session, signOut } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    getCurrentUser().then((userData) => {
      setUser(userData);
      setEditName(userData.displayName);
      setEditBio(userData.bio ?? "");
      setLoading(false);
    });
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const patch: { displayName?: string; bio?: string } = {
      displayName: editName.trim() || user.displayName,
    };
    if (editBio.trim()) {
      patch.bio = editBio.trim();
    }
    const updated = await updateCurrentUser(patch);
    setUser(updated);
    setIsEditing(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  if (loading || !user) {
    return null;
  }

  const tier = scoreTierLabel(user.reliabilityScore);
  const tierColor = scoreTierColor(user.reliabilityScore);
  // Genuine verification: only if campusVerified is true
  const isGenuinelyVerified = Boolean(user.campusVerified ?? session?.campusVerified);

  return (
    <div className="space-y-6 animate-slide-up max-w-3xl pb-12">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold text-ink">My Profile & TrustScore</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="btn-ghost text-xs text-red-600 hover:text-red-700 hover:bg-red-50 inline-flex items-center gap-1.5"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </button>
      </div>

      {savedSuccess && <SuccessMessage message="Profile details updated successfully." />}

      {/* Main Profile Header Card */}
      <div className="card flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 text-xl font-extrabold shadow-brand-sm">
            {user.displayName
              .split(" ")
              .map((n) => n[0])
              .join("")}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{user.displayName}</h2>
              {isGenuinelyVerified ? (
                <span className="badge bg-emerald-50 text-emerald-700 text-[11px] font-semibold inline-flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Campus Student
                </span>
              ) : (
                <span className="badge bg-amber-50 text-amber-700 text-[11px] font-medium inline-flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  Unverified Affiliation
                </span>
              )}
            </div>
            <p className="text-xs text-ink-muted">{user.email}</p>
            <p className="text-xs text-ink-subtle">
              Campus ID: {user.campusId} · Member since August 2024
            </p>
            {user.bio && (
              <p className="text-xs text-ink-muted pt-1 max-w-md italic">
                &ldquo;{user.bio}&rdquo;
              </p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="btn-secondary text-xs self-start sm:self-center py-2 px-3 inline-flex items-center gap-1.5"
        >
          <Edit3 className="h-3.5 w-3.5" />
          Edit Profile
        </button>
      </div>

      {/* TrustScore Deep-Dive Card */}
      <div className="card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border pb-4">
          <div>
            <span className="section-label text-brand-600">Account Reliability</span>
            <h3 className="text-lg font-bold text-ink">Campus TrustScore™ Rating</h3>
          </div>
          <span className="badge bg-lime-100 text-lime-800 text-xs font-bold">
            Top 15% Campus Tier
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-8 justify-around py-2">
          <ScoreRing score={user.reliabilityScore} size={120} />

          <div className="space-y-3 max-w-sm text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <Medal className="h-5 w-5 text-amber-500" />
              <p className={`text-xl font-extrabold ${tierColor}`}>{tier} Standing</p>
            </div>
            <p className="text-xs text-ink-muted leading-relaxed">
              Your TrustScore is determined by on-time item returns, loan approval responsiveness, and peer feedback across VIT Chennai.
            </p>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-1">
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                ✓ 100% On-Time Returns
              </span>
              <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">
                ✓ 22 Items Shared
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown bars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-surface-border pt-4">
          <div className="rounded-xl bg-surface-muted p-3 space-y-1">
            <span className="text-[11px] text-ink-subtle block">Return Punctuality</span>
            <p className="text-base font-bold text-emerald-600">100%</p>
            <p className="text-[10px] text-ink-muted">14 completed return cycles</p>
          </div>
          <div className="rounded-xl bg-surface-muted p-3 space-y-1">
            <span className="text-[11px] text-ink-subtle block">Lending Activity</span>
            <p className="text-base font-bold text-brand-600">{user.lendCount} Loans</p>
            <p className="text-[10px] text-ink-muted">Generated ₹1,240 in peer savings</p>
          </div>
          <div className="rounded-xl bg-surface-muted p-3 space-y-1">
            <span className="text-[11px] text-ink-subtle block">Peer Endorsements</span>
            <p className="text-base font-bold text-amber-600">8 Endorsements</p>
            <p className="text-[10px] text-ink-muted">From Sharavathi & Himalaya</p>
          </div>
        </div>
      </div>

      {/* Aggregate Stats Matrix */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            icon: TrendingUp,
            label: "Total Savings Generated",
            value: formatCurrency(user.totalSavings),
            accent: "text-emerald-600",
          },
          {
            icon: Package,
            label: "Items Shared with Quad",
            value: user.lendCount,
            accent: "text-brand-600",
          },
          {
            icon: ArrowLeftRight,
            label: "Times Borrowed",
            value: user.borrowCount,
            accent: "text-lime-700",
          },
        ].map(({ icon: Icon, label, value, accent }) => (
          <div key={label} className="card text-center space-y-1">
            <Icon className={`mx-auto h-5 w-5 mb-1 ${accent}`} />
            <p className="text-2xl font-bold text-ink">{value}</p>
            <p className="text-xs text-ink-muted">{label}</p>
          </div>
        ))}
      </div>

      {/* Edit Profile Modal */}
      <Modal open={isEditing} onClose={() => setIsEditing(false)} title="Edit Profile Details">
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <FormField label="Display Name" htmlFor="edit-name" required>
            <input
              id="edit-name"
              type="text"
              className="input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </FormField>

          <FormField label="Campus Bio" htmlFor="edit-bio" hint="Max 200 characters">
            <textarea
              id="edit-bio"
              rows={3}
              className="input"
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={200}
            />
          </FormField>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="btn-secondary flex-1 justify-center"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary flex-1 justify-center">
              Save Changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
