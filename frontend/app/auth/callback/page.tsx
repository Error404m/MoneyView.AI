// frontend/app/auth/callback/page.tsx

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");

    if (!code) return;

    const fetchUser = async () => {
      try {
        const response = await fetch(`http://localhost:8000/auth/callback?${searchParams.toString()}`, {
          method: "GET",
          credentials: "include",
        });
        const data = await response.json();
        console.log("User data:", data);

        if (data.email) {
          localStorage.setItem("user_email", data.email);
          localStorage.setItem("access_token", data.access_token);
          router.push("/profile");
        } else {
          console.error("Login failed:", data);
        }
      } catch (error) {
        console.error("Auth callback error:", error);
      }
    };

    fetchUser();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <h1 className="text-lg font-semibold">Logging you in...</h1>
    </div>
  );
}
