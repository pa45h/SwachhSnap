/**
 * Convert File or Blob to Base64 string
 */
export const fileToBase64 = (file: File | Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Upload image to Cloudinary (frontend unsigned upload)
 * @param base64Image - Base64 encoded image string or File
 * @returns Secure URL of uploaded image
 */
export const uploadToCloudinary = async (
  base64Image: string | File
): Promise<string> => {
  try {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error(
        "Cloudinary credentials not configured in environment variables"
      );
    }

    const formData = new FormData();

    // Handle File objects
    if (base64Image instanceof File) {
      formData.append("file", base64Image);
    } else {
      // Handle base64 strings
      formData.append("file", base64Image);
    }

    formData.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || "Cloudinary upload failed"
      );
    }

    const data = await response.json();
    if (!data.secure_url) {
      throw new Error("No URL returned from Cloudinary");
    }

    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw error;
  }
};
