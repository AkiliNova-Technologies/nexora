"use client";
import * as React from "react";
import Link from "next/link";
import {usePathname,useRouter} from "next/navigation";
import {Activity,Building2,Cpu,DoorOpen,Home,LogOut,Settings,ShieldCheck,Users} from "lucide-react";
import {NexoraLogo} from "@/components/brand/nexora-logo";
import {SiteHeader} from "@/components/site-header";
import {useSmartEstate} from "@/components/providers/device-state-provider";
import {Sidebar,SidebarContent,SidebarFooter,SidebarHeader,SidebarInset,SidebarMenu,SidebarMenuButton,SidebarMenuItem,SidebarProvider} from "@/components/ui/sidebar";

const links=[
  ["Overview","/admin",Home],["Houses","/admin/houses",Building2],["Residents","/admin/residents",Users],
  ["Devices","/admin/devices",Cpu],["Security","/admin/security",ShieldCheck],["Entrance gate","/admin/gate",DoorOpen],
  ["Controllers","/admin/controllers",Cpu],["Activity","/admin/activity",Activity],["Settings","/admin/settings",Settings],
] as const;

export function AdminShell({children}:{children:React.ReactNode}){
  const pathname=usePathname(),router=useRouter();const {user,logout}=useSmartEstate();
  return <SidebarProvider style={{"--sidebar-width":"calc(var(--spacing) * 72)","--header-height":"calc(var(--spacing) * 14)"} as React.CSSProperties}>
    <Sidebar collapsible="offcanvas" className="border-white/10">
      <SidebarHeader className="border-b border-white/10 p-4"><Link href="/admin" className="flex items-center gap-3"><NexoraLogo className="size-9"/><div><p className="font-semibold text-white">Nexora Estate</p><p className="text-xs text-muted-foreground">Administrator workspace</p></div></Link></SidebarHeader>
      <SidebarContent className="px-2 py-4"><SidebarMenu>{links.map(([title,url,Icon])=><SidebarMenuItem key={url}><SidebarMenuButton asChild isActive={url==="/admin"?pathname===url:pathname.startsWith(url)}><Link href={url}><Icon/><span>{title}</span></Link></SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarContent>
      <SidebarFooter className="border-t border-white/10 p-3"><div className="mb-3 min-w-0 px-2"><p className="truncate text-sm font-medium text-white">{user?.name}</p><p className="truncate text-xs text-muted-foreground">{user?.email}</p></div><button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-white/5 hover:text-white" onClick={()=>void logout().finally(()=>router.replace("/login"))}><LogOut className="size-4"/>Sign out</button></SidebarFooter>
    </Sidebar>
    <SidebarInset className="bg-transparent"><SiteHeader/><main className="flex flex-1 flex-col"><div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-5 md:px-6 md:py-7">{children}</div></main></SidebarInset>
  </SidebarProvider>;
}
