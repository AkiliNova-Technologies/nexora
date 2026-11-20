import {NextResponse,type NextRequest} from "next/server";
import {authenticateGateway} from "@/lib/cloud/security";
import {acknowledgeProvisioning} from "@/lib/controllers/provisioning";
export const runtime="nodejs";export const dynamic="force-dynamic";
export async function POST(request:NextRequest,{params}:{params:Promise<{controllerId:string}>}){const gateway=authenticateGateway(request);if(!gateway)return NextResponse.json({code:"UNAUTHORIZED"},{status:401});const body=await request.json().catch(()=>null);if(!body||typeof body!=="object"||Array.isArray(body))return NextResponse.json({code:"INVALID_ACK"},{status:400});const accepted=await acknowledgeProvisioning(gateway.id,(await params).controllerId,body as Record<string,unknown>);return accepted?NextResponse.json({accepted:true}):NextResponse.json({code:"ACK_REJECTED"},{status:409});}
