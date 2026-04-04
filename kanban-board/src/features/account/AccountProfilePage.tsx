import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Trash2, UserCircle2 } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input } from "../../components/ui/Input";
import {
  changePassword,
  deleteCurrentUser,
  listLinkedAccounts,
  setPassword,
  updateUserProfile,
} from "../../lib/authClient";
import { getConvexClient } from "../../lib/convexClient";
import { convexRefs } from "../../lib/convexRefs";

type SessionUser = {
  name: string;
  email: string;
  image: string | null;
};

type AccountProfilePageProps = {
  sessionUser: SessionUser | null;
  currentAvatarUrl: string | null;
  onBackToBoard: () => void;
  onRefreshSession: () => Promise<void>;
  onProfileUpdated: (profile: { name: string; avatarUrl: string | null }) => void;
  onAccountDeleted: () => void;
};

export function AccountProfilePage({
  sessionUser,
  currentAvatarUrl,
  onBackToBoard,
  onRefreshSession,
  onProfileUpdated,
  onAccountDeleted,
}: AccountProfilePageProps) {
  const [name, setName] = useState(sessionUser?.name || "");
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(currentAvatarUrl || sessionUser?.image || null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [hasCredentialAccount, setHasCredentialAccount] = useState(true);
  const [hasGoogleAccount, setHasGoogleAccount] = useState(false);

  const [profileStatus, setProfileStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState(false);

  useEffect(() => {
    setName(sessionUser?.name || "");
  }, [sessionUser]);

  useEffect(() => {
    setAvatarPreviewUrl(currentAvatarUrl || sessionUser?.image || null);
  }, [currentAvatarUrl, sessionUser?.image]);

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
        const hasGoogle = accounts.some((account) => account.providerId === "google");

        setHasCredentialAccount(hasCredential);
        setHasGoogleAccount(hasGoogle);
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

  const previewAvatar = useMemo(() => avatarPreviewUrl, [avatarPreviewUrl]);
  const canSaveProfile = name.trim().length >= 2;
  const canDelete = deleteConfirmText.trim().toUpperCase() === "DELETE";
  const isSetPasswordMode = !hasCredentialAccount && hasGoogleAccount;

  const handleAvatarFilePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setSelectedAvatarFile(file);
    const localPreview = URL.createObjectURL(file);
    setAvatarPreviewUrl(localPreview);
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

      const convexClient = getConvexClient();
      if (!convexClient) {
        throw new Error("Convex client is unavailable.");
      }

      let avatarStorageId: string | undefined;
      if (selectedAvatarFile) {
        const uploadUrl = await convexClient.mutation(convexRefs.generateAvatarUploadUrl, {});
        const uploadResponse = await fetch(uploadUrl as string, {
          method: "POST",
          headers: {
            "Content-Type": selectedAvatarFile.type || "application/octet-stream",
          },
          body: selectedAvatarFile,
        });

        if (!uploadResponse.ok) {
          throw new Error("Failed to upload profile image.");
        }

        const uploadPayload = (await uploadResponse.json()) as { storageId?: string };
        if (!uploadPayload.storageId) {
          throw new Error("Profile image upload did not return a storage id.");
        }

        avatarStorageId = uploadPayload.storageId;
      }

      const profileResult = await convexClient.mutation(convexRefs.updateCurrentUserProfile, {
        name: name.trim(),
        ...(avatarStorageId ? { avatarStorageId } : null),
      }) as { name?: string; avatarUrl?: string | null };

      await onRefreshSession();
      onProfileUpdated({
        name: profileResult?.name || name.trim(),
        avatarUrl: profileResult?.avatarUrl ?? avatarPreviewUrl,
      });
      setSelectedAvatarFile(null);
      setProfileStatus("Profile updated.");
    } catch (error) {
      setProfileStatus(error instanceof Error ? error.message : "Profile update failed.");
    } finally {
      setIsProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async () => {
    setPasswordStatus(null);

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setPasswordStatus("Enter and confirm your new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordStatus("New password and confirmation must match.");
      return;
    }

    if (!isSetPasswordMode && !currentPassword.trim()) {
      setPasswordStatus("Current password is required.");
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      if (isSetPasswordMode) {
        await setPassword(newPassword);
      } else {
        await changePassword(currentPassword, newPassword);
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStatus(isSetPasswordMode ? "Password set successfully." : "Password updated successfully.");
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : "Password update failed.");
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
      setDeleteStatus(error instanceof Error ? error.message : "Account deletion failed.");
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
        <div className="flex flex-col items-start gap-3 md:flex-row md:items-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
            {previewAvatar ? (
              <img src={previewAvatar} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <UserCircle2 size={50} className="text-slate-400" />
            )}
          </div>
          <div className="w-full space-y-2">
            <Input label="Upload image" type="file" accept="image/*" onChange={handleAvatarFilePick} />
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
          ) : isSetPasswordMode ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              You signed in with Google. Set a password to enable email/password sign in.
            </p>
          ) : null}
        </div>

        {!isSetPasswordMode ? (
          <Input
            label="Current password"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
          />
        ) : null}

        <Input
          label={isSetPasswordMode ? "New password" : "New password"}
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          autoComplete="new-password"
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          autoComplete="new-password"
        />

        {passwordStatus ? <p className="text-sm text-slate-600 dark:text-slate-300">{passwordStatus}</p> : null}
        <Button onClick={() => void handlePasswordSubmit()} isLoading={isPasswordSubmitting}>
          {isSetPasswordMode ? "Set Password" : "Update Password"}
        </Button>
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
