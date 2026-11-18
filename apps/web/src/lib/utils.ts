import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "guest";
  const key = "dsa_session_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    localStorage.setItem(key, id);
  }
  return id;
}
