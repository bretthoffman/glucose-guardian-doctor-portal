/**
 * Patient avatar: shows the profile photo synced from the Glucose Guardian app when present
 * (a small base64 data-URI on snapshot.profile.photoDataUri), otherwise initials. Only data:
 * image URIs are rendered — anything else (e.g. a device-local file path) falls back to initials.
 */
export function PatientAvatar({
  name,
  photoDataUri,
  className = "w-11 h-11 text-sm",
}: {
  name: string;
  photoDataUri?: string;
  className?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  if (photoDataUri?.startsWith("data:image/")) {
    return (
      <img
        src={photoDataUri}
        alt={name}
        className={`${className} rounded-full object-cover border border-primary/30 shrink-0`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center text-primary font-display font-bold shrink-0`}
    >
      {initials}
    </div>
  );
}
