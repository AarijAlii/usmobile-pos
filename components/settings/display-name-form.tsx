"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDisplayName, type SettingsActionState } from "@/app/(app)/settings/actions";

const initialState: SettingsActionState = {};

export function DisplayNameForm({ fullName }: { fullName: string }) {
  const [state, formAction, isPending] = useActionState(
    async (prev: SettingsActionState, formData: FormData) => {
      const result = await updateDisplayName(prev, formData);
      if (result.success) toast.success("Name updated");
      return result;
    },
    initialState,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="fullName">Full name</Label>
        <Input id="fullName" name="fullName" defaultValue={fullName} required maxLength={100} />
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <Button type="submit" disabled={isPending}>
        {isPending && <Loader2 className="animate-spin" />}
        {isPending ? "Saving…" : "Save name"}
      </Button>
    </form>
  );
}
