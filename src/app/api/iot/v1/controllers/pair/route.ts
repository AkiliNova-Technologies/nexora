import { NextResponse, type NextRequest } from "next/server";
import { consumePairingChallenge, ControllerAuthorizationError } from "@/lib/controllers/service";

export const runtime="nodejs";
export const dynamic="force-dynamic";

export async function POST(request:NextRequest){
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return NextResponse.json({code:"INVALID_JSON"},{status:400});}
  try{
    const result=await consumePairingChallenge({pairingId:String(body.pairingId??""),challenge:String(body.challenge??""),proof:String(body.proof??"")});
    return NextResponse.json(result);
  }catch(error){
    if(error instanceof ControllerAuthorizationError)return NextResponse.json({code:"PAIRING_REJECTED",message:error.message},{status:401});
    return NextResponse.json({code:"PAIRING_UNAVAILABLE"},{status:503});
  }
}
