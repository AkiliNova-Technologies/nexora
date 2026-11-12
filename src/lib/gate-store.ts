import type { DeviceCommand, GateResource } from "../domain/smart-estate.ts";
export interface GateViewState { gate: GateResource | null; command: DeviceCommand | null; pending: boolean; error: string | null }
export const emptyGateState: GateViewState={gate:null,command:null,pending:false,error:null};
export function beginGateCommand(state:GateViewState):GateViewState{return state.pending?state:{...state,pending:true,error:null};}
export function commandFailed(state:GateViewState,message:string):GateViewState{return {...state,pending:false,error:message};}
export function reconcileGateCommand(state:GateViewState,command:DeviceCommand):GateViewState{return {...state,command,pending:command.status==="ACCEPTED"||command.status==="PENDING",error:command.status==="FAILED"||command.status==="TIMEOUT"?(command.error??`Command ${command.status.toLowerCase()}`):null};}
export function reconcileGateResource(state:GateViewState,gate:GateResource):GateViewState{return {...state,gate:{...gate,physicalPositionVerification:"UNVERIFIED",state:{...gate.state,reported:{...gate.state.reported,physicalPositionVerification:"UNVERIFIED"}}}};}
