type CloudinaryUploadResponse = {
  secure_url?: string;
  url?: string;
  public_id?: string;
  error?: {
    message?: string;
  };
};

type UploadedCloudinaryImage = {
  url: string;
  publicId?: string;
};

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;

function requireViteEnv(name: string): string {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  if (!raw) {
    throw new Error(`${name} is required for image uploads.`);
  }
  return raw;
}

function getOptionalViteEnv(name: string): string | undefined {
  const raw = (import.meta.env[name] as string | undefined)?.trim();
  return raw && raw.length > 0 ? raw : undefined;
}

export async function uploadImageToCloudinary(file: File): Promise<UploadedCloudinaryImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose a valid image file.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image size must be 8MB or less.");
  }

  const cloudName = requireViteEnv("VITE_CLOUDINARY_CLOUD_NAME");
  const uploadPreset = requireViteEnv("VITE_CLOUDINARY_UPLOAD_PRESET");
  const uploadFolder = getOptionalViteEnv("VITE_CLOUDINARY_UPLOAD_FOLDER");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  if (uploadFolder) {
    formData.append("folder", uploadFolder);
  }

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json()) as CloudinaryUploadResponse;
  if (!response.ok) {
    throw new Error(payload.error?.message || "Cloudinary upload failed.");
  }

  const uploadedUrl = payload.secure_url || payload.url;
  if (!uploadedUrl) {
    throw new Error("Cloudinary did not return an image URL.");
  }

  return {
    url: uploadedUrl,
    publicId: payload.public_id,
  };
}