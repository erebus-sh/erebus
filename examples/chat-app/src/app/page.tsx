import { cookies } from "next/headers";
import Link from "next/link";

export default async function Home() {
  const auth = await cookies();
  const userId = auth.get("x-User-Id")?.value;
  if (userId) {
    return <Link href="/chat">Chat in a channel</Link>;
  }
  return <Link href="/authMe">Must be authenticated Click here</Link>;
}
