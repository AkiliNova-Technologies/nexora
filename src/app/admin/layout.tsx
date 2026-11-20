import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { getSql } from "@/lib/cloud/db";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic="force-dynamic";

export default async function AdminLayout({children}:{children:React.ReactNode}){
  const user=await requireUser();
  if(!user)redirect("/login?next=/admin");
  const sql=getSql();
  const rows=await sql`select exists(select 1 from smart_estate.estate_admin where user_id=${user.id}::uuid and active) allowed`;
  if(!rows[0]?.allowed)redirect("/dashboard");
  return <AdminShell>{children}</AdminShell>;
}
