import {AdminWorkspace} from "@/components/admin/admin-workspace";
export default async function Page({params}:{params:Promise<{id:string}>}){return <AdminWorkspace section="houses" houseId={(await params).id}/>;}
