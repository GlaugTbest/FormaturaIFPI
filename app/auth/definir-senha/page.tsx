import type { Metadata } from "next";
import { SetPasswordForm } from "./set-password-form";

export const metadata: Metadata = { title: "Definir senha" };

export default function SetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">
            Defina sua senha
          </h1>
        </div>
        <SetPasswordForm />
      </div>
    </main>
  );
}
