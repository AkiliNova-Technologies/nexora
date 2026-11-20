import {NextResponse,type NextRequest} from "next/server";
import {authenticateGateway} from "@/lib/cloud/security";
import {confirmProvisioning,leaseProvisioning} from "@/lib/controllers/provisioning";
export const runtime="nodejs";export const dynamic="force-dynamic";
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request:NextRequest){const gateway=authenticateGateway(request);if(!gateway)return NextResponse.json({code:"UNAUTHORIZED"},{status:401});const limit=Math.min(20,Math.max(1,Number(request.nextUrl.searchParams.get("limit")||10)));return NextResponse.json({requests:await leaseProvisioning(gateway.id,limit)},{headers:{"Cache-Control":"no-store"}});}
export async function POST(request:NextRequest){const gateway=authenticateGateway(request);if(!gateway)return NextResponse.json({code:"UNAUTHORIZED"},{status:401});const body=await request.json().catch(()=>null) as {commandId?:string;leaseId?:string}|null;if(!body||!uuid.test(body.commandId??"")||!uuid.test(body.leaseId??""))return NextResponse.json({code:"INVALID_CONFIRMATION"},{status:400});return await confirmProvisioning(gateway.id,body.commandId!,body.leaseId!)?NextResponse.json({confirmed:true}):NextResponse.json({code:"LEASE_REJECTED"},{status:409});}
