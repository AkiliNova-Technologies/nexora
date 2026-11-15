import { handleAlexaDirective, type AlexaControlContext, type AlexaDirective } from "./smart-home";

/**
 * AWS Lambda entry-point factory. The deployed bundle must provide a control
 * context backed by Nexora OAuth token validation and the private control API.
 */
export function createAlexaLambdaHandler(control: AlexaControlContext) {
  return async function handler(event: AlexaDirective) {
    return handleAlexaDirective(event, control);
  };
}
