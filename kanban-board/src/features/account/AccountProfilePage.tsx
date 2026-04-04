import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import { getConvexClient, setConvexAuthToken } from "../../lib/convexClient";
import { convexRefs } from "../../lib/convexRefs";
import {
  changePassword,
  deleteCurrentUser,
  fetchConvexJwtToken,
  listLinkedAccounts,
  sanitizeUserFacingErrorMessage,
  updateUserProfile,
} from "../../lib/authClient";

type SessionUser = {
  name: string;
  email: string;
  image: string | null;
};

type AccountProfilePageProps = {
  sessionUser: SessionUser | null;
  onBackToBoard: () => void;
  onRefreshSession: () => Promise<void>;
  onAccountDeleted: () => void;
  onAvatarUpdated: (avatarUrl: string) => void;
};

const MAX_AVATAR_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

function toFriendlyStatus(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    return sanitizeUserFacingErrorMessage(error.message, fallback);
  }
  return sanitizeUserFacingErrorMessage("", fallback);
}

function isUnauthorizedConvexError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("unauthorized") || message.includes("not authenticated") || message.includes("invalid auth");
}

export function AccountProfilePage({
  sessionUser,
  onBackToBoard,
  onRefreshSession,
  onAccountDeleted,
  onAvatarUpdated,
}: AccountProfilePageProps) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(sessionUser?.name || "");
  const [image, setImage] = useState(sessionUser?.image || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [hasCredentialAccount, setHasCredentialAccount] = useState(true);

  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isAvatarUploading, setIsAvatarUploading] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  useEffect(() => {
    setName(sessionUser?.name || "");
    setImage(sessionUser?.image || "");
  }, [sessionUser]);

  useEffect(() => {
    let active = true;

    const loadAccounts = async () => {
      setIsLoadingAccounts(true);
      try {
        const accounts = await listLinkedAccounts();
        if (!active) {
          return;
        }

        const hasCredential = accounts.some((account) => account.providerId === "credential");
        setHasCredentialAccount(hasCredential);
      } catch {
        if (!active) {
          return;
        }

        // Assume credential support if account inspection fails.
        setHasCredentialAccount(true);
      } finally {
        if (active) {
          setIsLoadingAccounts(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  const previewAvatar = useMemo(() => image.trim() || null, [image]);
  const canSaveProfile = name.trim().length >= 2;
  const canDelete = deleteConfirmText.trim().toUpperCase() === "DELETE";

  const runWithConvexAuthRetry = async <T,>(operation: () => Promise<T>): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      if (!isUnauthorizedConvexError(error)) {
        throw error;
      }

      const token = await fetchConvexJwtToken();
      if (!token) {
        throw error;
      }

      setConvexAuthToken(token);
      return operation();
    }
  };

  const handleAvatarFilePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setProfileStatus(null);
    const fileInput = event.currentTarget;

    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type || !ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
      setProfileStatus("Please upload a JPG, PNG, WebP, GIF, or AVIF image.");
      fileInput.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_FILE_SIZE_BYTES) {
      setProfileStatus("Image must be 5MB or smaller.");
      fileInput.value = "";
      return;
    }

    const client = getConvexClient();
    if (!client) {
      setProfileStatus("Convex client is unavailable.");
      return;
    }

    setIsAvatarUploading(true);
    try {
      const uploadUrl = (await runWithConvexAuthRetry(async () =>
        (await client.mutation(convexRefs.generateAvatarUploadUrl, {})) as string,
      )) as string;
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image to Convex storage.");
      }

      const payload = (await uploadResponse.json()) as { storageId?: unknown };
      if (typeof payload.storageId !== "string" || payload.storageId.length === 0) {
        throw new Error("Invalid upload response from Convex storage.");
      }

      const avatarUrl = (await runWithConvexAuthRetry(async () =>
        (await client.mutation(convexRefs.saveCurrentUserAvatar, {
          storageId: payload.storageId,
        })) as string,
      )) as string;

      let bestAvatarUrl = avatarUrl.trim();

      const resolvedAvatarUrl = avatarUrl.trim();
      if (!resolvedAvatarUrl) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 350));
          }

          const currentUser = (await runWithConvexAuthRetry(async () =>
            (await client.query(convexRefs.getCurrentUser, {})) as { image?: unknown } | null,
          )) as { image?: unknown } | null;

          const delayedAvatarUrl = typeof currentUser?.image === "string" ? currentUser.image.trim() : "";
          if (delayedAvatarUrl) {
            bestAvatarUrl = delayedAvatarUrl;
            break;
          }
        }
      }

      if (bestAvatarUrl) {
        setImage(bestAvatarUrl);
        onAvatarUpdated(bestAvatarUrl);
      }

      // Convex is the source of truth for stored avatars; Better Auth profile sync is best-effort.
      try {
        await updateUserProfile({ image: bestAvatarUrl || null });
        await onRefreshSession();
      } catch {
        // Ignore non-fatal profile mirror failures.
      }

      setProfileStatus(bestAvatarUrl ? "Profile image updated." : "Image uploaded. It should appear shortly.");
    } catch (error) {
      setProfileStatus(toFriendlyStatus(error, "Image upload failed. Please try again."));
    } finally {
      fileInput.value = "";
      setIsAvatarUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    setProfileStatus(null);

    if (!canSaveProfile) {
      setProfileStatus("Name must be at least 2 characters.");
      return;
    }

    setIsProfileSubmitting(true);
    try {
      await updateUserProfile({
        name: name.trim(),
      });
      await onRefreshSession();
      setProfileStatus("Profile updated.");
    } catch (error) {
      setProfileStatus(toFriendlyStatus(error, "Profile update failed. Please try again."));
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setPasswordStatus(null);

    if (!hasCredentialAccount) {
      setPasswordStatus("Password management is unavailable for Google-only accounts.");
      return;
    }

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordStatus("Enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New password and confirmation must match.");
      return;
    }

    if (!currentPassword.trim()) {
      setPasswordStatus("Current password is required.");
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus("Password updated successfully.");
    } catch (error) {
      setPasswordStatus(toFriendlyStatus(error, "Password update failed. Please try again."));
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteStatus(null);

    if (!canDelete) {
      setDeleteStatus('Type "DELETE" to confirm account removal.');
      return;
    }

    if (hasCredentialAccount && !deletePassword.trim()) {
      setDeleteStatus("Password is required to delete this account.");
      return;
    }

    setIsDeleteSubmitting(true);
    try {
      await deleteCurrentUser(hasCredentialAccount ? deletePassword : undefined);
      onAccountDeleted();
    } catch (error) {
      setDeleteStatus(toFriendlyStatus(error, "Account deletion failed. Please try again."));
      setIsDeleteSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/40 bg-white/75 px-4 py-3 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600 dark:text-cyan-300">Account</p>
          <h2 className="text-2xl font-bold tracking-tight">Profile Settings</h2>
        </div>
        <Button variant="secondary" onClick={onBackToBoard} className="gap-2">
          <ArrowLeft size={16} />
          Back to Board
        </Button>
      </div>

      <Card className="space-y-4 border-white/40 bg-white/75 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70">
        <h3 className="text-lg font-semibold">Profile</h3>
        <div className="flex items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            {previewAvatar ? (
              <img src={previewAvatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <UserCircle2 size={50} className="text-slate-400" />
            )}
          </div>
          <div>
            <input
              ref={avatarInputRef}
              className="hidden"
              type="file"
              accept="image/*"
              onChange={(event) => {
                void handleAvatarFilePick(event);
              }}
            />
            <button
              type="button"
              className="flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              onClick={() => avatarInputRef.current?.click()}
            >
              Upload photo
            </button>
            {isAvatarUploading ? <p className="text-sm text-slate-500 dark:text-slate-400">Uploading image...</p> : null}
          </div>
        </div>

        <Input label="Display name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />

        {profileStatus ? <p className="text-sm text-slate-600 dark:text-slate-300">{profileStatus}</p> : null}
        <Button onClick={() => void handleSaveProfile()} isLoading={isProfileSubmitting} disabled={!canSaveProfile}>Save Profile</Button>
      </Card>

      <Card className="space-y-4 border-white/40 bg-white/75 shadow-xl backdrop-blur-md dark:border-slate-700/50 dark:bg-slate-900/70">
        <div>
          <h3 className="text-lg font-semibold">Password</h3>
          {isLoadingAccounts ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Checking account providers...</p>
          ) : !hasCredentialAccount ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Password management is disabled for Google-only accounts.
            </p>
          ) : null}
        </div>

        {hasCredentialAccount ? (
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        ) : null}

        {hasCredentialAccount ? (
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
          />
        ) : null}

        {hasCredentialAccount ? (
          <Input
            label="Confirm new password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        ) : null}

        {passwordStatus ? <p className="text-sm text-slate-600 dark:text-slate-300">{passwordStatus}</p> : null}

        {hasCredentialAccount ? (
          <Button onClick={() => void handlePasswordSubmit()} isLoading={isPasswordSubmitting}>
            Update Password
          </Button>
        ) : null}
      </Card>

      <Card className="space-y-4 border-red-300/70 bg-red-50/80 shadow-xl backdrop-blur-md dark:border-red-500/40 dark:bg-red-950/30">
        <div>
          <h3 className="text-lg font-semibold text-red-700 dark:text-red-300">Delete Account</h3>
          <p className="text-sm text-red-700/90 dark:text-red-300/90">
            This action is permanent and removes your account access.
          </p>
        </div>

        <Input
          label='Type "DELETE" to confirm'
          value={deleteConfirmText}
          onChange={(event) => setDeleteConfirmText(event.target.value)}
        />

        {hasCredentialAccount ? (
          <Input
            label="Password"
            type="password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
            autoComplete="current-password"
          />
        ) : null}

        {deleteStatus ? <p className="text-sm text-red-700 dark:text-red-300">{deleteStatus}</p> : null}
        <Button
          variant="danger"
          className="gap-2"
          onClick={() => void handleDeleteAccount()}
          isLoading={isDeleteSubmitting}
          disabled={!canDelete}
        >
          <Trash2 size={16} />
          Delete Account
        </Button>
      </Card>
    </section>
  );
}
