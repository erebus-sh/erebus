import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const XOR = (a: string, b: string): number[] => {
  const result: number[] = [];
  for (let i = 0; i < a.length; i++) {
    // Use charCodeAt and wrap key if shorter than str
    const aChar = a.charCodeAt(i);
    const bChar = b.charCodeAt(i % b.length);
    result.push(aChar ^ bChar);
  }
  return result;
};

export function encodeBin(str: string, key: string): string {
  return XOR(str, key)
    .map((n: number) => n.toString(16).padStart(2, "0"))
    .join("");
}

// Decode from hex back to ASCII
export function decodeBin(hex: string, key: string): string {
  const bytes = hex.match(/.{1,2}/g)?.map((h) => parseInt(h, 16)) ?? [];
  return bytes
    .map((n, i) => String.fromCharCode(n ^ key.charCodeAt(i % key.length)))
    .join("");
}
