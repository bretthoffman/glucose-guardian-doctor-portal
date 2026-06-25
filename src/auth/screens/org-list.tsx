import { useState } from "react";
import { Building2, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { MockOrganization } from "@/data/mock";

/** Presentational organization list with search. Used by the dev onboarding flow and the
 * production org-first login. */
export function OrgList({
  orgs,
  onSelect,
}: {
  orgs: MockOrganization[];
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <div className="relative mb-4">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search organizations…"
          className="pl-9"
        />
      </div>
      <div className="space-y-2">
        {filtered.map((o) => (
          <button
            key={o.id}
            onClick={() => onSelect(o.id)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-secondary/40 transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center shrink-0">
              <Building2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground">{o.name}</p>
              <p className="text-xs text-muted-foreground">@{o.allowedDomains[0]}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">
            No organizations match &ldquo;{q}&rdquo;.
          </p>
        )}
      </div>
    </>
  );
}
