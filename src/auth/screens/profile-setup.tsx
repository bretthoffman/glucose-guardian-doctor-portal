import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDoctorSession } from "../mock-session";
import { AuthShell } from "./auth-shell";

const TITLES = ["MD", "DO", "NP", "PA", "RN", "CDE/CDCES"];

export function ProfileSetup() {
  const { email, actions } = useDoctorSession();
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("MD");
  const [specialty, setSpecialty] = useState("Pediatric endocrinology");
  const [npi, setNpi] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setErr("Enter your full name.");
      return;
    }
    if (npi && !/^\d{10}$/.test(npi.trim())) {
      setErr("NPI must be 10 digits (or leave it blank).");
      return;
    }
    actions.completeProfile({
      fullName: fullName.trim(),
      title,
      specialty: specialty.trim(),
      npi: npi.trim() || undefined,
    });
  }

  return (
    <AuthShell title="Complete your profile" subtitle={email}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Dr. Alex Rivera"
            className="mt-1.5"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="title">Title</Label>
            <select
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1.5 w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="npi">NPI (optional)</Label>
            <Input
              id="npi"
              inputMode="numeric"
              value={npi}
              onChange={(e) => setNpi(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10 digits"
              className="mt-1.5"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="specialty">Specialty</Label>
          <Input
            id="specialty"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
            className="mt-1.5"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full h-12">
          Continue
        </Button>
      </form>
    </AuthShell>
  );
}
