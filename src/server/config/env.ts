import "server-only";
import { parseEnvironment } from "./schema";

export function getConfig() {
  return parseEnvironment(process.env);
}
