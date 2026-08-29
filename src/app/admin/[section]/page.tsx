import { notFound } from "next/navigation";
import AdminWorkspace from "@/components/admin/AdminWorkspace";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin-sections";

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!ADMIN_SECTIONS.includes(section as AdminSection) || section === "dashboard") notFound();
  return <AdminWorkspace section={section as AdminSection} />;
}
