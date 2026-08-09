"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentStaff } from "@/lib/auth";

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

export async function updateDisplayName(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireCurrentStaff();

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) {
    return { error: "Name cannot be empty." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_own_display_name", { p_full_name: fullName });
  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function changePassword(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireCurrentStaff();

  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };

  return { success: true };
}
