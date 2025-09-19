import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function AuthMe() {
  async function handleAuthMe(formData: FormData) {
    "use server";
    const userId = nanoid();
    const ckis = await cookies();
    const usedId = ckis.get("x-User-Id")?.value;
    if (!usedId) {
      ckis.set("x-User-Id", userId);
    }
    redirect("/");
  }

  return (
    <form action={handleAuthMe}>
      <button type="submit">Auth Me</button>
    </form>
  );
}
